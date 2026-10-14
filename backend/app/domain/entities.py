"""Сущности предметной области. Чистый Python — без фреймворков и БД."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum


class Region(StrEnum):
    YKT = "YKT"
    DNR = "DNR"

    @property
    def other(self) -> "Region":
        return Region.DNR if self is Region.YKT else Region.YKT


REGION_INFO = {
    Region.YKT: {"name": "Якутия", "showcase": "Сладости Якутии", "city": "Якутск", "gen": "Якутии"},
    Region.DNR: {"name": "Донбасс", "showcase": "Сладости Донбасса", "city": "Донецк", "gen": "Донбасса"},
}


# Пункты выдачи в регионах получения (справочник MVP)
PICKUP_POINTS = {
    Region.YKT: ["Якутск, пр. Ленина, 1 — пункт выдачи «Сладкий мост»", "Якутск, ул. Кирова, 18 — ТЦ «Центральный»"],
    Region.DNR: ["Донецк, ул. Артёма, 130 — пункт выдачи «Сладкий мост»", "Макеевка, пр. Ленинский, 22 — пункт выдачи"],
}


class Direction(StrEnum):
    YKT_DNR = "YKT-DNR"
    DNR_YKT = "DNR-YKT"

    @property
    def origin(self) -> Region:
        return Region(self.value.split("-")[0])

    @property
    def destination(self) -> Region:
        return Region(self.value.split("-")[1])

    @property
    def title(self) -> str:
        return f"{REGION_INFO[self.origin]['name']} → {REGION_INFO[self.destination]['name']}"

    @classmethod
    def from_origin(cls, origin: Region) -> "Direction":
        return cls(f"{origin.value}-{origin.other.value}")


class WaveStatus(StrEnum):
    COLLECTING = "collecting"
    CLOSED = "closed"
    TRANSIT = "transit"
    ARRIVED = "arrived"
    DONE = "done"
    POSTPONED = "postponed"


WAVE_STATUS_TITLES = {
    WaveStatus.COLLECTING: "Идёт сбор",
    WaveStatus.CLOSED: "Сбор закрыт",
    WaveStatus.TRANSIT: "В пути",
    WaveStatus.ARRIVED: "Прибыла",
    WaveStatus.DONE: "Завершена",
    WaveStatus.POSTPONED: "Перенесена",
}


class OrderStatus(StrEnum):
    ACCEPTED = "accepted"
    ASSEMBLING = "assembling"
    TRANSIT = "transit"
    PICKUP = "pickup"
    RECEIVED = "received"
    CANCELLED = "cancelled"


ORDER_STATUS_TITLES = {
    OrderStatus.ACCEPTED: "Принят",
    OrderStatus.ASSEMBLING: "В сборке",
    OrderStatus.TRANSIT: "В пути",
    OrderStatus.PICKUP: "На пункте выдачи",
    OrderStatus.RECEIVED: "Получен",
    OrderStatus.CANCELLED: "Отменён",
}
ORDER_FLOW = [OrderStatus.ACCEPTED, OrderStatus.ASSEMBLING, OrderStatus.TRANSIT, OrderStatus.PICKUP, OrderStatus.RECEIVED]

# Статус волны → статус её заказов
WAVE_TO_ORDER_STATUS = {
    WaveStatus.CLOSED: OrderStatus.ASSEMBLING,
    WaveStatus.TRANSIT: OrderStatus.TRANSIT,
    WaveStatus.ARRIVED: OrderStatus.PICKUP,
}


class ReceiveMethod(StrEnum):
    PICKUP = "pickup"
    COURIER = "courier"


class OrderKind(StrEnum):
    SELF = "self"
    GIFT = "gift"
    B2B = "b2b"


@dataclass
class Product:
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
    description: str = ""
    composition: str = ""
    tag: str = ""
    active: bool = True
    photos: list[str] = field(default_factory=list)  # галерея; первое фото — обложка (photo)
    created_at: datetime | None = None
    shop_id: int | None = None      # магазин-поставщик; None — товар площадки
    review: bool = False            # отправлен поставщиком на публикацию, ждёт проверки


@dataclass(frozen=True)
class LineItem:
    """Позиция корзины/заказа — снимок товара на момент заказа."""
    product_id: str
    name: str
    region: Region
    photo: str
    weight_g: int
    price_rub: int
    temp_sensitive: bool
    qty: int

    @classmethod
    def of(cls, p: Product, qty: int) -> "LineItem":
        return cls(p.id, p.name, p.region, p.photo, p.weight_g, p.price_rub, p.temp_sensitive, qty)


@dataclass
class Wave:
    """Сборная отправка («волна») в одном направлении."""
    id: str
    direction: Direction
    departure: date
    cutoff: date
    arrival_from: date
    arrival_to: date
    off_season: bool
    status: WaveStatus = WaveStatus.COLLECTING
    base_load_kg: float = 0.0  # загрузка, учтённая вне системы (например, оптовые партии)
    final_load_kg: float | None = None
    final_rate: float | None = None


@dataclass
class Recipient:
    name: str
    phone: str
    region: Region
    city: str
    receive: ReceiveMethod
    address: str


@dataclass
class GiftCard:
    message: str
    signature: str
    card: str = "classic"
    surprise: bool = False


@dataclass
class OrderEvent:
    status: OrderStatus
    date: date
    note: str = ""


@dataclass
class Order:
    number: int
    created_at: datetime
    customer_name: str
    customer_phone: str
    recipient: Recipient
    items: list[LineItem]
    direction: Direction
    wave_id: str
    goods_rub: int
    weight_kg: float
    rate_rub: float
    delivery_rub: int
    thermo_rub: int
    gift_rub: int
    receive_rub: int
    total_rub: int
    kind: OrderKind = OrderKind.SELF
    gift: GiftCard | None = None
    company: str | None = None
    payment_method: str = "Банковская карта"
    status: OrderStatus = OrderStatus.ACCEPTED
    refund_rub: int = 0
    final_delivery_rub: int | None = None
    history: list[OrderEvent] = field(default_factory=list)
    user_id: int | None = None  # аккаунт покупателя; None — заказ без регистрации

    @property
    def code(self) -> str:
        return f"СМ-{self.number}"

    @property
    def is_active(self) -> bool:
        return self.status not in (OrderStatus.RECEIVED, OrderStatus.CANCELLED)

    def move_to(self, status: OrderStatus, on: date, note: str = "") -> None:
        if self.status == status:
            return
        self.status = status
        self.history.append(OrderEvent(status, on, note))


class Role(StrEnum):
    ADMIN = "admin"
    CUSTOMER = "customer"
    SELLER = "seller"


class ShopStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    BLOCKED = "blocked"


SHOP_STATUS_TITLES = {ShopStatus.PENDING: "На проверке", ShopStatus.ACTIVE: "Активен", ShopStatus.BLOCKED: "Приостановлен"}


@dataclass
class Shop:
    """Магазин-поставщик: свои товары, подготовка своих позиций в заказах."""
    id: int | None
    name: str
    region: Region
    description: str = ""
    contact_name: str = ""
    phone: str = ""
    email: str = ""
    photo: str = ""
    storage: str = ""               # условия изготовления и хранения
    status: ShopStatus = ShopStatus.ACTIVE
    created_at: datetime | None = None


class PrepStatus(StrEnum):
    NEW = "new"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    HANDED = "handed"
    DONE = "done"


PREP_FLOW = [PrepStatus.NEW, PrepStatus.CONFIRMED, PrepStatus.PREPARING, PrepStatus.READY, PrepStatus.HANDED, PrepStatus.DONE]
PREP_TITLES = {
    PrepStatus.NEW: "Новый заказ", PrepStatus.CONFIRMED: "Подтверждён", PrepStatus.PREPARING: "Готовится",
    PrepStatus.READY: "Готов к передаче", PrepStatus.HANDED: "Передан в доставку", PrepStatus.DONE: "Завершён",
}


@dataclass
class PrepEvent:
    status: PrepStatus
    at: datetime
    note: str = ""


@dataclass
class ShopOrder:
    """Подготовка позиций магазина в заказе покупателя."""
    order_number: int
    shop_id: int
    status: PrepStatus = PrepStatus.NEW
    history: list[PrepEvent] = field(default_factory=list)


@dataclass
class User:
    id: int | None
    role: Role
    phone: str
    name: str
    password_hash: str
    email: str | None = None
    tg_chat_id: int | None = None
    tg_link_token: str | None = None
    failed_logins: int = 0
    locked_until: datetime | None = None
    created_at: datetime | None = None
    region: Region | None = None          # регион получения по умолчанию
    shop_id: int | None = None            # для роли seller — его магазин
    notify_orders: bool = True            # каналы уведомлений (Telegram); в кабинете лента — всегда
    notify_waves: bool = True
    notify_support: bool = True
    notify_news: bool = False
    gift_draft: dict | None = None        # черновик открытки: получатель, слова, «сначала связаться»


@dataclass
class Address:
    """Сохранённый адрес получения покупателя."""
    id: int | None
    user_id: int
    title: str
    name: str
    region: Region
    city: str
    line: str
    phone: str
    is_default: bool = False


class NotificationKind(StrEnum):
    ORDER = "order"
    WAVE = "wave"
    SUPPORT = "support"
    NEWS = "news"


@dataclass
class Notification:
    """Запись ленты уведомлений в кабинете (дублируется в Telegram, если он подключён)."""
    id: int | None
    user_id: int
    kind: NotificationKind
    title: str
    body: str
    link: str = ""
    created_at: datetime | None = None
    read: bool = False


class TicketStatus(StrEnum):
    OPEN = "open"
    IN_WORK = "in_work"
    ANSWERED = "answered"
    CLOSED = "closed"


TICKET_STATUS_TITLES = {
    TicketStatus.OPEN: "Новое",
    TicketStatus.IN_WORK: "В работе",
    TicketStatus.ANSWERED: "Ответ дан",
    TicketStatus.CLOSED: "Закрыто",
}

TICKET_TOPICS = ["Сборная доставка", "Состав и наличие", "Адрес и получение", "Оплата и возврат", "Другое"]


@dataclass
class TicketMessage:
    author: str          # "customer" | "support"
    name: str
    text: str
    created_at: datetime | None = None


@dataclass
class Ticket:
    """Обращение в поддержку."""
    number: int | None
    user_id: int
    topic: str
    order_code: str
    status: TicketStatus = TicketStatus.OPEN
    assignee: str = ""
    created_at: datetime | None = None
    messages: list[TicketMessage] = field(default_factory=list)

    @property
    def code(self) -> str:
        return f"ОБ-{self.number:03d}" if self.number else "ОБ-…"


@dataclass
class Category:
    """Категория каталога; товары ссылаются на неё по названию."""
    id: int | None
    name: str
    position: int = 0
    active: bool = True


class ReviewStatus(StrEnum):
    PENDING = "pending"
    PUBLISHED = "published"
    REJECTED = "rejected"


REVIEW_STATUS_TITLES = {
    ReviewStatus.PENDING: "На модерации",
    ReviewStatus.PUBLISHED: "Опубликован",
    ReviewStatus.REJECTED: "Отклонён",
}


@dataclass
class Review:
    """Отзыв покупателя о товаре из полученного заказа."""
    id: int | None
    product_id: str
    user_id: int
    order_number: int
    author: str
    rating: int
    text: str
    status: ReviewStatus = ReviewStatus.PENDING
    reply: str = ""
    created_at: datetime | None = None
