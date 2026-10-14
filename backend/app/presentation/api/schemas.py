"""DTO API (Pydantic) и отображение доменных объектов в ответы."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.application.analytics import Stats
from app.application.waves import WaveOffer, WaveView
from app.domain import logistics as L
from app.domain.entities import (
    ORDER_STATUS_TITLES,
    TICKET_STATUS_TITLES,
    WAVE_STATUS_TITLES,
    Address,
    Notification,
    Order,
    OrderStatus,
    Product,
    ReceiveMethod,
    Region,
    Ticket,
    TicketStatus,
    User,
    WaveStatus,
)


# ---------------- запросы ----------------
class CartLineIn(BaseModel):
    id: str
    qty: int = Field(1, ge=1, le=50)


class OffersIn(BaseModel):
    items: list[CartLineIn] = Field(min_length=1)


class QuoteIn(BaseModel):
    items: list[CartLineIn] = Field(min_length=1)
    wave_id: str
    thermo: bool = False
    gift: bool = False
    receive: ReceiveMethod = ReceiveMethod.PICKUP


class EstimateIn(BaseModel):
    wave_id: str
    weight_kg: float = Field(gt=0, le=30)
    chocolate: bool = False


class OrderIn(QuoteIn):
    customer_name: str = ""
    customer_phone: str = ""
    recipient_name: str = ""
    recipient_phone: str = ""
    address: str = ""
    pickup_point: str = ""
    gift_message: str = Field("", max_length=200)
    gift_signature: str = Field("", max_length=60)
    gift_card: str = "classic"
    gift_surprise: bool = False
    b2b: bool = False
    company: str = ""
    payment: str = "card"
    consent: bool = False


class CancelIn(BaseModel):
    phone: str = ""


class OrderStatusIn(BaseModel):
    status: OrderStatus
    note: str = Field("", max_length=300)  # причина изменения — попадает в историю заказа


class WaveStatusIn(BaseModel):
    status: WaveStatus
    note: str = Field("", max_length=300)


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    region: Region
    manufacturer: str = ""
    category: str
    weight_g: int = Field(gt=0)
    price_rub: int = Field(gt=0)
    temp_sensitive: bool = False
    shelf_life_days: int = Field(30, gt=0)
    photos: list[str] = Field(min_length=1, max_length=10)
    description: str = Field("", max_length=4000)
    composition: str = Field("", max_length=4000)
    tag: str = Field("", max_length=40)
    active: bool = True


class ActiveIn(BaseModel):
    active: bool


class UploadIn(BaseModel):
    content_type: str
    size: int = Field(gt=0)


class RegisterIn(BaseModel):
    phone: str = Field(max_length=40)
    name: str = Field(max_length=120)
    password: str = Field(max_length=128)
    email: str | None = Field(None, max_length=160)
    tg_init_data: str = Field("", max_length=4096)  # из Telegram Mini App — сразу привязать Telegram


class LoginIn(BaseModel):
    phone: str = Field(max_length=40)
    password: str = Field(max_length=128)
    tg_init_data: str = Field("", max_length=4096)


class TelegramAuthIn(BaseModel):
    init_data: str = Field(max_length=4096)


# ---------------- ответы ----------------
class ProductOut(BaseModel):
    id: str
    region: Region
    manufacturer: str
    name: str
    category: str
    weight_g: int
    price_rub: int
    temp_sensitive: bool
    shelf_life_days: int
    photo: str
    description: str
    composition: str
    tag: str
    active: bool
    photos: list[str]

    @classmethod
    def of(cls, p: Product) -> "ProductOut":
        return cls(**{k: v for k, v in p.__dict__.items() if k != "created_at"})


class DeletedOut(BaseModel):
    deleted: bool


class UploadOut(BaseModel):
    upload_url: str
    public_url: str


class UserOut(BaseModel):
    id: int
    role: str
    name: str
    phone: str
    email: str | None
    telegram: bool
    region: Region | None = None
    notify_orders: bool = True
    notify_waves: bool = True
    notify_support: bool = True
    notify_news: bool = False
    gift_draft: dict | None = None
    token: str | None = None  # только для Telegram Mini App: сессия заголовком, если cookie недоступна

    @classmethod
    def of(cls, u: User) -> "UserOut":
        return cls(id=u.id, role=u.role.value, name=u.name, phone=u.phone, email=u.email, telegram=bool(u.tg_chat_id),
                   region=u.region, notify_orders=u.notify_orders, notify_waves=u.notify_waves,
                   notify_support=u.notify_support, notify_news=u.notify_news, gift_draft=u.gift_draft)


# ---------------- личный кабинет ----------------
class ProfileIn(BaseModel):
    name: str | None = Field(None, max_length=120)
    phone: str | None = Field(None, max_length=40)
    email: str | None = Field(None, max_length=160)
    region: Region | None = None
    notify_orders: bool | None = None
    notify_waves: bool | None = None
    notify_support: bool | None = None
    notify_news: bool | None = None


class PasswordIn(BaseModel):
    current: str = Field(max_length=128)
    new: str = Field(max_length=128)


class GiftDraftIn(BaseModel):
    recipient_name: str = Field("", max_length=120)
    recipient_phone: str = Field("", max_length=40)
    address: str = Field("", max_length=300)
    message: str = Field("", max_length=200)
    contact_first: bool = False


class AddressIn(BaseModel):
    title: str = Field("", max_length=60)
    name: str = Field(max_length=120)
    region: Region
    city: str = Field(max_length=60)
    line: str = Field(max_length=300)
    phone: str = Field(max_length=40)
    is_default: bool = False


class AddressOut(BaseModel):
    id: int
    title: str
    name: str
    region: Region
    city: str
    line: str
    phone: str
    is_default: bool

    @classmethod
    def of(cls, a: Address) -> "AddressOut":
        return cls(**{k: v for k, v in a.__dict__.items() if k != "user_id"})


class NotificationOut(BaseModel):
    id: int
    kind: str
    title: str
    body: str
    link: str
    created_at: datetime
    read: bool

    @classmethod
    def of(cls, n: Notification) -> "NotificationOut":
        return cls(id=n.id, kind=n.kind.value, title=n.title, body=n.body, link=n.link, created_at=n.created_at,
                   read=n.read)


class ReadIn(BaseModel):
    ids: list[int] | None = None  # None — отметить все


class TicketIn(BaseModel):
    topic: str = Field(max_length=60)
    order_code: str = Field("", max_length=20)
    text: str = Field(max_length=2000)


class MessageIn(BaseModel):
    text: str = Field(max_length=2000)


class TicketStatusIn(BaseModel):
    status: TicketStatus


class TicketMessageOut(BaseModel):
    author: str
    name: str
    text: str
    created_at: datetime | None


class TicketOut(BaseModel):
    number: int
    code: str
    topic: str
    order_code: str
    status: TicketStatus
    status_title: str
    assignee: str
    created_at: datetime
    messages: list[TicketMessageOut]
    customer_name: str = ""
    customer_phone: str = ""

    @classmethod
    def of(cls, t: Ticket, customer: User | None = None) -> "TicketOut":
        return cls(number=t.number, code=t.code, topic=t.topic, order_code=t.order_code, status=t.status,
                   status_title=TICKET_STATUS_TITLES[t.status], assignee=t.assignee, created_at=t.created_at,
                   messages=[TicketMessageOut(**m.__dict__) for m in t.messages],
                   customer_name=customer.name if customer else "", customer_phone=customer.phone if customer else "")


class CustomerOut(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None
    telegram: bool
    created_at: datetime | None
    orders: int
    active_orders: int
    spent_rub: int
    last_order: str | None


class LinkOut(BaseModel):
    url: str


class BotOut(BaseModel):
    username: str | None


class WaveOut(BaseModel):
    id: str
    direction: str
    title: str
    departure: date
    cutoff: date
    arrival_from: date
    arrival_to: date
    off_season: bool
    status: WaveStatus
    status_title: str
    load_kg: float
    fill: float
    rate: float
    discount_percent: int
    open: bool
    days_left: int
    orders_count: int
    final_rate: float | None
    final_load_kg: float | None

    @classmethod
    def of(cls, v: WaveView) -> "WaveOut":
        w = v.wave
        return cls(id=w.id, direction=w.direction.value, title=w.direction.title, departure=w.departure, cutoff=w.cutoff,
                   arrival_from=w.arrival_from, arrival_to=w.arrival_to, off_season=w.off_season, status=w.status,
                   status_title=WAVE_STATUS_TITLES[w.status], load_kg=v.load_kg, fill=v.fill, rate=v.rate,
                   discount_percent=v.discount_percent, open=v.open, days_left=v.days_left, orders_count=v.orders_count,
                   final_rate=w.final_rate, final_load_kg=w.final_load_kg)


class ThermoOut(BaseModel):
    sensitive: bool
    required: bool
    reason: str


class NextDiscountOut(BaseModel):
    need_kg: float
    rate: float
    percent: int


class QuoteOut(BaseModel):
    goods_rub: int
    net_kg: float
    weight_kg: float
    current_load_kg: float
    projected_load_kg: float
    fill: float
    fits: bool
    min_reached: bool
    rate: float
    discount_percent: int
    delivery_rub: int
    base_delivery_rub: int
    saving_rub: int
    next_discount: NextDiscountOut | None
    thermo: ThermoOut
    thermo_applied: bool
    thermo_rub: int
    gift_rub: int
    receive_rub: int
    total_rub: int

    @classmethod
    def of(cls, q: L.Quote) -> "QuoteOut":
        d = dict(q.__dict__)
        d["thermo"] = ThermoOut(**q.thermo.__dict__)
        d["next_discount"] = NextDiscountOut(**q.next_discount.__dict__) if q.next_discount else None
        return cls(**d)


class OfferOut(BaseModel):
    wave: WaveOut
    quote: QuoteOut | None

    @classmethod
    def of(cls, o: WaveOffer) -> "OfferOut":
        return cls(wave=WaveOut.of(o.view), quote=QuoteOut.of(o.quote) if o.quote else None)


class QuoteResponse(BaseModel):
    wave: WaveOut
    quote: QuoteOut


class LineItemOut(BaseModel):
    id: str
    name: str
    region: Region
    photo: str
    weight_g: int
    price_rub: int
    temp_sensitive: bool
    qty: int


class RecipientOut(BaseModel):
    name: str
    phone: str
    region: Region
    city: str
    receive: ReceiveMethod
    address: str


class GiftOut(BaseModel):
    message: str
    signature: str
    card: str
    surprise: bool


class EventOut(BaseModel):
    status: OrderStatus
    status_title: str
    date: date
    note: str


class OrderOut(BaseModel):
    code: str
    number: int
    created_at: datetime
    customer_name: str
    customer_phone: str
    recipient: RecipientOut
    items: list[LineItemOut]
    direction: str
    direction_title: str
    wave: WaveOut | None
    goods_rub: int
    weight_kg: float
    rate_rub: float
    delivery_rub: int
    thermo_rub: int
    gift_rub: int
    receive_rub: int
    total_rub: int
    refund_rub: int
    final_delivery_rub: int | None
    kind: str
    gift: GiftOut | None
    company: str | None
    payment_method: str
    status: OrderStatus
    status_title: str
    history: list[EventOut]

    @classmethod
    def of(cls, o: Order, wave: WaveView | None) -> "OrderOut":
        return cls(
            code=o.code, number=o.number, created_at=o.created_at, customer_name=o.customer_name,
            customer_phone=o.customer_phone, recipient=RecipientOut(**o.recipient.__dict__),
            items=[LineItemOut(id=i.product_id, **{k: v for k, v in i.__dict__.items() if k != "product_id"}) for i in o.items],
            direction=o.direction.value, direction_title=o.direction.title, wave=WaveOut.of(wave) if wave else None,
            goods_rub=o.goods_rub, weight_kg=o.weight_kg, rate_rub=o.rate_rub, delivery_rub=o.delivery_rub,
            thermo_rub=o.thermo_rub, gift_rub=o.gift_rub, receive_rub=o.receive_rub, total_rub=o.total_rub,
            refund_rub=o.refund_rub, final_delivery_rub=o.final_delivery_rub, kind=o.kind.value,
            gift=GiftOut(**o.gift.__dict__) if o.gift else None, company=o.company, payment_method=o.payment_method,
            status=o.status, status_title=ORDER_STATUS_TITLES[o.status],
            history=[EventOut(status=e.status, status_title=ORDER_STATUS_TITLES[e.status], date=e.date, note=e.note)
                     for e in o.history],
        )


class TopProductOut(BaseModel):
    id: str
    name: str
    qty: int


class CounterOut(BaseModel):
    direction: str
    title: str
    wave: WaveOut | None
    forecast_kg: int | None


class StatsOut(BaseModel):
    orders: int
    revenue: int
    avg_check: int
    gifts: int
    commission: int
    top: list[TopProductOut]
    by_status: dict[str, int]
    counter: list[CounterOut]

    @classmethod
    def of(cls, s: Stats) -> "StatsOut":
        return cls(orders=s.orders, revenue=s.revenue, avg_check=s.avg_check, gifts=s.gifts, commission=s.commission,
                   top=[TopProductOut(id=i, name=n, qty=q) for i, n, q in s.top], by_status=s.by_status,
                   counter=[CounterOut(direction=c.direction.value, title=c.direction.title,
                                       wave=WaveOut.of(c.wave) if c.wave else None, forecast_kg=c.forecast_kg)
                            for c in s.counter])
