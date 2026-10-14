"""Уведомления о заказах, партиях и обращениях.

Каждое уведомление пользователю записывается в ленту кабинета и, если подключён Telegram и включён
соответствующий канал в настройках, дублируется сообщением с кнопкой «Открыть».
"""
from __future__ import annotations

from html import escape

from app.domain.entities import (
    ORDER_STATUS_TITLES,
    TICKET_STATUS_TITLES,
    WAVE_STATUS_TITLES,
    Notification,
    NotificationKind,
    Order,
    OrderStatus,
    Ticket,
    User,
    Wave,
)

from .ports import Notifier, UnitOfWork

PREF = {
    NotificationKind.ORDER: "notify_orders",
    NotificationKind.WAVE: "notify_waves",
    NotificationKind.SUPPORT: "notify_support",
    NotificationKind.NEWS: "notify_news",
}


def _rub(n: int) -> str:
    return f"{n:,}".replace(",", " ") + " ₽"


def _deliver(uow: UnitOfWork, notifier: Notifier, user: User | None, kind: NotificationKind, title: str, body: str,
             link: str = "", telegram: str | None = None) -> None:
    """Лента кабинета + Telegram. telegram — отдельный (HTML) текст сообщения, по умолчанию заголовок и текст."""
    if not user or user.id is None:
        return
    uow.notifications.add(Notification(id=None, user_id=user.id, kind=kind, title=title, body=body, link=link))
    if user.tg_chat_id and getattr(user, PREF[kind]):
        notifier.send(user.tg_chat_id, telegram or f"<b>{escape(title)}</b>\n{escape(body)}", link or None)


def _admins(uow: UnitOfWork) -> list[User]:
    return uow.users.admins()


def _customer(uow: UnitOfWork, o: Order) -> User | None:
    return uow.users.get(o.user_id) if o.user_id is not None else None


def _items(o: Order) -> str:
    return "\n".join(f"• {escape(i.name)} × {i.qty}" for i in o.items)


def _items_short(o: Order) -> str:
    return ", ".join(f"{i.name} × {i.qty}" for i in o.items)


def order_placed(uow: UnitOfWork, notifier: Notifier, o: Order, site_url: str) -> None:
    kind = "🎁 подарок" if o.gift else "для организации" if o.company else "для себя"
    for admin in _admins(uow):
        _deliver(uow, notifier, admin, NotificationKind.ORDER, f"Новый заказ {o.code}",
                 f"{o.direction.title} · {_items_short(o)} · {_rub(o.total_rub)} · {o.customer_name}",
                 f"{site_url}/admin/orders/{o.code}",
                 f"🆕 <b>Новый заказ {o.code}</b> · {kind}\n{escape(o.direction.title)}\n{_items(o)}\n"
                 f"Сумма: <b>{_rub(o.total_rub)}</b>\nПокупатель: {escape(o.customer_name)}, "
                 f"{escape(o.customer_phone)}\nПолучатель: {escape(o.recipient.name)}, {escape(o.recipient.city)}")
    _deliver(uow, notifier, _customer(uow, o), NotificationKind.ORDER, f"Заказ {o.code} принят",
             f"{_items_short(o)}. Сумма {_rub(o.total_rub)}. Сообщим о каждом этапе доставки.",
             f"{site_url}/account/orders/{o.code}",
             f"✅ <b>Заказ {o.code} принят</b>\n{_items(o)}\nСумма: {_rub(o.total_rub)}\n"
             "Сообщим о каждом этапе доставки.")
    uow.commit()


def order_status_changed(uow: UnitOfWork, notifier: Notifier, o: Order, site_url: str) -> None:
    if o.status == OrderStatus.CANCELLED:
        return order_cancelled(uow, notifier, o, site_url, by_customer=False)
    title = f"Заказ {o.code}: {ORDER_STATUS_TITLES[o.status].lower()}"
    _deliver(uow, notifier, _customer(uow, o), NotificationKind.ORDER, title, _status_hint(o),
             f"{site_url}/account/orders/{o.code}",
             f"📦 Заказ {o.code}: <b>{ORDER_STATUS_TITLES[o.status]}</b>\n{escape(_status_hint(o))}")
    uow.commit()


def _status_hint(o: Order) -> str:
    return {
        OrderStatus.ASSEMBLING: "Приём в партию закрыт, заказ готовится к отправке.",
        OrderStatus.TRANSIT: "Партия в пути.",
        OrderStatus.PICKUP: "Заказ прибыл — можно получать.",
        OrderStatus.RECEIVED: "Заказ получен. Спасибо, что выбрали «Сладкий мост»!",
    }.get(o.status, "Статус заказа обновлён.")


def order_cancelled(uow: UnitOfWork, notifier: Notifier, o: Order, site_url: str, by_customer: bool) -> None:
    who = "покупателем" if by_customer else "магазином"
    _deliver(uow, notifier, _customer(uow, o), NotificationKind.ORDER, f"Заказ {o.code} отменён",
             f"Заказ отменён {who}. Деньги вернём на карту.", f"{site_url}/account/orders/{o.code}",
             f"❌ Заказ {o.code} отменён {who}. Деньги вернём на карту.")
    for admin in _admins(uow):
        _deliver(uow, notifier, admin, NotificationKind.ORDER, f"Заказ {o.code} отменён {who}",
                 f"{_rub(o.total_rub)} · {o.customer_name}, {o.customer_phone}",
                 f"{site_url}/admin/orders/{o.code}",
                 f"❌ Заказ {o.code} отменён {who} · {_rub(o.total_rub)}\n"
                 f"{escape(o.customer_name)}, {escape(o.customer_phone)}")
    uow.commit()


def wave_status_changed(uow: UnitOfWork, notifier: Notifier, w: Wave, site_url: str, auto: bool = False) -> None:
    orders = [o for o in uow.orders.list(wave_id=w.id) if o.status != OrderStatus.CANCELLED]
    note = " (автоматически: истёк срок приёма)" if auto else ""
    title = f"Партия {w.direction.title}, отправка {w.departure:%d.%m}: {WAVE_STATUS_TITLES[w.status].lower()}"
    for admin in _admins(uow):
        _deliver(uow, notifier, admin, NotificationKind.WAVE, title, f"Заказов: {len(orders)}{note}",
                 f"{site_url}/admin/waves/{w.id}",
                 f"🚚 Партия {escape(w.direction.title)}, отправка {w.departure:%d.%m}: "
                 f"<b>{WAVE_STATUS_TITLES[w.status]}</b>{note}\nЗаказов: {len(orders)}")
    for o in orders:
        _deliver(uow, notifier, _customer(uow, o), NotificationKind.WAVE,
                 f"Заказ {o.code}: {ORDER_STATUS_TITLES[o.status].lower()}", _status_hint(o),
                 f"{site_url}/account/orders/{o.code}",
                 f"📦 Заказ {o.code}: <b>{ORDER_STATUS_TITLES[o.status]}</b>\n{escape(_status_hint(o))}")
    uow.commit()


def ticket_created(uow: UnitOfWork, notifier: Notifier, t: Ticket, site_url: str) -> None:
    author = uow.users.get(t.user_id)
    text = t.messages[-1].text if t.messages else ""
    for admin in _admins(uow):
        _deliver(uow, notifier, admin, NotificationKind.SUPPORT, f"Обращение {t.code}: {t.topic}",
                 f"{author.name if author else ''}{' · ' + t.order_code if t.order_code else ''}: {text[:200]}",
                 f"{site_url}/admin/customers?ticket={t.number}")
    uow.commit()


def ticket_updated(uow: UnitOfWork, notifier: Notifier, t: Ticket, site_url: str, by_support: bool) -> None:
    last = t.messages[-1].text if t.messages else ""
    if by_support:
        _deliver(uow, notifier, uow.users.get(t.user_id), NotificationKind.SUPPORT,
                 f"Обращение {t.code}: {TICKET_STATUS_TITLES[t.status].lower()}", last[:300],
                 f"{site_url}/account/support?ticket={t.number}")
    else:
        for admin in _admins(uow):
            _deliver(uow, notifier, admin, NotificationKind.SUPPORT, f"Новое сообщение в обращении {t.code}",
                     last[:200], f"{site_url}/admin/customers?ticket={t.number}")
    uow.commit()
