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
