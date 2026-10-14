"""Интеграционные тесты API на реальном PostgreSQL (TEST_DATABASE_URL). Пропускаются без БД."""
import os
from datetime import date

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

URL = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://sm:sm@localhost:5432/sladkiy_most_test")
ADMIN = {"phone": "+7 (900) 000-00-00", "password": "admin-pass"}


@pytest.fixture(scope="module")
def app():
    from app.infrastructure.clock import SystemClock
    from app.infrastructure.db.models import Base
    from app.infrastructure.db.uow import SqlUnitOfWork, make_session_factory
    from app.infrastructure.security import Argon2Hasher, SessionTokens
    from app.presentation.api.app import create_app
    from app.presentation.api.deps import Container
    from tests.catalog_data import PRODUCTS
    from tests.fakes import FakeNotifier, FakeStorage

    try:
        engine = create_engine(URL)
        with engine.begin() as c:
            c.execute(text("SELECT 1"))
    except OperationalError:
        pytest.skip("PostgreSQL недоступен")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    sessions = make_session_factory(URL)
    with SqlUnitOfWork(sessions) as u:
        for p in PRODUCTS:
            u.products.save(p)
        u.commit()
    return create_app(Container(
        uow_factory=lambda: SqlUnitOfWork(sessions), clock=SystemClock(date(2026, 10, 14)), hasher=Argon2Hasher(),
        sessions=SessionTokens("test-secret-of-sufficient-length-32b"), storage=FakeStorage(), notifier=FakeNotifier(),
        admin_phone=ADMIN["phone"], admin_password=ADMIN["password"], webhook_secret="hook", cookie_secure=False,
    ))


def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)


def test_end_to_end_order_flow(app):
    guest, buyer, admin = client(app), client(app), client(app)
    assert len(guest.get("/api/products", params={"region": "DNR"}).json()) == 3
    offers = guest.post("/api/waves/offers", json={"items": [{"id": "DNR-001", "qty": 2}]}).json()
    wave = offers[0]["wave"]
    assert wave["direction"] == "DNR-YKT" and offers[0]["quote"]["delivery_rub"] > 0

    r = buyer.post("/api/auth/register", json={"phone": "+7 (914) 222-33-44", "name": "Иван", "password": "secret123"})
    assert r.status_code == 201 and "sm_session" in r.cookies
    body = {"items": [{"id": "DNR-001", "qty": 2}], "wave_id": wave["id"], "customer_name": "Иван",
            "customer_phone": "+7 (914) 222-33-44", "recipient_name": "Иван", "recipient_phone": "+7 (914) 222-33-44",
            "pickup_point": "Якутск", "consent": True}
    r = buyer.post("/api/orders", json=body)
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    assert [o["code"] for o in buyer.get("/api/orders").json()] == [code]
    assert guest.get("/api/orders").status_code == 401
    assert guest.get(f"/api/orders/{code}").status_code == 403
    assert guest.get(f"/api/orders/{code}", params={"phone": "89142223344"}).status_code == 200

    assert admin.get("/api/admin/stats").status_code == 401
    assert buyer.get("/api/admin/stats").status_code == 403
    assert admin.post("/api/auth/login", json=ADMIN).json()["role"] == "admin"
    r = admin.post(f"/api/admin/waves/{wave['id']}/status", json={"status": "closed"})
    assert r.status_code == 200
    assert buyer.get(f"/api/orders/{code}").json()["status"] == "assembling"
    assert buyer.post("/api/orders", json=body).status_code == 409   # волна закрыта
    assert admin.post("/api/auth/logout").status_code == 200
    assert admin.get("/api/admin/stats").status_code == 401


def test_admin_products_and_uploads(app):
    admin = client(app)
    admin.post("/api/auth/login", json=ADMIN)
    up = admin.post("/api/admin/uploads", json={"content_type": "image/webp", "size": 2048}).json()
    assert up["public_url"].endswith(".webp")
    assert admin.post("/api/admin/uploads", json={"content_type": "application/pdf", "size": 10}).status_code == 400
    p = {"name": "Пастила", "region": "YKT", "category": "Зефир и пастила", "weight_g": 150, "price_rub": 300,
         "photos": [up["public_url"], "https://cdn.test/b.svg"]}
    r = admin.post("/api/admin/products", json=p)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert r.json()["photo"] == up["public_url"] and len(r.json()["photos"]) == 2
    assert client(app).get("/api/products", params={"sort": "new", "limit": 1}).json()[0]["id"] == pid
    assert admin.delete(f"/api/admin/products/{pid}").json() == {"deleted": True}


def test_login_lockout_and_webhook(app):
    c = client(app)
    c.post("/api/auth/register", json={"phone": "+7 (914) 555-00-11", "name": "Оля", "password": "secret123"})
    for _ in range(5):
        assert c.post("/api/auth/login", json={"phone": "89145550011", "password": "nope-nope"}).status_code == 401
    assert c.post("/api/auth/login", json={"phone": "89145550011", "password": "secret123"}).status_code == 403
    assert c.post("/api/telegram/webhook", json={}).status_code == 403
    assert c.post("/api/telegram/webhook", json={"message": {"chat": {"id": 1}, "text": "/start x"}},
                  headers={"X-Telegram-Bot-Api-Secret-Token": "hook"}).status_code == 200


def test_validation_errors(app):
    c = client(app)
    assert c.post("/api/waves/offers", json={"items": [{"id": "YKT-001", "qty": 1}, {"id": "DNR-001", "qty": 1}]}).status_code == 400
    assert c.get("/api/orders/СМ-99999").status_code == 404


def _init_data(token: str, tg_id: int, auth_date: int) -> str:
    """initData, подписанный так же, как это делает Telegram."""
    import hashlib
    import hmac
    import json
    from urllib.parse import urlencode
    fields = {"auth_date": str(auth_date), "query_id": "AAH", "user": json.dumps({"id": tg_id, "first_name": "Анна"})}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    return urlencode({**fields, "hash": hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()})


def test_telegram_mini_app_login(app):
    import time

    from app.infrastructure.telegram import TelegramBot
    bot = TelegramBot("123:test-token")
    bot._configured = True  # без обращений к Telegram API
    app.state.container.bot = bot
    try:
        now = int(time.time())
        data = _init_data(bot.token, 777001, now)
        assert bot.verify_init_data(data)["id"] == 777001
        assert bot.verify_init_data(data.replace("777001", "777002")) is None      # подделка
        assert bot.verify_init_data(_init_data(bot.token, 777001, now - 3 * 86400)) is None  # устарел

        tg = client(app)
        assert tg.post("/api/auth/telegram", json={"init_data": "hash=bad"}).status_code == 401
        assert tg.post("/api/auth/telegram", json={"init_data": data}).json() is None   # аккаунт ещё не привязан

        # регистрация внутри Mini App привязывает Telegram и возвращает токен для заголовка Authorization
        r = tg.post("/api/auth/register", json={"phone": "+7 (914) 555-66-77", "name": "Анна",
                                                "password": "secret123", "tg_init_data": data})
        assert r.status_code == 201 and r.json()["telegram"] and r.json()["token"]
        token = r.json()["token"]

        again = client(app)  # новый запуск Mini App: вход без пароля
        r = again.post("/api/auth/telegram", json={"init_data": data})
        assert r.json()["phone"] == "+7 (914) 555-66-77" and r.json()["token"]

        headers_only = client(app)  # Telegram Web во фрейме: cookie нет, сессия заголовком
        assert headers_only.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["name"] == "Анна"
        assert client(app).post("/api/auth/login", json={"phone": "+7 (914) 555-66-77",
                                                          "password": "secret123"}).json()["token"] is None
    finally:
        app.state.container.bot = None


def test_cabinet_api(app):
    me = client(app)
    r = me.post("/api/auth/register", json={"phone": "+7 (914) 321-00-11", "name": "Вера", "password": "secret123"})
    assert r.status_code == 201
    assert me.put("/api/account/profile", json={"email": "vera@example.ru", "region": "DNR"}).json()["region"] == "DNR"
    a = me.post("/api/account/addresses", json={"title": "Дом", "name": "Вера", "region": "DNR", "city": "Донецк",
                                                "line": "ул. Мира, 1", "phone": "+7 (949) 111-22-33"})
    assert a.status_code == 201 and a.json()["is_default"]
    assert len(me.get("/api/account/addresses").json()) == 1
    t = me.post("/api/account/tickets", json={"topic": "Другое", "text": "Есть ли без сахара?"})
    assert t.status_code == 201 and t.json()["code"].startswith("ОБ-")
    admin = client(app)
    admin.post("/api/auth/login", json=ADMIN)
    tickets = admin.get("/api/admin/tickets").json()
    assert tickets[0]["customer_name"] == "Вера"
    r = admin.post(f"/api/admin/tickets/{t.json()['number']}/messages", json={"text": "Скоро добавим."})
    assert r.json()["status"] == "answered"
    feed = me.get("/api/account/notifications").json()
    assert feed[0]["kind"] == "support" and not feed[0]["read"]
    assert me.post("/api/account/notifications/read", json={}).status_code == 200
    assert all(n["read"] for n in me.get("/api/account/notifications").json())
    assert any(c["name"] == "Вера" for c in admin.get("/api/admin/customers").json())
    assert client(app).get("/api/account/addresses").status_code == 401
    assert me.get("/api/admin/customers").status_code == 403


def test_seller_api(app):
    admin, seller, buyer = client(app), client(app), client(app)
    admin.post("/api/auth/login", json=ADMIN)
    r = admin.post("/api/admin/shops", json={"name": "Тёплая кондитерская", "region": "DNR", "login_phone": "+7 (949) 700-10-10",
                                             "password": "seller-pass", "owner_name": "Ирина"})
    assert r.status_code == 201, r.text
    assert seller.post("/api/auth/login", json={"phone": "+7 (949) 700-10-10", "password": "seller-pass"}).json()["role"] == "seller"
    assert seller.get("/api/admin/stats").status_code == 403 and buyer.get("/api/seller/shop").status_code == 401
    body = {"name": "Пряник донецкий", "category": "Печенье и вафли", "weight_g": 300, "price_rub": 350,
            "photos": ["https://cdn.test/p.jpg"], "submit": True}
    p = seller.post("/api/seller/products", json=body).json()
    assert p["region"] == "DNR" and p["review"] and not p["active"]
    assert all(x["id"] != p["id"] for x in buyer.get("/api/products").json())          # до проверки не на витрине
    assert admin.post(f"/api/admin/products/{p['id']}/review", json={"approve": True}).json()["active"]
    shop_row = [s for s in admin.get("/api/admin/shops").json() if s["name"] == "Тёплая кондитерская"][0]
    assert shop_row["published"] == 1 and shop_row["login_phone"] == "+7 (949) 700-10-10"

    wave = buyer.post("/api/waves/offers", json={"items": [{"id": p["id"], "qty": 1}]}).json()[0]["wave"]
    o = buyer.post("/api/orders", json={"items": [{"id": p["id"], "qty": 1}], "wave_id": wave["id"], "customer_name": "Пётр",
                                        "customer_phone": "+7 (949) 111-00-00", "recipient_name": "Пётр",
                                        "recipient_phone": "+7 (914) 111-00-00", "pickup_point": "Якутск", "consent": True})
    assert o.status_code == 201, o.text
    code = o.json()["code"]
    mine = seller.get("/api/seller/orders").json()
    assert mine[0]["order"]["code"] == code and mine[0]["order"]["customer_phone"] == "" and mine[0]["prep_status"] == "new"
    r = seller.post(f"/api/seller/orders/{code}/prep", json={"status": "confirmed", "note": "Есть в наличии"})
    assert r.json()["prep_title"] == "Подтверждён"
    assert admin.get(f"/api/admin/orders/{code}/shops").json()[0]["prep_status"] == "confirmed"
    assert len(seller.get("/api/seller/waves").json()) == 1
