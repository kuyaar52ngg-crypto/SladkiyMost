"""Поставщики: магазины, их товары (с проверкой перед публикацией) и подготовка своих позиций в заказах."""
from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime

from app.domain.entities import (
    PREP_FLOW,
    LineItem,
    Order,
    PrepEvent,
    PrepStatus,
    Product,
    Region,
    Role,
    Shop,
    ShopOrder,
    ShopStatus,
    User,
)
from app.domain.errors import Conflict, DomainError, Forbidden, NotFound

from . import catalog
from .auth import _password, _phone
from .orders import phone_digits
from .ports import PasswordHasher, ProductFilter, UnitOfWork


@dataclass(frozen=True)
class ShopData:
    name: str
    region: Region
    description: str = ""
    contact_name: str = ""
    phone: str = ""
    email: str = ""
    photo: str = ""
    storage: str = ""


def _clean(d: ShopData) -> dict:
    name = d.name.strip()
    if len(name) < 2:
        raise DomainError("Укажите название магазина")
    photo = d.photo.strip()
    if photo and not (photo.startswith(("https://", "http://")) or (photo.startswith("/") and not photo.startswith("//"))):
        raise DomainError("Некорректная ссылка на фото")
    return {"name": name[:120], "region": d.region, "description": d.description.strip()[:2000],
            "contact_name": d.contact_name.strip()[:120], "phone": d.phone.strip()[:40],
            "email": d.email.strip()[:160], "photo": photo[:500], "storage": d.storage.strip()[:2000]}


def get_shop(uow: UnitOfWork, shop_id: int | None) -> Shop:
    s = uow.shops.get(shop_id) if shop_id is not None else None
    if not s:
        raise NotFound("Магазин не найден")
    return s


def create_shop(uow: UnitOfWork, hasher: PasswordHasher, data: ShopData, login_phone: str, password: str,
                owner_name: str) -> tuple[Shop, User]:
    """Администратор подключает поставщика: магазин + учётная запись для входа в кабинет."""
    phone = _phone(login_phone)
    if uow.users.by_phone(phone_digits(phone)):
        raise Conflict("Этот телефон уже зарегистрирован — укажите другой номер для входа поставщика")
    shop = Shop(id=None, **_clean(data))
    uow.shops.add(shop)
    user = User(id=None, role=Role.SELLER, phone=phone, name=(owner_name or data.contact_name or shop.name).strip()[:120],
                password_hash=hasher.hash(_password(password)), shop_id=shop.id)
    uow.users.add(user)
    uow.commit()
    return shop, user


def update_shop(uow: UnitOfWork, shop_id: int, data: ShopData) -> Shop:
    shop = get_shop(uow, shop_id)
    shop = replace(shop, **_clean(data))
    uow.shops.save(shop)
    uow.commit()
    return shop


def set_shop_status(uow: UnitOfWork, shop_id: int, status: ShopStatus) -> Shop:
    """Приостановленный магазин не виден на витрине: его товары скрываются."""
    shop = get_shop(uow, shop_id)
    shop.status = status
    uow.shops.save(shop)
    if status != ShopStatus.ACTIVE:
        for p in uow.products.list(ProductFilter(include_inactive=True, shop_id=shop_id)):
            if p.active:
                p.active = False
                uow.products.save(p)
    uow.commit()
    return shop


def require_active(shop: Shop) -> None:
    if shop.status == ShopStatus.BLOCKED:
        raise Forbidden("Магазин приостановлен — обратитесь к администратору площадки")


# ---------------- товары ----------------
def shop_products(uow: UnitOfWork, shop_id: int) -> list[Product]:
    return uow.products.list(ProductFilter(include_inactive=True, shop_id=shop_id))


def own_product(uow: UnitOfWork, shop_id: int, product_id: str) -> Product:
    p = catalog.get_product(uow, product_id)
    if p.shop_id != shop_id:
        raise NotFound("Товар не найден")
    return p


def save_shop_product(uow: UnitOfWork, shop: Shop, data: catalog.ProductData, product_id: str | None = None,
                      submit: bool = False) -> Product:
    """Черновик или отправка на публикацию. Регион товара — регион магазина.

    Опубликованный товар после правки остаётся на витрине; новый — появляется после проверки администратором.
    """
    require_active(shop)
    existing = own_product(uow, shop.id, product_id) if product_id else None
    published = bool(existing and existing.active)
    data = replace(data, region=shop.region, manufacturer=data.manufacturer.strip() or shop.name, active=published)
    p = catalog.save_product(uow, data, product_id)
    p.shop_id = shop.id
    p.review = (submit or bool(existing and existing.review)) and not published
    uow.products.save(p)
    uow.commit()
    return p


def unpublish(uow: UnitOfWork, shop_id: int, product_id: str) -> Product:
    p = own_product(uow, shop_id, product_id)
    p.active, p.review = False, False
    uow.products.save(p)
    uow.commit()
    return p


def review_product(uow: UnitOfWork, product_id: str, approve: bool) -> Product:
    """Решение администратора по товару поставщика."""
    p = catalog.get_product(uow, product_id)
    if approve and p.shop_id is not None:
        shop = get_shop(uow, p.shop_id)
        if shop.status != ShopStatus.ACTIVE:
            raise Conflict("Магазин не активен — товар нельзя опубликовать")
    p.active, p.review = approve, False
    uow.products.save(p)
    uow.commit()
    return p


# ---------------- заказы ----------------
@dataclass
class ShopOrderView:
    order: Order
    items: list[LineItem]       # только позиции магазина
    prep: ShopOrder

    @property
    def goods_rub(self) -> int:
        return sum(i.price_rub * i.qty for i in self.items)


def _view(order: Order, ids: set[str], prep: ShopOrder | None, shop_id: int) -> ShopOrderView:
    items = [i for i in order.items if i.product_id in ids]
    prep = prep or ShopOrder(order_number=order.number, shop_id=shop_id,
                             history=[PrepEvent(PrepStatus.NEW, order.created_at)])
    return ShopOrderView(order, items, prep)


def shop_orders(uow: UnitOfWork, shop_id: int) -> list[ShopOrderView]:
    ids = {p.id for p in shop_products(uow, shop_id)}
    preps = {s.order_number: s for s in uow.shop_orders.of_shop(shop_id)}
    out = [_view(o, ids, preps.get(o.number), shop_id) for o in uow.orders.list() if any(i.product_id in ids for i in o.items)]
    return sorted(out, key=lambda v: v.order.number, reverse=True)


def shop_order(uow: UnitOfWork, shop_id: int, number: int) -> ShopOrderView:
    for v in shop_orders(uow, shop_id):
        if v.order.number == number:
            return v
    raise NotFound("Заказ не найден")


def set_prep(uow: UnitOfWork, shop: Shop, number: int, status: PrepStatus, now: datetime, note: str = "") -> ShopOrderView:
    """Этапы подготовки идут вперёд по одному (завершает партию администратор)."""
    require_active(shop)
    v = shop_order(uow, shop.id, number)
    cur, nxt = PREP_FLOW.index(v.prep.status), PREP_FLOW.index(status)
    if status == PrepStatus.DONE or nxt != cur + 1:
        raise DomainError("Этот этап сейчас недоступен")
    if v.order.status.value == "cancelled":
        raise Conflict("Заказ отменён")
    v.prep.status = status
    v.prep.history.append(PrepEvent(status, now, note.strip()[:300]))
    uow.shop_orders.save(v.prep)
    uow.commit()
    return v


def shops_of_order(uow: UnitOfWork, order: Order) -> list[Shop]:
    ids = {i.product_id for i in order.items}
    shop_ids = {p.shop_id for p in uow.products.get_many(list(ids)).values() if p.shop_id is not None}
    return [s for s in (uow.shops.get(i) for i in sorted(shop_ids)) if s]
