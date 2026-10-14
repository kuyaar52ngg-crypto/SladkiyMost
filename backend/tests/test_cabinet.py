"""Личный кабинет: профиль, адреса, уведомления, обращения."""
import pytest

from app.application import account as A
from app.application import auth, notifications
from app.domain.entities import NotificationKind, Region, TicketStatus
from app.domain.errors import Conflict, DomainError, Forbidden, NotFound, Unauthorized

from .fakes import FakeNotifier
from .test_accounts import H, place, uow  # noqa: F401 — фикстура uow


def addr(**kw):
    d = dict(title="Дом", name="Анна", region=Region.DNR, city="Донецк", line="ул. Примерная, 14", phone="+7 (949) 000-00-01")
    return A.AddressData(**{**d, **kw})


def test_profile_and_password(uow):
    a = auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123")
    b = auth.register(uow, H, "+7 (914) 999-88-77", "Борис", "secret123")
    u = A.update_profile(uow, a.id, A.ProfilePatch(name="Анна Морозова", email="anna@example.ru", region=Region.DNR,
                                                    notify_news=True))
    assert (u.name, u.email, u.region, u.notify_news) == ("Анна Морозова", "anna@example.ru", Region.DNR, True)
    with pytest.raises(DomainError):
        A.update_profile(uow, a.id, A.ProfilePatch(email="не почта"))
    with pytest.raises(Conflict):
        A.update_profile(uow, a.id, A.ProfilePatch(phone=b.phone))
    with pytest.raises(Unauthorized):
        A.change_password(uow, H, a.id, "wrong-pass", "new-secret-1")
    A.change_password(uow, H, a.id, "secret123", "new-secret-1")
    assert H.verify("new-secret-1", uow.users.get(a.id).password_hash)


def test_addresses(uow):
    u = auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123")
    home = A.save_address(uow, u.id, addr())
    assert home.is_default                                   # первый адрес — основной
    gift = A.save_address(uow, u.id, addr(title="Для подарков", name="Елена"))
    assert not gift.is_default
    A.set_default_address(uow, u.id, gift.id)
    assert [a.is_default for a in uow.addresses.of_user(u.id)] == [True, False]
    A.delete_address(uow, u.id, gift.id)
    assert uow.addresses.get(home.id).is_default             # основной перешёл к оставшемуся
    other = auth.register(uow, H, "+7 (914) 999-88-77", "Борис", "secret123")
    with pytest.raises(NotFound):
        A.delete_address(uow, other.id, home.id)              # чужой адрес
    with pytest.raises(DomainError):
        A.save_address(uow, u.id, addr(city=""))


def test_feed_and_preferences(uow):
    u = auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123")
    u.tg_chat_id = 200
    uow.users.save(u)
    n = FakeNotifier()
    o = place(uow, u.id)
    notifications.order_placed(uow, n, o, "https://site")
    feed = uow.notifications.of_user(u.id)
    assert feed[0].title == f"Заказ {o.code} принят" and feed[0].link.endswith(f"/account/orders/{o.code}")
    assert n.sent and n.links[-1] == f"https://site/account/orders/{o.code}"

    A.update_profile(uow, u.id, A.ProfilePatch(notify_orders=False))   # Telegram выключен — лента остаётся
    n.sent.clear()
    notifications.order_cancelled(uow, n, o, "https://site", by_customer=True)
    assert not n.sent and len(uow.notifications.of_user(u.id)) == 2
    A.mark_read(uow, u.id)
    assert all(x.read for x in uow.notifications.of_user(u.id))


def test_tickets(uow):
    admin = auth.ensure_admin(uow, H, "+7 (900) 000-00-00", "admin-pass")
    u = auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123")
    o = place(uow, u.id)
    with pytest.raises(DomainError):
        A.create_ticket(uow, u, "Сборная доставка", "Когда?", "СМ-9999")   # чужой/несуществующий заказ
    t = A.create_ticket(uow, u, "Сборная доставка", "Когда согласуют доставку?", o.code)
    assert t.code == "ОБ-001" and t.status == TicketStatus.OPEN
    n = FakeNotifier()
    t = A.add_message(uow, admin, t.number, "После закрытия партии.")
    notifications.ticket_updated(uow, n, t, "https://site", by_support=True)
    assert t.status == TicketStatus.ANSWERED and t.assignee == admin.name
    assert uow.notifications.of_user(u.id)[0].kind == NotificationKind.SUPPORT
    t = A.add_message(uow, u, t.number, "Спасибо, а дата?")
    assert t.status == TicketStatus.IN_WORK and len(t.messages) == 3
    A.set_ticket_status(uow, admin, t.number, TicketStatus.CLOSED)
    with pytest.raises(Forbidden):
        A.add_message(uow, u, t.number, "Ещё вопрос")
    stranger = auth.register(uow, H, "+7 (914) 999-88-77", "Борис", "secret123")
    with pytest.raises(NotFound):
        A.get_ticket(uow, stranger, t.number)
