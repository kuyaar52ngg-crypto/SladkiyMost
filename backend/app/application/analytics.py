"""Аналитика для кабинета администратора: KPI, популярные товары, встречная загрузка, прогноз."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.domain import logistics as L
from app.domain.entities import Direction, OrderStatus

from .catalog import popularity
from .ports import UnitOfWork
from .waves import WaveView, list_waves

PLATFORM_COMMISSION = 0.15


@dataclass(frozen=True)
class CounterLoad:
    direction: Direction
    wave: WaveView | None
    forecast_kg: int | None


@dataclass(frozen=True)
class Stats:
    orders: int
    revenue: int
    avg_check: int
    gifts: int
    commission: int
    top: list[tuple[str, str, int]]
    by_status: dict[str, int]
    counter: list[CounterLoad]


def stats(uow: UnitOfWork, today: date, p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> Stats:
    orders = uow.orders.list()
    valid = [o for o in orders if o.status != OrderStatus.CANCELLED]
    revenue = sum(o.total_rub for o in valid)
    pop = popularity(uow)
    names = {pr.id: pr.name for pr in uow.products.get_many(list(pop)).values()}
    top = sorted(((pid, names.get(pid, pid), q) for pid, q in pop.items()), key=lambda t: -t[2])[:5]
    counter = []
    for d in Direction:
        views = list_waves(uow, today, d, p=p)
        past = [v for v in views if v.wave.cutoff < today][-4:]
        forecast = round(sum(v.load_kg for v in past) / len(past)) if past else None
        counter.append(CounterLoad(d, next((v for v in views if v.open), None), forecast))
    return Stats(
        orders=len(valid), revenue=revenue, avg_check=round(revenue / len(valid)) if valid else 0,
        gifts=sum(1 for o in valid if o.gift), commission=round(sum(o.goods_rub for o in valid) * PLATFORM_COMMISSION),
        top=top, by_status={s.value: sum(1 for o in orders if o.status == s) for s in OrderStatus},
        counter=counter,
    )
