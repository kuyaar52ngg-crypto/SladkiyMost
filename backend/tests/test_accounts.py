from datetime import date, datetime, timedelta, timezone

import pytest

from app.application import auth, catalog, notifications, uploads
from app.application import orders as O
from app.application import waves as W
from app.domain.entities import Direction, OrderStatus, Region, Role, WaveStatus
from app.domain.errors import Conflict, DomainError, Forbidden, Unauthorized

from .catalog_data import PRODUCTS
from .fakes import FakeNotifier, FakeStorage, MemUow, PlainHasher

TODAY = date(2026, 10, 14)
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
H = PlainHasher()


@pytest.fixture
def uow():
    u = MemUow()
    for p in PRODUCTS:
        u.products.save(p)
    W.sync_schedule(u, TODAY)
    return u


def place(uow, user_id=None, phone="+7 (914) 000-00-01"):
    w = W.list_waves(uow, TODAY, Direction.YKT_DNR, only_open=True)[0].wave
    return O.place_order(uow, TODAY, O.PlaceOrderCommand(
        quote=O.QuoteRequest([O.CartLine("YKT-001", 1)], w.id), customer_name="Тест", customer_phone=phone,
        recipient_name="Получатель", recipient_phone="+7 (949) 000-00-02", pickup_point="Донецк", consent=True,
        user_id=user_id))


def test_register_and_login(uow):
    u = auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123")
    assert u.id and u.role == Role.CUSTOMER and u.password_hash != "secret123"
    assert auth.authenticate(uow, H, "8 914 111 22 33", "secret123", NOW).id == u.id
    with pytest.raises(Conflict):
        auth.register(uow, H, "89141112233", "Дубль", "secret123")
    with pytest.raises(DomainError, match="Пароль"):
        auth.register(uow, H, "+7 914 999 00 00", "Коротко", "123")


def test_lock_after_five_failures(uow):
    auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123")
    for _ in range(5):
        with pytest.raises(Unauthorized):
            auth.authenticate(uow, H, "89141112233", "wrong-pass", NOW)
    with pytest.raises(Forbidden, match="15 мин"):
        auth.authenticate(uow, H, "89141112233", "secret123", NOW)
    assert auth.authenticate(uow, H, "89141112233", "secret123", NOW + timedelta(minutes=16))


def test_first_admin_from_env(uow):
    admin = auth.ensure_admin(uow, H, "+7 (900) 000-00-00", "admin-pass")
    assert admin.role == Role.ADMIN
    assert auth.ensure_admin(uow, H, "+7 (900) 111-11-11", "other-pass") is None  # админ уже есть


def test_order_belongs_to_user(uow):
    user = auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123")
    o = place(uow, user.id)
    assert [x.code for x in O.orders_of_user(uow, user)] == [o.code]
    assert O.view_order(uow, o.code, user).code == o.code
    with pytest.raises(Forbidden):
        O.view_order(uow, o.code, None)                       # гость без телефона
    assert O.view_order(uow, o.code, None, "89140000001").code == o.code
    assert O.cancel_order(uow, TODAY, o.code, user).status == OrderStatus.CANCELLED


def test_upload_validation():
    s = uploads.request_upload(FakeStorage(), "image/png", 1000, TODAY)
    assert s.public_url.startswith("https://cdn.test/2026/10/") and s.public_url.endswith(".png")
    assert uploads.request_upload(FakeStorage(), "image/svg+xml", 10, TODAY).public_url.endswith(".svg")
    with pytest.raises(DomainError, match="формат"):
        uploads.request_upload(FakeStorage(), "image/heic", 1000, TODAY)   # HEIC конвертирует браузер
    with pytest.raises(DomainError, match="20 МБ"):
        uploads.request_upload(FakeStorage(), "image/jpeg", 21 * 1024 * 1024, TODAY)


def test_product_gallery_and_delete(uow):
    data = catalog.ProductData(name="Пастила", region=Region.YKT, manufacturer="", category="Зефир и пастила",
                               weight_g=150, price_rub=300, temp_sensitive=False, shelf_life_days=60,
                               photos=["https://cdn.test/a.webp", "https://cdn.test/b.gif"])
    p = catalog.save_product(uow, data)
    assert p.id == "YKT-004" and p.photo == "https://cdn.test/a.webp" and len(p.photos) == 2
    with pytest.raises(DomainError):
        catalog.save_product(uow, catalog.ProductData(**{**data.__dict__, "photos": ["javascript:alert(1)"]}))
    assert catalog.delete_product(uow, p.id) is True
    place(uow)
    assert catalog.delete_product(uow, "YKT-001") is False          # есть заказы — только скрываем
    assert uow.products.get("YKT-001").active is False


def test_notifications(uow):
    admin = auth.ensure_admin(uow, H, "+7 (900) 000-00-00", "admin-pass")
    admin.tg_chat_id = 100
    uow.users.save(admin)
    user = auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123")
    token = auth.telegram_link_token(uow, user.id)
    assert auth.link_telegram(uow, token, 200).tg_chat_id == 200
    assert auth.link_telegram(uow, token, 300) is None              # токен одноразовый

    n = FakeNotifier()
    o = place(uow, user.id)
    notifications.order_placed(uow, n, o, "https://site")
    assert {c for c, _ in n.sent} == {100, 200} and o.code in n.sent[0][1]

    n.sent.clear()
    w = W.change_wave_status(uow, o.wave_id, WaveStatus.CLOSED, TODAY)
    notifications.wave_status_changed(uow, n, w, "https://site")
    assert [c for c, _ in n.sent] == [100, 200] and "В сборке" in n.sent[1][1]
