"""Тестовый каталог (только для тестов — в БД магазина товары добавляет владелец)."""
from app.domain.entities import Product, Region


def _p(id, region, name, category, weight_g, price_rub, temp=False):
    return Product(id, Region(region), "Тестовый производитель", name, category, weight_g, price_rub, temp, 30,
                   "/img/gift.jpg")


PRODUCTS = [
    _p("YKT-001", "YKT", "Зефир с брусникой", "Зефир и пастила", 250, 420),
    _p("YKT-002", "YKT", "Мармелад с клюквой", "Мармелад", 200, 390),
    _p("YKT-003", "YKT", "Конфеты с кедровым орехом", "Шоколад и конфеты", 180, 590, True),
    _p("DNR-001", "DNR", "Трюфели с какао", "Шоколад и конфеты", 200, 560, True),
    _p("DNR-002", "DNR", "Печенье «Домашнее»", "Печенье и вафли", 400, 350),
    _p("DNR-003", "DNR", "Вафли с шоколадом", "Печенье и вафли", 300, 310, True),
]
