"""DTO API (Pydantic) и отображение доменных объектов в ответы."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.application.analytics import Stats
from app.application.waves import WaveOffer, WaveView
from app.domain import logistics as L
from app.domain.entities import (
    ORDER_STATUS_TITLES,
    WAVE_STATUS_TITLES,
    Order,
    OrderStatus,
    Product,
    ReceiveMethod,
    Region,
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
    phone: str


class OrderStatusIn(BaseModel):
    status: OrderStatus


class WaveStatusIn(BaseModel):
    status: WaveStatus


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    region: Region
    manufacturer: str = ""
    category: str
    weight_g: int = Field(gt=0)
    price_rub: int = Field(gt=0)
    temp_sensitive: bool = False
    shelf_life_days: int = Field(30, gt=0)
    photo: str = "/img/gift.jpg"
    description: str = ""
    composition: str = ""
    tag: str = ""
    active: bool = True


class ActiveIn(BaseModel):
    active: bool


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

    @classmethod
    def of(cls, p: Product) -> "ProductOut":
        return cls(**p.__dict__)


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
