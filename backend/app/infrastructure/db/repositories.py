"""Реализация портов application на SQLAlchemy + PostgreSQL."""
from __future__ import annotations

from typing import Sequence

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.application.orders import phone_digits
from app.application.ports import ProductFilter
from app.domain.entities import (
    Address,
    Category,
    Direction,
    GiftCard,
    LineItem,
    Notification,
    NotificationKind,
    Order,
    OrderEvent,
    OrderKind,
    OrderStatus,
    Product,
    ReceiveMethod,
    Recipient,
    Region,
    PrepEvent,
    Review,
    ReviewStatus,
    PrepStatus,
    Role,
    Shop,
    ShopOrder,
    ShopStatus,
    Ticket,
    TicketMessage,
    TicketStatus,
    User,
    Wave,
    WaveStatus,
)

from .models import (
    AddressRow,
    CategoryRow,
    NotificationRow,
    OrderEventRow,
    OrderItemRow,
    OrderRow,
    ProductPhotoRow,
    ProductRow,
    ReviewRow,
    SettingRow,
    ShopOrderRow,
    ShopRow,
    TicketMessageRow,
    TicketRow,
    UserRow,
    WaveRow,
)

# ---------------- products ----------------
PRODUCT_FIELDS = ("manufacturer", "name", "category", "weight_g", "price_rub", "temp_sensitive",
                  "shelf_life_days", "photo", "description", "composition", "tag", "active", "shop_id", "review")


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
        if f.shop_id is not None:
            q = q.where(ProductRow.shop_id == f.shop_id)
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

    def delete(self, wave_id: str) -> None:
        r = self.s.get(WaveRow, wave_id)
        if r:
            self.s.flush()  # перенос заказов должен попасть в базу раньше удаления (внешний ключ)
            self.s.delete(r)
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
               "locked_until", "notify_orders", "notify_waves", "notify_support", "notify_news", "gift_draft", "shop_id")


def _user(r: UserRow) -> User:
    return User(id=r.id, role=Role(r.role), created_at=r.created_at, region=Region(r.region) if r.region else None,
                **{f: getattr(r, f) for f in USER_FIELDS})


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

    def by_chat(self, chat_id: int) -> User | None:
        rows = list(self.s.scalars(select(UserRow).where(UserRow.tg_chat_id == chat_id).order_by(UserRow.id)))
        rows.sort(key=lambda r: r.role == Role.ADMIN.value)
        return _user(rows[0]) if rows else None

    def admins(self) -> list[User]:
        return [_user(r) for r in self.s.scalars(select(UserRow).where(UserRow.role == Role.ADMIN.value))]

    def of_shop(self, shop_id: int) -> list[User]:
        return [_user(r) for r in self.s.scalars(select(UserRow).where(UserRow.shop_id == shop_id))]

    def customers(self) -> list[User]:
        q = select(UserRow).where(UserRow.role == Role.CUSTOMER.value).order_by(UserRow.id.desc())
        return [_user(r) for r in self.s.scalars(q)]

    def by_email(self, email: str) -> list[User]:
        q = select(UserRow).where(func.lower(UserRow.email) == email.strip().lower()).order_by(UserRow.id)
        return [_user(r) for r in self.s.scalars(q)]

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
        r.region = u.region.value if u.region else None
        for f in USER_FIELDS:
            setattr(r, f, getattr(u, f))


ADDRESS_FIELDS = ("user_id", "title", "name", "city", "line", "phone", "is_default")


def _address(r: AddressRow) -> Address:
    return Address(id=r.id, region=Region(r.region), **{f: getattr(r, f) for f in ADDRESS_FIELDS})


class SqlAddressRepository:
    def __init__(self, s: Session):
        self.s = s

    def of_user(self, user_id: int) -> list[Address]:
        q = select(AddressRow).where(AddressRow.user_id == user_id).order_by(AddressRow.is_default.desc(), AddressRow.id)
        return [_address(r) for r in self.s.scalars(q)]

    def get(self, address_id: int) -> Address | None:
        r = self.s.get(AddressRow, address_id)
        return _address(r) if r else None

    def add(self, a: Address) -> None:
        r = AddressRow()
        self._fill(r, a)
        self.s.add(r)
        self.s.flush()
        a.id = r.id

    def save(self, a: Address) -> None:
        r = self.s.get(AddressRow, a.id) if a.id is not None else None
        if r is None:
            return self.add(a)
        self._fill(r, a)
        self.s.flush()

    def delete(self, address_id: int) -> None:
        if r := self.s.get(AddressRow, address_id):
            self.s.delete(r)
            self.s.flush()

    @staticmethod
    def _fill(r: AddressRow, a: Address) -> None:
        r.region = a.region.value
        for f in ADDRESS_FIELDS:
            setattr(r, f, getattr(a, f))


def _notification(r: NotificationRow) -> Notification:
    return Notification(id=r.id, user_id=r.user_id, kind=NotificationKind(r.kind), title=r.title, body=r.body,
                        link=r.link, created_at=r.created_at, read=r.read)


class SqlNotificationRepository:
    def __init__(self, s: Session):
        self.s = s

    def add(self, n: Notification) -> None:
        r = NotificationRow(user_id=n.user_id, kind=n.kind.value, title=n.title, body=n.body, link=n.link, read=n.read)
        self.s.add(r)
        self.s.flush()
        n.id, n.created_at = r.id, r.created_at

    def of_user(self, user_id: int, limit: int = 100) -> list[Notification]:
        q = (select(NotificationRow).where(NotificationRow.user_id == user_id)
             .order_by(NotificationRow.id.desc()).limit(limit))
        return [_notification(r) for r in self.s.scalars(q)]

    def mark_read(self, user_id: int, ids: list[int] | None = None) -> None:
        q = select(NotificationRow).where(NotificationRow.user_id == user_id, NotificationRow.read.is_(False))
        if ids is not None:
            q = q.where(NotificationRow.id.in_(ids))
        for r in self.s.scalars(q):
            r.read = True
        self.s.flush()


def _ticket(r: TicketRow) -> Ticket:
    return Ticket(number=r.number, user_id=r.user_id, topic=r.topic, order_code=r.order_code,
                  status=TicketStatus(r.status), assignee=r.assignee, created_at=r.created_at,
                  messages=[TicketMessage(m.author, m.name, m.text, m.created_at) for m in r.messages])


class SqlTicketRepository:
    def __init__(self, s: Session):
        self.s = s

    def add(self, t: Ticket) -> None:
        r = TicketRow()
        self._fill(r, t)
        self.s.add(r)
        self.s.flush()
        self.s.refresh(r)
        t.number, t.created_at = r.number, r.created_at
        t.messages = [TicketMessage(m.author, m.name, m.text, m.created_at) for m in r.messages]

    def get(self, number: int) -> Ticket | None:
        r = self.s.get(TicketRow, number)
        return _ticket(r) if r else None

    def save(self, t: Ticket) -> None:
        r = self.s.get(TicketRow, t.number) if t.number is not None else None
        if r is None:
            return self.add(t)
        self._fill(r, t)
        self.s.flush()

    def list(self, user_id: int | None = None) -> list[Ticket]:
        q = select(TicketRow).order_by(TicketRow.number.desc())
        if user_id is not None:
            q = q.where(TicketRow.user_id == user_id)
        return [_ticket(r) for r in self.s.scalars(q)]

    @staticmethod
    def _fill(r: TicketRow, t: Ticket) -> None:
        r.user_id, r.topic, r.order_code, r.status, r.assignee = t.user_id, t.topic, t.order_code, t.status.value, t.assignee
        # сообщения только добавляются: дописываем новые в конец
        for m in t.messages[len(r.messages):]:
            r.messages.append(TicketMessageRow(author=m.author, name=m.name, text=m.text))


SHOP_FIELDS = ("name", "description", "contact_name", "phone", "email", "photo", "storage")


def _shop(r: ShopRow) -> Shop:
    return Shop(id=r.id, region=Region(r.region), status=ShopStatus(r.status), created_at=r.created_at,
                **{f: getattr(r, f) for f in SHOP_FIELDS})


class SqlShopRepository:
    def __init__(self, s: Session):
        self.s = s

    def get(self, shop_id: int) -> Shop | None:
        r = self.s.get(ShopRow, shop_id)
        return _shop(r) if r else None

    def list(self) -> list[Shop]:
        return [_shop(r) for r in self.s.scalars(select(ShopRow).order_by(ShopRow.id))]

    def add(self, sh: Shop) -> None:
        r = ShopRow()
        self._fill(r, sh)
        self.s.add(r)
        self.s.flush()
        sh.id, sh.created_at = r.id, r.created_at

    def save(self, sh: Shop) -> None:
        r = self.s.get(ShopRow, sh.id) if sh.id is not None else None
        if r is None:
            return self.add(sh)
        self._fill(r, sh)
        self.s.flush()

    @staticmethod
    def _fill(r: ShopRow, sh: Shop) -> None:
        r.region, r.status = sh.region.value, sh.status.value
        for f in SHOP_FIELDS:
            setattr(r, f, getattr(sh, f))


def _shop_order(r: ShopOrderRow) -> ShopOrder:
    from datetime import datetime
    return ShopOrder(order_number=r.order_number, shop_id=r.shop_id, status=PrepStatus(r.status),
                     history=[PrepEvent(PrepStatus(h["status"]), datetime.fromisoformat(h["at"]), h.get("note", ""))
                              for h in (r.history or [])])


class SqlShopOrderRepository:
    def __init__(self, s: Session):
        self.s = s

    def get(self, order_number: int, shop_id: int) -> ShopOrder | None:
        r = self.s.get(ShopOrderRow, (order_number, shop_id))
        return _shop_order(r) if r else None

    def of_shop(self, shop_id: int) -> list[ShopOrder]:
        return [_shop_order(r) for r in self.s.scalars(select(ShopOrderRow).where(ShopOrderRow.shop_id == shop_id))]

    def of_order(self, order_number: int) -> list[ShopOrder]:
        q = select(ShopOrderRow).where(ShopOrderRow.order_number == order_number)
        return [_shop_order(r) for r in self.s.scalars(q)]

    def save(self, so: ShopOrder) -> None:
        r = self.s.get(ShopOrderRow, (so.order_number, so.shop_id))
        if r is None:
            r = ShopOrderRow(order_number=so.order_number, shop_id=so.shop_id)
            self.s.add(r)
        r.status = so.status.value
        r.history = [{"status": h.status.value, "at": h.at.isoformat(), "note": h.note} for h in so.history]
        self.s.flush()


# ---------------- категории, отзывы, настройки ----------------
class SqlCategoryRepository:
    def __init__(self, s: Session):
        self.s = s

    def list(self) -> list[Category]:
        q = select(CategoryRow).order_by(CategoryRow.position, CategoryRow.id)
        return [Category(r.id, r.name, r.position, r.active) for r in self.s.scalars(q)]

    def get(self, category_id: int) -> Category | None:
        r = self.s.get(CategoryRow, category_id)
        return Category(r.id, r.name, r.position, r.active) if r else None

    def add(self, c: Category) -> None:
        r = CategoryRow(name=c.name, position=c.position, active=c.active)
        self.s.add(r)
        self.s.flush()
        c.id = r.id

    def save(self, c: Category) -> None:
        r = self.s.get(CategoryRow, c.id) if c.id is not None else None
        if r is None:
            return self.add(c)
        r.name, r.position, r.active = c.name, c.position, c.active
        self.s.flush()

    def delete(self, category_id: int) -> None:
        r = self.s.get(CategoryRow, category_id)
        if r:
            self.s.delete(r)
            self.s.flush()


REVIEW_FIELDS = ("product_id", "user_id", "order_number", "author", "rating", "text", "reply")


def _review(r: ReviewRow) -> Review:
    return Review(id=r.id, status=ReviewStatus(r.status), created_at=r.created_at,
                  **{f: getattr(r, f) for f in REVIEW_FIELDS})


class SqlReviewRepository:
    def __init__(self, s: Session):
        self.s = s

    def add(self, rv: Review) -> None:
        r = ReviewRow()
        self._fill(r, rv)
        self.s.add(r)
        self.s.flush()
        rv.id, rv.created_at = r.id, r.created_at

    def get(self, review_id: int) -> Review | None:
        r = self.s.get(ReviewRow, review_id)
        return _review(r) if r else None

    def save(self, rv: Review) -> None:
        r = self.s.get(ReviewRow, rv.id) if rv.id is not None else None
        if r is None:
            return self.add(rv)
        self._fill(r, rv)
        self.s.flush()

    def list(self, *, status: ReviewStatus | None = None, product_id: str | None = None,
             user_id: int | None = None) -> list[Review]:
        q = select(ReviewRow).order_by(ReviewRow.id.desc())
        if status is not None:
            q = q.where(ReviewRow.status == status.value)
        if product_id is not None:
            q = q.where(ReviewRow.product_id == product_id)
        if user_id is not None:
            q = q.where(ReviewRow.user_id == user_id)
        return [_review(r) for r in self.s.scalars(q)]

    @staticmethod
    def _fill(r: ReviewRow, rv: Review) -> None:
        r.status = rv.status.value
        for f in REVIEW_FIELDS:
            setattr(r, f, getattr(rv, f))


class SqlSettingsRepository:
    def __init__(self, s: Session):
        self.s = s

    def get(self, key: str) -> dict | None:
        r = self.s.get(SettingRow, key)
        return dict(r.value) if r and isinstance(r.value, dict) else None

    def put(self, key: str, value: dict) -> None:
        r = self.s.get(SettingRow, key)
        if r is None:
            self.s.add(SettingRow(key=key, value=value))
        else:
            r.value = value
        self.s.flush()
