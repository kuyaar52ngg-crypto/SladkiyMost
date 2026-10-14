"""Сценарии каталога: витрина, карточка товара, управление товарами (админ)."""
from __future__ import annotations

from dataclasses import dataclass, field, replace

from app.domain.entities import OrderStatus, Product, Region
from app.domain.errors import Conflict, DomainError, NotFound

from . import content
from .ports import ProductFilter, UnitOfWork


def popularity(uow: UnitOfWork) -> dict[str, int]:
    pop: dict[str, int] = {}
    for o in uow.orders.list():
        if o.status != OrderStatus.CANCELLED:
            for i in o.items:
                pop[i.product_id] = pop.get(i.product_id, 0) + i.qty
    return pop


def list_products(uow: UnitOfWork, f: ProductFilter, sort: str = "") -> list[Product]:
    items = uow.products.list(f)
    if sort == "price_asc":
        items.sort(key=lambda p: p.price_rub)
    elif sort == "price_desc":
        items.sort(key=lambda p: -p.price_rub)
    elif sort == "new":
        items.sort(key=lambda p: p.created_at.timestamp() if p.created_at else float("inf"), reverse=True)
    elif sort == "popular":
        pop = popularity(uow)
        items.sort(key=lambda p: -pop.get(p.id, 0))
    return items


def get_product(uow: UnitOfWork, product_id: str) -> Product:
    p = uow.products.get(product_id)
    if not p:
        raise NotFound("Товар не найден")
    return p


@dataclass(frozen=True)
class ProductData:
    name: str
    region: Region
    manufacturer: str
    category: str
    weight_g: int
    price_rub: int
    temp_sensitive: bool
    shelf_life_days: int
    photos: list[str] = field(default_factory=list)
    description: str = ""
    composition: str = ""
    tag: str = ""
    active: bool = True


MAX_PHOTOS = 10


def _clean_photos(urls: list[str]) -> list[str]:
    out = []
    for u in (x.strip() for x in urls):
        if not u:
            continue
        if len(u) > 500 or not (u.startswith(("https://", "http://")) or (u.startswith("/") and not u.startswith("//"))):
            raise DomainError("Некорректная ссылка на фото")
        if u not in out:
            out.append(u)
    if not out:
        raise DomainError("Добавьте хотя бы одно фото")
    if len(out) > MAX_PHOTOS:
        raise DomainError(f"Не больше {MAX_PHOTOS} фото у товара")
    return out


def save_product(uow: UnitOfWork, data: ProductData, product_id: str | None = None) -> Product:
    if not data.name.strip():
        raise DomainError("Укажите название")
    if data.weight_g <= 0 or data.price_rub <= 0:
        raise DomainError("Масса и цена должны быть больше нуля")
    if data.category not in content.category_names(uow, with_hidden=True):
        raise DomainError("Неизвестная категория")
    photos = _clean_photos(data.photos)
    fields = {**data.__dict__, "name": data.name.strip(), "photos": photos, "photo": photos[0]}
    if product_id:
        p = get_product(uow, product_id)
        if p.region != data.region and uow.orders.has_product(p.id):
            raise Conflict("Регион товара с заказами менять нельзя")
        p = replace(p, **fields)
    else:
        # артикул по региону: YKT-001, DNR-001…
        taken = set(uow.products.ids_with_prefix(data.region.value))
        n = len(taken) + 1
        while f"{data.region.value}-{n:03d}" in taken:
            n += 1
        p = Product(id=f"{data.region.value}-{n:03d}", **fields)
    uow.products.save(p)
    uow.commit()
    return p


def set_product_active(uow: UnitOfWork, product_id: str, active: bool) -> Product:
    """Мягкое удаление: товар скрывается из каталога, история заказов сохраняется."""
    p = get_product(uow, product_id)
    p.active = active
    uow.products.save(p)
    uow.commit()
    return p


def delete_product(uow: UnitOfWork, product_id: str) -> bool:
    """Удаляет товар без заказов. Если заказы есть — только скрывает (история заказов сохраняется).

    Возвращает True, если товар удалён.
    """
    p = get_product(uow, product_id)
    if uow.orders.has_product(p.id):
        p.active = False
        uow.products.save(p)
        uow.commit()
        return False
    uow.products.delete(p.id)
    uow.commit()
    return True
