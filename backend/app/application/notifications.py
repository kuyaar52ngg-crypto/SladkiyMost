"""Уведомления о заказах и волнах: администраторам и покупателю (если он подключил Telegram)."""
from __future__ import annotations

from html import escape
from typing import Sequence

from app.domain.entities import ORDER_STATUS_TITLES, WAVE_STATUS_TITLES, Order, OrderStatus, Wave

from .ports import Notifier, UnitOfWork


def _rub(n: int) -> str:
    return f"{n:,}".replace(",", " ") + " ₽"


def _admin_chats(uow: UnitOfWork) -> list[int]:
    return [u.tg_chat_id for u in uow.users.admins() if u.tg_chat_id]


def _customer_chat(uow: UnitOfWork, o: Order) -> int | None:
    user = uow.users.get(o.user_id) if o.user_id is not None else None
    return user.tg_chat_id if user else None


def _send(notifier: Notifier, chats: Sequence[int | None], text: str, link: str | None = None) -> None:
    for chat in dict.fromkeys(c for c in chats if c):
        notifier.send(chat, text, link)


def _items(o: Order) -> str:
    return "\n".join(f"• {escape(i.name)} × {i.qty}" for i in o.items)


def order_placed(uow: UnitOfWork, notifier: Notifier, o: Order, site_url: str) -> None:
    kind = "🎁 подарок" if o.gift else "для организации" if o.company else "для себя"
    _send(notifier, _admin_chats(uow),
          f"🆕 <b>Новый заказ {o.code}</b> · {kind}\n{escape(o.direction.title)}\n{_items(o)}\n"
          f"Сумма: <b>{_rub(o.total_rub)}</b>\nПокупатель: {escape(o.customer_name)}, {escape(o.customer_phone)}\n"
          f"Получатель: {escape(o.recipient.name)}, {escape(o.recipient.city)}", f"{site_url}/admin/orders")
    _send(notifier, [_customer_chat(uow, o)],
          f"✅ <b>Заказ {o.code} оформлен</b>\n{_items(o)}\nОплачено: {_rub(o.total_rub)}\n"
          "Сообщим о каждом этапе доставки.", f"{site_url}/orders/{o.code}")


def order_status_changed(uow: UnitOfWork, notifier: Notifier, o: Order, site_url: str) -> None:
    if o.status == OrderStatus.CANCELLED:
        return order_cancelled(uow, notifier, o, site_url, by_customer=False)
    _send(notifier, [_customer_chat(uow, o)],
          f"📦 Заказ {o.code}: <b>{ORDER_STATUS_TITLES[o.status]}</b>", f"{site_url}/orders/{o.code}")


def order_cancelled(uow: UnitOfWork, notifier: Notifier, o: Order, site_url: str, by_customer: bool) -> None:
    who = "покупателем" if by_customer else "магазином"
    _send(notifier, [_customer_chat(uow, o)], f"❌ Заказ {o.code} отменён {who}. Деньги вернём на карту.",
          f"{site_url}/orders/{o.code}")
    _send(notifier, _admin_chats(uow),
          f"❌ Заказ {o.code} отменён {who} · {_rub(o.total_rub)}\n{escape(o.customer_name)}, {escape(o.customer_phone)}",
          f"{site_url}/admin/orders")


def wave_status_changed(uow: UnitOfWork, notifier: Notifier, w: Wave, site_url: str, auto: bool = False) -> None:
    orders = [o for o in uow.orders.list(wave_id=w.id) if o.status != OrderStatus.CANCELLED]
    note = " (автоматически: истёк срок приёма)" if auto else ""
    _send(notifier, _admin_chats(uow),
          f"🚚 Волна {escape(w.direction.title)}, отправка {w.departure:%d.%m}: "
          f"<b>{WAVE_STATUS_TITLES[w.status]}</b>{note}\nЗаказов: {len(orders)}", f"{site_url}/admin/waves")
    for o in orders:
        _send(notifier, [_customer_chat(uow, o)],
              f"📦 Заказ {o.code}: <b>{ORDER_STATUS_TITLES[o.status]}</b>", f"{site_url}/orders/{o.code}")
