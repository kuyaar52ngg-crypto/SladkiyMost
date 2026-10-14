"""Личный кабинет: профиль и настройки, адреса, лента уведомлений, черновик открытки, обращения в поддержку."""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.domain.entities import (
    TICKET_TOPICS,
    Address,
    Region,
    Role,
    Ticket,
    TicketMessage,
    TicketStatus,
    User,
)
from app.domain.errors import Conflict, DomainError, Forbidden, NotFound, Unauthorized

from .auth import _password, _phone, get_user
from .orders import phone_digits
from .ports import PasswordHasher, UnitOfWork

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_ADDRESSES = 10
GIFT_TEXT_MAX = 200


def _text(value: str | None, field: str, limit: int, required: bool = True) -> str:
    v = (value or "").strip()
    if required and not v:
        raise DomainError(f"Заполните поле «{field}»")
    if len(v) > limit:
        raise DomainError(f"Поле «{field}» — не длиннее {limit} символов")
    return v


def _email(email: str | None) -> str | None:
    e = (email or "").strip()
    if e and (len(e) > 160 or not EMAIL_RE.match(e)):
        raise DomainError("Проверьте адрес электронной почты")
    return e or None


# ---------------- профиль ----------------
@dataclass(frozen=True)
class ProfilePatch:
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    region: Region | None = None
    notify_orders: bool | None = None
    notify_waves: bool | None = None
    notify_support: bool | None = None
    notify_news: bool | None = None


def update_profile(uow: UnitOfWork, user_id: int, p: ProfilePatch, clear_email: bool = False) -> User:
    user = get_user(uow, user_id)
    if p.name is not None:
        user.name = _text(p.name, "Имя и фамилия", 120)
    if p.phone is not None and phone_digits(p.phone) != phone_digits(user.phone):
        phone = _phone(p.phone)
        other = uow.users.by_phone(phone_digits(phone))
        if other and other.id != user.id:
            raise Conflict("Этот телефон уже привязан к другому аккаунту")
        user.phone = phone
    if p.email is not None or clear_email:
        user.email = _email(p.email)
    if p.region is not None:
        user.region = p.region
    for f in ("notify_orders", "notify_waves", "notify_support", "notify_news"):
        if (v := getattr(p, f)) is not None:
            setattr(user, f, v)
    uow.users.save(user)
    uow.commit()
    return user


def change_password(uow: UnitOfWork, hasher: PasswordHasher, user_id: int, current: str, new: str) -> None:
    user = get_user(uow, user_id)
    if not hasher.verify(current or "", user.password_hash):
        raise Unauthorized("Текущий пароль указан неверно")
    user.password_hash = hasher.hash(_password(new))
    uow.users.save(user)
    uow.commit()


def save_gift_draft(uow: UnitOfWork, user_id: int, draft: dict) -> User:
    user = get_user(uow, user_id)
    user.gift_draft = {
        "recipient_name": _text(draft.get("recipient_name"), "Получатель", 120, required=False),
        "recipient_phone": _text(draft.get("recipient_phone"), "Телефон", 40, required=False),
        "address": _text(draft.get("address"), "Адрес", 300, required=False),
        "message": _text(draft.get("message"), "Текст открытки", GIFT_TEXT_MAX, required=False),
        "contact_first": bool(draft.get("contact_first")),
    }
    uow.users.save(user)
    uow.commit()
    return user


# ---------------- адреса ----------------
@dataclass(frozen=True)
class AddressData:
    title: str
    name: str
    region: Region
    city: str
    line: str
    phone: str
    is_default: bool = False


def _own_address(uow: UnitOfWork, user_id: int, address_id: int) -> Address:
    a = uow.addresses.get(address_id)
    if not a or a.user_id != user_id:
        raise NotFound("Адрес не найден")
    return a


def _make_default(uow: UnitOfWork, user_id: int, keep: Address) -> None:
    for other in uow.addresses.of_user(user_id):
        if other.id != keep.id and other.is_default:
            other.is_default = False
            uow.addresses.save(other)


def save_address(uow: UnitOfWork, user_id: int, d: AddressData, address_id: int | None = None) -> Address:
    existing = uow.addresses.of_user(user_id)
    if address_id is None and len(existing) >= MAX_ADDRESSES:
        raise DomainError(f"Можно сохранить не больше {MAX_ADDRESSES} адресов")
    a = _own_address(uow, user_id, address_id) if address_id is not None else Address(
        id=None, user_id=user_id, title="", name="", region=d.region, city="", line="", phone="")
    a.title = _text(d.title, "Название адреса", 60, required=False) or "Адрес"
    a.name = _text(d.name, "Имя получателя", 120)
    a.region = d.region
    a.city = _text(d.city, "Город", 60)
    a.line = _text(d.line, "Улица, дом, квартира", 300)
    a.phone = _phone(d.phone)
    a.is_default = d.is_default or not existing or (a.is_default and address_id is not None)
    uow.addresses.save(a)
    if a.is_default:
        _make_default(uow, user_id, a)
    uow.commit()
    return a


def set_default_address(uow: UnitOfWork, user_id: int, address_id: int) -> Address:
    a = _own_address(uow, user_id, address_id)
    a.is_default = True
    uow.addresses.save(a)
    _make_default(uow, user_id, a)
    uow.commit()
    return a


def delete_address(uow: UnitOfWork, user_id: int, address_id: int) -> None:
    a = _own_address(uow, user_id, address_id)
    uow.addresses.delete(a.id)
    rest = uow.addresses.of_user(user_id)
    if a.is_default and rest:  # основной адрес переходит к следующему
        rest[0].is_default = True
        uow.addresses.save(rest[0])
    uow.commit()


# ---------------- уведомления ----------------
def mark_read(uow: UnitOfWork, user_id: int, ids: list[int] | None = None) -> None:
    uow.notifications.mark_read(user_id, ids)
    uow.commit()


# ---------------- обращения ----------------
def _own_ticket(uow: UnitOfWork, user: User, number: int) -> Ticket:
    t = uow.tickets.get(number)
    if not t or (t.user_id != user.id and user.role != Role.ADMIN):
        raise NotFound("Обращение не найдено")
    return t


def create_ticket(uow: UnitOfWork, user: User, topic: str, text: str, order_code: str = "") -> Ticket:
    if topic not in TICKET_TOPICS:
        raise DomainError("Выберите тему обращения")
    order_code = (order_code or "").strip()
    if order_code and not any(o.code == order_code for o in uow.orders.by_user(user.id)):
        raise DomainError("Заказ не найден среди ваших заказов")
    t = Ticket(number=None, user_id=user.id, topic=topic, order_code=order_code,
               messages=[TicketMessage("customer", user.name, _text(text, "Сообщение", 2000))])
    uow.tickets.add(t)
    uow.commit()
    return t


def tickets_of(uow: UnitOfWork, user: User) -> list[Ticket]:
    return uow.tickets.list(user.id)


def get_ticket(uow: UnitOfWork, user: User, number: int) -> Ticket:
    return _own_ticket(uow, user, number)


def add_message(uow: UnitOfWork, user: User, number: int, text: str) -> Ticket:
    """Сообщение в обращении: покупатель дописывает вопрос, администратор отвечает."""
    t = _own_ticket(uow, user, number)
    if t.status == TicketStatus.CLOSED and user.role != Role.ADMIN:
        raise Forbidden("Обращение закрыто — создайте новое")
    support = user.role == Role.ADMIN
    t.messages.append(TicketMessage("support" if support else "customer", user.name, _text(text, "Сообщение", 2000)))
    if support:
        t.status, t.assignee = TicketStatus.ANSWERED, t.assignee or user.name
    elif t.status == TicketStatus.ANSWERED:
        t.status = TicketStatus.IN_WORK
    uow.tickets.save(t)
    uow.commit()
    return t


def set_ticket_status(uow: UnitOfWork, admin: User, number: int, status: TicketStatus) -> Ticket:
    t = _own_ticket(uow, admin, number)
    t.status = status
    if status == TicketStatus.IN_WORK and not t.assignee:
        t.assignee = admin.name
    uow.tickets.save(t)
    uow.commit()
    return t
