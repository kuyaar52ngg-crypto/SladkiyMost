"""Сценарии заказа: расчёт, оформление, отмена, отслеживание, смена статуса."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Sequence

from app.domain import logistics as L
from app.domain.entities import (
    REGION_INFO,
    GiftCard,
    LineItem,
    Order,
    OrderEvent,
    OrderKind,
    OrderStatus,
    ReceiveMethod,
    Recipient,
    Role,
    User,
)
from app.domain.errors import Conflict, DomainError, Forbidden, NotFound

from .ports import UnitOfWork
from .waves import WaveView, get_wave_view


@dataclass(frozen=True)
class CartLine:
    product_id: str
    qty: int


@dataclass(frozen=True)
class QuoteRequest:
    items: Sequence[CartLine]
    wave_id: str
    thermo: bool = False
    gift: bool = False
    receive: ReceiveMethod = ReceiveMethod.PICKUP


@dataclass(frozen=True)
class PlaceOrderCommand:
    quote: QuoteRequest
    customer_name: str
    customer_phone: str
    recipient_name: str
    recipient_phone: str
    address: str = ""          # для курьера
    pickup_point: str = ""     # для пункта выдачи
    gift_message: str = ""
    gift_signature: str = ""
    gift_card: str = "classic"
    gift_surprise: bool = False
    b2b: bool = False
    company: str = ""
    payment: str = "card"
    consent: bool = False
    user_id: int | None = None


PHONE_RE = re.compile(r"^[+\d][\d\s()\-]{9,}$")


def phone_digits(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")[-10:]


def parse_code(code: str) -> int:
    m = re.search(r"(\d+)$", code or "")
    if not m:
        raise NotFound("Заказ не найден")
    return int(m.group(1))


def resolve_items(uow: UnitOfWork, lines: Sequence[CartLine]) -> list[LineItem]:
    if not lines:
        raise DomainError("Корзина пуста")
    products = uow.products.get_many([l.product_id for l in lines])
    items = []
    for l in lines:
        p = products.get(l.product_id)
        if not p:
            raise NotFound(f"Товар {l.product_id} не найден")
        if not p.active:
            raise DomainError(f"«{p.name}» сейчас недоступен")
        items.append(LineItem.of(p, max(1, min(50, int(l.qty)))))
    if len({i.region for i in items}) > 1:
        raise DomainError("В одну отправку входят сладости одного региона")
    return items


def quote_order(uow: UnitOfWork, today: date, req: QuoteRequest,
                p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> tuple[list[LineItem], WaveView, L.Quote]:
    items = resolve_items(uow, req.items)
    view = get_wave_view(uow, today, req.wave_id, p)
    if view.wave.direction.origin != items[0].region:
        raise DomainError("Волна не соответствует региону товаров")
    q = L.quote(items, view.wave, view.load_kg, thermo=req.thermo, gift=req.gift, receive=req.receive, p=p)
    return items, view, q


def _required(value: str, message: str) -> str:
    value = (value or "").strip()
    if not value:
        raise DomainError(message)
    return value[:300]


def place_order(uow: UnitOfWork, today: date, cmd: PlaceOrderCommand,
                p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> Order:
    items, view, q = quote_order(uow, today, cmd.quote, p)
    if not view.open:
        raise Conflict("Приём заказов в эту волну закрыт — выберите следующую")
    if not q.fits:
        raise Conflict("Партия заполнена — выберите следующую волну")
    name = _required(cmd.customer_name, "Укажите ваше имя")
    phone = _required(cmd.customer_phone, "Укажите ваш телефон")
    if not PHONE_RE.match(phone):
        raise DomainError("Проверьте номер телефона")
    dest = view.wave.direction.destination
    courier = cmd.quote.receive == ReceiveMethod.COURIER
    recipient = Recipient(
        name=_required(cmd.recipient_name, "Укажите имя получателя"),
        phone=_required(cmd.recipient_phone, "Укажите телефон получателя"),
        region=dest, city=REGION_INFO[dest]["city"], receive=cmd.quote.receive,
        address=_required(cmd.address, "Укажите адрес доставки") if courier
        else _required(cmd.pickup_point, "Выберите пункт выдачи"),
    )
    if not cmd.consent:
        raise DomainError("Нужно согласие с условиями заказа")
    gift = GiftCard(cmd.gift_message[:200], cmd.gift_signature[:60], cmd.gift_card[:20] or "classic",
                    cmd.gift_surprise) if cmd.quote.gift else None
    order = Order(
        number=uow.orders.next_number(),
        created_at=datetime.now(timezone.utc),
        customer_name=name[:120], customer_phone=phone,
        recipient=recipient, items=items,
        direction=view.wave.direction, wave_id=view.wave.id,
        goods_rub=q.goods_rub, weight_kg=q.weight_kg, rate_rub=q.rate,
        delivery_rub=q.delivery_rub, thermo_rub=q.thermo_rub, gift_rub=q.gift_rub,
        receive_rub=q.receive_rub, total_rub=q.total_rub,
        kind=OrderKind.GIFT if gift else OrderKind.B2B if cmd.b2b else OrderKind.SELF,
        gift=gift, company=cmd.company[:120] if cmd.b2b else None,
        payment_method="СБП" if cmd.payment == "sbp" else "Банковская карта",
        history=[OrderEvent(OrderStatus.ACCEPTED, today, "Заказ принят и оплачен (имитация оплаты)")],
        user_id=cmd.user_id,
    )
    uow.orders.add(order)
    uow.commit()
    return order


def get_order(uow: UnitOfWork, code: str) -> Order:
    o = uow.orders.get(parse_code(code))
    if not o:
        raise NotFound("Заказ не найден")
    return o


def can_access(o: Order, viewer: User | None, phone: str = "") -> bool:
    """Заказ видят администратор, владелец аккаунта и тот, кто знает телефон покупателя или получателя."""
    if viewer and (viewer.role == Role.ADMIN or (o.user_id is not None and o.user_id == viewer.id)):
        return True
    d = phone_digits(phone)
    return len(d) == 10 and d in (phone_digits(o.customer_phone), phone_digits(o.recipient.phone))


def view_order(uow: UnitOfWork, code: str, viewer: User | None, phone: str = "") -> Order:
    o = get_order(uow, code)
    if not can_access(o, viewer, phone):
        raise Forbidden("Укажите телефон, на который оформлен заказ")
    return o


def orders_of_user(uow: UnitOfWork, user: User) -> list[Order]:
    return uow.orders.by_user(user.id) if user.id is not None else []


def cancel_order(uow: UnitOfWork, today: date, code: str, viewer: User | None, phone: str = "") -> Order:
    o = get_order(uow, code)
    owner = viewer is not None and o.user_id is not None and o.user_id == viewer.id
    if not owner and phone_digits(o.customer_phone) != phone_digits(phone):
        raise Forbidden("Нет доступа к заказу")
    if o.status != OrderStatus.ACCEPTED:
        raise Conflict("Заказ уже собирается — отмена через поддержку")
    o.move_to(OrderStatus.CANCELLED, today, "Отменён покупателем, деньги возвращены (имитация)")
    uow.orders.save(o)
    uow.commit()
    return o


def change_order_status(uow: UnitOfWork, today: date, code: str, status: OrderStatus) -> Order:
    o = get_order(uow, code)
    o.move_to(status, today, "Изменено администратором")
    uow.orders.save(o)
    uow.commit()
    return o


def all_orders(uow: UnitOfWork, status: OrderStatus | None = None, wave_id: str | None = None) -> list[Order]:
    return sorted(uow.orders.list(status=status, wave_id=wave_id), key=lambda o: o.number, reverse=True)

