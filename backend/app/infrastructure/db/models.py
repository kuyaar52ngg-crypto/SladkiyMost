"""ORM-модели SQLAlchemy (PostgreSQL). Отображаются в доменные сущности в repositories.py."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ProductRow(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    region: Mapped[str] = mapped_column(String(3), index=True)
    manufacturer: Mapped[str] = mapped_column(String(160))
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(60), index=True)
    weight_g: Mapped[int] = mapped_column(Integer)
    price_rub: Mapped[int] = mapped_column(Integer)
    temp_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    shelf_life_days: Mapped[int] = mapped_column(Integer)
    photo: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    composition: Mapped[str] = mapped_column(Text, default="")
    tag: Mapped[str] = mapped_column(String(40), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    shop_id: Mapped[int | None] = mapped_column(ForeignKey("shops.id", ondelete="SET NULL"), index=True)
    review: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    photos: Mapped[list["ProductPhotoRow"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                           order_by="ProductPhotoRow.position")


class ProductPhotoRow(Base):
    __tablename__ = "product_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer)


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String(10), index=True)
    phone: Mapped[str] = mapped_column(String(40))
    phone_digits: Mapped[str] = mapped_column(String(10), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(255))
    tg_chat_id: Mapped[int | None] = mapped_column(BigInteger)
    tg_link_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    region: Mapped[str | None] = mapped_column(String(3))
    notify_orders: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    notify_waves: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    notify_support: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    notify_news: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    gift_draft: Mapped[dict | None] = mapped_column(JSON)
    shop_id: Mapped[int | None] = mapped_column(ForeignKey("shops.id", ondelete="SET NULL"), index=True)


class ShopRow(Base):
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    region: Mapped[str] = mapped_column(String(3))
    description: Mapped[str] = mapped_column(Text, default="")
    contact_name: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    photo: Mapped[str] = mapped_column(String(500), default="")
    storage: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ShopOrderRow(Base):
    __tablename__ = "shop_orders"

    order_number: Mapped[int] = mapped_column(ForeignKey("orders.number", ondelete="CASCADE"), primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True, index=True)
    status: Mapped[str] = mapped_column(String(10))
    history: Mapped[list] = mapped_column(JSON, default=list)


class AddressRow(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(120))
    region: Mapped[str] = mapped_column(String(3))
    city: Mapped[str] = mapped_column(String(60))
    line: Mapped[str] = mapped_column(String(300))
    phone: Mapped[str] = mapped_column(String(40))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)


class NotificationRow(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    link: Mapped[str] = mapped_column(String(300), default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TicketRow(Base):
    __tablename__ = "tickets"

    number: Mapped[int] = mapped_column(Integer, Identity(start=1), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(60))
    order_code: Mapped[str] = mapped_column(String(20), default="")
    status: Mapped[str] = mapped_column(String(10), index=True)
    assignee: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messages: Mapped[list["TicketMessageRow"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                               order_by="TicketMessageRow.id")


class TicketMessageRow(Base):
    __tablename__ = "ticket_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_number: Mapped[int] = mapped_column(ForeignKey("tickets.number", ondelete="CASCADE"), index=True)
    author: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(120))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WaveRow(Base):
    __tablename__ = "waves"

    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    direction: Mapped[str] = mapped_column(String(7), index=True)
    departure: Mapped[date] = mapped_column(Date, index=True)
    cutoff: Mapped[date] = mapped_column(Date)
    arrival_from: Mapped[date] = mapped_column(Date)
    arrival_to: Mapped[date] = mapped_column(Date)
    off_season: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(12), index=True)
    base_load_kg: Mapped[float] = mapped_column(Float, default=0)
    final_load_kg: Mapped[float | None] = mapped_column(Float)
    final_rate: Mapped[float | None] = mapped_column(Float)


class OrderRow(Base):
    __tablename__ = "orders"

    number: Mapped[int] = mapped_column(Integer, Identity(start=1025), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(40))
    customer_phone_digits: Mapped[str] = mapped_column(String(10), index=True)
    recipient_name: Mapped[str] = mapped_column(String(120))
    recipient_phone: Mapped[str] = mapped_column(String(40))
    recipient_phone_digits: Mapped[str] = mapped_column(String(10), index=True)
    recipient_region: Mapped[str] = mapped_column(String(3))
    recipient_city: Mapped[str] = mapped_column(String(60))
    receive: Mapped[str] = mapped_column(String(10))
    address: Mapped[str] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(8))
    company: Mapped[str | None] = mapped_column(String(120))
    gift_message: Mapped[str | None] = mapped_column(String(200))
    gift_signature: Mapped[str | None] = mapped_column(String(60))
    gift_card: Mapped[str | None] = mapped_column(String(20))
    gift_surprise: Mapped[bool | None] = mapped_column(Boolean)
    direction: Mapped[str] = mapped_column(String(7))
    wave_id: Mapped[str] = mapped_column(ForeignKey("waves.id"), index=True)
    goods_rub: Mapped[int] = mapped_column(Integer)
    weight_kg: Mapped[float] = mapped_column(Float)
    rate_rub: Mapped[float] = mapped_column(Float)
    delivery_rub: Mapped[int] = mapped_column(Integer)
    thermo_rub: Mapped[int] = mapped_column(Integer, default=0)
    gift_rub: Mapped[int] = mapped_column(Integer, default=0)
    receive_rub: Mapped[int] = mapped_column(Integer, default=0)
    total_rub: Mapped[int] = mapped_column(Integer)
    refund_rub: Mapped[int] = mapped_column(Integer, default=0)
    final_delivery_rub: Mapped[int | None] = mapped_column(Integer)
    payment_method: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(12), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)

    items: Mapped[list["OrderItemRow"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                       order_by="OrderItemRow.id")
    events: Mapped[list["OrderEventRow"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                         order_by="OrderEventRow.id")


class OrderItemRow(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_number: Mapped[int] = mapped_column(ForeignKey("orders.number", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    name: Mapped[str] = mapped_column(String(160))
    region: Mapped[str] = mapped_column(String(3))
    photo: Mapped[str] = mapped_column(String(500))
    weight_g: Mapped[int] = mapped_column(Integer)
    price_rub: Mapped[int] = mapped_column(Integer)
    temp_sensitive: Mapped[bool] = mapped_column(Boolean)
    qty: Mapped[int] = mapped_column(Integer)


class OrderEventRow(Base):
    __tablename__ = "order_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_number: Mapped[int] = mapped_column(ForeignKey("orders.number", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(12))
    date: Mapped[date] = mapped_column(Date)
    note: Mapped[str] = mapped_column(String(300), default="")


class CategoryRow(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class ReviewRow(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="reviews_user_product_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    order_number: Mapped[int] = mapped_column(Integer)
    author: Mapped[str] = mapped_column(String(120))
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), index=True)
    reply: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SettingRow(Base):
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
