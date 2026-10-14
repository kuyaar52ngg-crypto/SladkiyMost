"""Реализация портов application на SQLAlchemy + PostgreSQL."""
from __future__ import annotations

from typing import Sequence

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.application.orders import phone_digits
from app.application.ports import ProductFilter
from app.domain.entities import (
    Direction,
    GiftCard,
    LineItem,
    Order,
    OrderEvent,
    OrderKind,
    OrderStatus,
    Product,
    ReceiveMethod,
    Recipient,
    Region,
    Role,
    User,
    Wave,
    WaveStatus,
)

from .models import OrderEventRow, OrderItemRow, OrderRow, ProductPhotoRow, ProductRow, UserRow, WaveRow

# ---------------- products ----------------
PRODUCT_FIELDS = ("manufacturer", "name", "category", "weight_g", "price_rub", "temp_sensitive",
                  "shelf_life_days", "photo", "description", "composition", "tag", "active")


def _product(r: ProductRow) -> Product:
    return Product(id=r.id, region=Region(r.region), photos=[ph.url for ph in r.photos] or [r.photo],
                   created_at=r.created_at, **{f: getattr(r, f) for f in PRODUCT_FIELDS})


class SqlProductRepository:
    def __init__(self, s: Session):
        self.s = s

    def list(self, f: ProductFilter) -> list[Product]:
        q = select(ProductRow).order_by(ProductRow.created_at.desc(), ProductRow.id)
        if not f.include_inactive:
            q = q.where(ProductRow.active.is_(True))
        if f.regions:
            q = q.where(ProductRow.region.in_(f.regions))
        if f.categories:
            q = q.where(ProductRow.category.in_(f.categories))
        if f.query:
            like = f"%{f.query.strip()}%"
            q = q.where(or_(ProductRow.name.ilike(like), ProductRow.description.ilike(like), ProductRow.category.ilike(like)))
        if f.min_price is not None:
            q = q.where(ProductRow.price_rub >= f.min_price)
        if f.max_price is not None:
            q = q.where(ProductRow.price_rub <= f.max_price)
        return [_product(r) for r in self.s.scalars(q)]

    def get(self, product_id: str) -> Product | None:
        r = self.s.get(ProductRow, product_id)
        return _product(r) if r else None

    def get_many(self, ids: Sequence[str]) -> dict[str, Product]:
        if not ids:
            return {}
        return {r.id: _product(r) for r in self.s.scalars(select(ProductRow).where(ProductRow.id.in_(ids)))}

    def save(self, p: Product) -> None:
        r = self.s.get(ProductRow, p.id) or ProductRow(id=p.id)
        r.region = p.region.value
        for f in PRODUCT_FIELDS:
            setattr(r, f, getattr(p, f))
        urls = p.photos or [p.photo]
        if [ph.url for ph in r.photos] != urls:
            r.photos = [ProductPhotoRow(url=u, position=i) for i, u in enumerate(urls)]
        self.s.add(r)
        self.s.flush()

    def delete(self, product_id: str) -> None:
        r = self.s.get(ProductRow, product_id)
        if r:
            self.s.delete(r)
            self.s.flush()

    def ids_with_prefix(self, prefix: str) -> list[str]:
        return list(self.s.scalars(select(ProductRow.id).where(ProductRow.id.like(f"{prefix}-%"))))


# ---------------- waves ----------------
WAVE_FIELDS = ("departure", "cutoff", "arrival_from", "arrival_to", "off_season", "base_load_kg",
               "final_load_kg", "final_rate")


def _wave(r: WaveRow) -> Wave:
    return Wave(id=r.id, direction=Direction(r.direction), status=WaveStatus(r.status),
                **{f: getattr(r, f) for f in WAVE_FIELDS})


class SqlWaveRepository:
    def __init__(self, s: Session):
        self.s = s

    def list(self, direction: Direction | None = None) -> list[Wave]:
        q = select(WaveRow).order_by(WaveRow.departure, WaveRow.direction)
        if direction:
            q = q.where(WaveRow.direction == direction.value)
        return [_wave(r) for r in self.s.scalars(q)]

    def get(self, wave_id: str) -> Wave | None:
        r = self.s.get(WaveRow, wave_id)
        return _wave(r) if r else None

    def existing_ids(self) -> set[str]:
        return set(self.s.scalars(select(WaveRow.id)))

    def add(self, w: Wave) -> None:
        self.save(w)

    def save(self, w: Wave) -> None:
        r = self.s.get(WaveRow, w.id) or WaveRow(id=w.id)
        r.direction = w.direction.value
        r.status = w.status.value
        for f in WAVE_FIELDS:
            setattr(r, f, getattr(w, f))
        self.s.add(r)
        self.s.flush()

    def orders_weight(self) -> dict[str, float]:
        q = (select(OrderRow.wave_id, func.sum(OrderRow.weight_kg))
             .where(OrderRow.status != OrderStatus.CANCELLED.value).group_by(OrderRow.wave_id))
        return {wid: float(total) for wid, total in self.s.execute(q)}


# ---------------- orders ----------------
def _order(r: OrderRow) -> Order:
    gift = GiftCard(r.gift_message or "", r.gift_signature or "", r.gift_card or "classic", bool(r.gift_surprise)) \
        if r.kind == OrderKind.GIFT.value else None
    return Order(
        number=r.number, created_at=r.created_at,
        customer_name=r.customer_name, customer_phone=r.customer_phone,
        recipient=Recipient(r.recipient_name, r.recipient_phone, Region(r.recipient_region), r.recipient_city,
                            ReceiveMethod(r.receive), r.address),
        items=[LineItem(i.product_id, i.name, Region(i.region), i.photo, i.weight_g, i.price_rub, i.temp_sensitive, i.qty)
               for i in r.items],
        direction=Direction(r.direction), wave_id=r.wave_id,
        goods_rub=r.goods_rub, weight_kg=r.weight_kg, rate_rub=r.rate_rub, delivery_rub=r.delivery_rub,
        thermo_rub=r.thermo_rub, gift_rub=r.gift_rub, receive_rub=r.receive_rub, total_rub=r.total_rub,
        kind=OrderKind(r.kind), gift=gift, company=r.company, payment_method=r.payment_method,
        status=OrderStatus(r.status), refund_rub=r.refund_rub, final_delivery_rub=r.final_delivery_rub,
        history=[OrderEvent(OrderStatus(e.status), e.date, e.note) for e in r.events],
        user_id=r.user_id,
    )


def _fill_row(r: OrderRow, o: Order) -> None:
    rc = o.recipient
    r.customer_name, r.customer_phone, r.customer_phone_digits = o.customer_name, o.customer_phone, phone_digits(o.customer_phone)
    r.recipient_name, r.recipient_phone, r.recipient_phone_digits = rc.name, rc.phone, phone_digits(rc.phone)
    r.recipient_region, r.recipient_city, r.receive, r.address = rc.region.value, rc.city, rc.receive.value, rc.address
    r.kind, r.company = o.kind.value, o.company
    if o.gift:
        r.gift_message, r.gift_signature, r.gift_card, r.gift_surprise = o.gift.message, o.gift.signature, o.gift.card, o.gift.surprise
    r.direction, r.wave_id = o.direction.value, o.wave_id
    for f in ("goods_rub", "weight_kg", "rate_rub", "delivery_rub", "thermo_rub", "gift_rub", "receive_rub",
              "total_rub", "refund_rub", "final_delivery_rub", "payment_method", "created_at"):
        setattr(r, f, getattr(o, f))
    r.status = o.status.value
    r.user_id = o.user_id
    # история — только дописывается
    for e in o.history[len(r.events):]:
        r.events.append(OrderEventRow(status=e.status.value, date=e.date, note=e.note))


class SqlOrderRepository:
    def __init__(self, s: Session):
        self.s = s

    def next_number(self) -> int:
        return int(self.s.execute(text("SELECT nextval(pg_get_serial_sequence('orders', 'number'))")).scalar_one())

    def add(self, o: Order) -> None:
        r = OrderRow(number=o.number)
        r.items = [OrderItemRow(product_id=i.product_id, name=i.name, region=i.region.value, photo=i.photo,
                                weight_g=i.weight_g, price_rub=i.price_rub, temp_sensitive=i.temp_sensitive, qty=i.qty)
                   for i in o.items]
        r.events = []
        _fill_row(r, o)
        self.s.add(r)
        self.s.flush()

    def save(self, o: Order) -> None:
        r = self.s.get(OrderRow, o.number)
        if r is None:
            return self.add(o)
        _fill_row(r, o)
        self.s.flush()

    def get(self, number: int) -> Order | None:
        r = self.s.get(OrderRow, number)
        return _order(r) if r else None

    def list(self, *, status: OrderStatus | None = None, wave_id: str | None = None) -> list[Order]:
        q = select(OrderRow).order_by(OrderRow.number)
        if status:
            q = q.where(OrderRow.status == status.value)
        if wave_id:
            q = q.where(OrderRow.wave_id == wave_id)
        return [_order(r) for r in self.s.scalars(q)]


    def by_user(self, user_id: int) -> list[Order]:
        q = select(OrderRow).where(OrderRow.user_id == user_id).order_by(OrderRow.number.desc())
        return [_order(r) for r in self.s.scalars(q)]

    def has_product(self, product_id: str) -> bool:
        q = select(OrderItemRow.id).where(OrderItemRow.product_id == product_id).limit(1)
        return self.s.scalar(q) is not None


# ---------------- users ----------------
USER_FIELDS = ("phone", "name", "email", "password_hash", "tg_chat_id", "tg_link_token", "failed_logins",
               "locked_until")


def _user(r: UserRow) -> User:
    return User(id=r.id, role=Role(r.role), created_at=r.created_at, **{f: getattr(r, f) for f in USER_FIELDS})


class SqlUserRepository:
    def __init__(self, s: Session):
        self.s = s

    def get(self, user_id: int) -> User | None:
        r = self.s.get(UserRow, user_id)
        return _user(r) if r else None

    def by_phone(self, digits: str) -> User | None:
        r = self.s.scalar(select(UserRow).where(UserRow.phone_digits == digits))
        return _user(r) if r else None

    def by_link_token(self, token: str) -> User | None:
        r = self.s.scalar(select(UserRow).where(UserRow.tg_link_token == token))
        return _user(r) if r else None

    def admins(self) -> list[User]:
        return [_user(r) for r in self.s.scalars(select(UserRow).where(UserRow.role == Role.ADMIN.value))]

    def add(self, u: User) -> None:
        r = UserRow()
        self._fill(r, u)
        self.s.add(r)
        self.s.flush()
        u.id, u.created_at = r.id, r.created_at

    def save(self, u: User) -> None:
        r = self.s.get(UserRow, u.id)
        if r is None:
            return self.add(u)
        self._fill(r, u)
        self.s.flush()

    @staticmethod
    def _fill(r: UserRow, u: User) -> None:
        r.role, r.phone_digits = u.role.value, phone_digits(u.phone)
        for f in USER_FIELDS:
            setattr(r, f, getattr(u, f))
