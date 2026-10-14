"""Сценарии каталога: витрина, карточка товара, управление товарами (админ)."""
from __future__ import annotations

from dataclasses import dataclass, replace

from app.domain.entities import OrderStatus, Product, Region
from app.domain.errors import DomainError, NotFound

from .ports import ProductFilter, UnitOfWork

CATEGORIES = ["Зефир и пастила", "Шоколад и конфеты", "Печенье и вафли", "Мармелад", "Подарочные наборы"]


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
    photo: str
    description: str = ""
    composition: str = ""
    tag: str = ""
    active: bool = True


def save_product(uow: UnitOfWork, data: ProductData, product_id: str | None = None) -> Product:
    if not data.name.strip():
        raise DomainError("Укажите название")
    if data.weight_g <= 0 or data.price_rub <= 0:
        raise DomainError("Масса и цена должны быть больше нуля")
    if data.category not in CATEGORIES:
        raise DomainError("Неизвестная категория")
    if product_id:
        p = get_product(uow, product_id)
        p = replace(p, **data.__dict__)
    else:
        taken = set(uow.products.ids_with_prefix(data.region.value))
        n = len(taken) + 1
        while f"{data.region.value}-{n:03d}" in taken:
            n += 1
        p = Product(id=f"{data.region.value}-{n:03d}", **data.__dict__)
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
