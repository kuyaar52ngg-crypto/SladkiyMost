"""Правила логистики: расписание волн, сезонность, тарифы и расчёт доставки.

Параметры — таблицы 1 и 2 кейса. Модуль чистый: на входе данные, на выходе результат.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable, Sequence

from .entities import Direction, LineItem, ReceiveMethod, Wave


@dataclass(frozen=True)
class LogisticsPolicy:
    wave_interval_days: int = 14          # 1 раз в 14 дней в каждом направлении
    cutoff_days_before: int = 3           # приём закрывается за 3 дня до отправки
    transit_days: tuple[int, int] = (10, 14)
    off_season_extra_days: int = 7        # май, ноябрь
    base_tariff: int = 500                # ₽ за кг
    min_load_kg: int = 50
    max_load_kg: int = 300
    # (порог заполнения, скидка %) — от большего к меньшему
    discounts: tuple[tuple[float, int], ...] = ((0.8, 35), (0.5, 20))
    thermo_price: int = 150
    packaging_factor: float = 1.1         # допущение: упаковка +10 % к массе нетто
    min_billable_kg: float = 0.5          # допущение: минимальный тарифицируемый вес
    gift_box_price: int = 250
    courier_price: int = 150
    pickup_price: int = 0
    anchors: dict[Direction, date] = field(default_factory=lambda: {
        Direction.YKT_DNR: date(2026, 10, 20),
        Direction.DNR_YKT: date(2026, 10, 27),
    })


DEFAULT_POLICY = LogisticsPolicy()


# ---------------- сезонность (таблица 2) ----------------
@dataclass(frozen=True)
class Season:
    kind: str  # frost | heat | offseason | none
    thermo_required: bool
    text: str


def season_for_month(month: int) -> Season:
    if month in (12, 1, 2):
        return Season("frost", True, "Морозы: шоколадным изделиям обязательна термоупаковка (защита от мороза).")
    if month in (6, 7, 8):
        return Season("heat", True, "Жара: шоколадным изделиям обязательна термоупаковка (защита от перегрева).")
    if month in (5, 11):
        return Season("offseason", False, "Межсезонье на Лене (ледостав/ледоход): срок доставки увеличен на 7 дней.")
    return Season("none", False, "Сезонных ограничений нет.")


def arrival_window(departure: date, p: LogisticsPolicy = DEFAULT_POLICY) -> tuple[date, date, bool]:
    lo, hi = p.transit_days
    months = {departure.month, (departure + timedelta(days=hi)).month}
    off = bool(months & {5, 11})
    if off:
        lo += p.off_season_extra_days
        hi += p.off_season_extra_days
    return departure + timedelta(days=lo), departure + timedelta(days=hi), off


@dataclass(frozen=True)
class ThermoRule:
    sensitive: bool
    required: bool
    reason: str


def thermo_rule(departure: date, items: Iterable[LineItem], p: LogisticsPolicy = DEFAULT_POLICY) -> ThermoRule:
    sensitive = any(i.temp_sensitive for i in items)
    a_from, a_to, _ = arrival_window(departure, p)
    risky = next((s for s in map(season_for_month, (departure.month, a_from.month, a_to.month)) if s.thermo_required), None)
    if sensitive and risky:
        return ThermoRule(True, True, risky.text)
    if sensitive:
        return ThermoRule(True, False, "В заказе шоколадные изделия. Сейчас термоупаковка по желанию.")
    return ThermoRule(False, False, "")


# ---------------- расписание волн ----------------
def wave_id(direction: Direction, departure: date) -> str:
    return f"{direction.value}-{departure.isoformat()}"


def schedule(direction: Direction, start: date, end: date, p: LogisticsPolicy = DEFAULT_POLICY) -> list[Wave]:
    """Все волны направления с отправкой в интервале [start, end]."""
    anchor = p.anchors[direction]
    step = p.wave_interval_days
    k = math.floor((start - anchor).days / step)
    out: list[Wave] = []
    while True:
        dep = anchor + timedelta(days=k * step)
        k += 1
        if dep > end:
            return out
        if dep < start:
            continue
        a_from, a_to, off = arrival_window(dep, p)
        out.append(Wave(wave_id(direction, dep), direction, dep, dep - timedelta(days=p.cutoff_days_before), a_from, a_to, off))


# ---------------- тарифы ----------------
@dataclass(frozen=True)
class Tariff:
    rate: float
    discount_percent: int
    fill: float


def tariff_for_load(load_kg: float, p: LogisticsPolicy = DEFAULT_POLICY) -> Tariff:
    fill = load_kg / p.max_load_kg
    for threshold, percent in p.discounts:
        if fill > threshold:
            return Tariff(p.base_tariff * (1 - percent / 100), percent, fill)
    return Tariff(float(p.base_tariff), 0, fill)


@dataclass(frozen=True)
class NextDiscount:
    need_kg: float
    rate: float
    percent: int


def next_discount(load_kg: float, p: LogisticsPolicy = DEFAULT_POLICY) -> NextDiscount | None:
    for threshold, percent in sorted(p.discounts):
        at = threshold * p.max_load_kg
        if load_kg <= at:
            return NextDiscount(round(max(0.1, at - load_kg + 0.1), 1), p.base_tariff * (1 - percent / 100), percent)
    return None


def net_weight_kg(items: Iterable[LineItem]) -> float:
    return sum(i.weight_g * i.qty for i in items) / 1000


def billable_weight_kg(net_kg: float, p: LogisticsPolicy = DEFAULT_POLICY) -> float:
    if net_kg <= 0:
        return 0.0
    return max(p.min_billable_kg, math.ceil(round(net_kg * p.packaging_factor * 10, 6)) / 10)


@dataclass(frozen=True)
class Quote:
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
    next_discount: NextDiscount | None
    thermo: ThermoRule
    thermo_applied: bool
    thermo_rub: int
    gift_rub: int
    receive_rub: int
    total_rub: int


def quote(
    items: Sequence[LineItem],
    wave: Wave,
    current_load_kg: float,
    *,
    thermo: bool = False,
    gift: bool = False,
    receive: ReceiveMethod = ReceiveMethod.PICKUP,
    p: LogisticsPolicy = DEFAULT_POLICY,
) -> Quote:
    """Доставка = тарифицируемый вес × тариф, тариф — по загрузке партии вместе с заказом."""
    goods = sum(i.price_rub * i.qty for i in items)
    net = net_weight_kg(items)
    weight = billable_weight_kg(net, p)
    projected = round(current_load_kg + weight, 1)
    t = tariff_for_load(projected, p)
    delivery = round(weight * t.rate)
    base = round(weight * p.base_tariff)
    th = thermo_rule(wave.departure, items, p)
    thermo_applied = th.required or thermo
    thermo_rub = p.thermo_price if thermo_applied else 0
    gift_rub = p.gift_box_price if gift else 0
    receive_rub = p.courier_price if receive == ReceiveMethod.COURIER else p.pickup_price
    return Quote(
        goods_rub=goods, net_kg=round(net, 3), weight_kg=weight,
        current_load_kg=current_load_kg, projected_load_kg=projected, fill=projected / p.max_load_kg,
        fits=projected <= p.max_load_kg, min_reached=projected >= p.min_load_kg,
        rate=t.rate, discount_percent=t.discount_percent,
        delivery_rub=delivery, base_delivery_rub=base, saving_rub=base - delivery,
        next_discount=next_discount(projected, p),
        thermo=th, thermo_applied=thermo_applied, thermo_rub=thermo_rub,
        gift_rub=gift_rub, receive_rub=receive_rub,
        total_rub=goods + delivery + thermo_rub + gift_rub + receive_rub,
    )


def final_delivery(weight_kg: float, paid_delivery_rub: int, final_load_kg: float,
                   p: LogisticsPolicy = DEFAULT_POLICY) -> tuple[float, int, int]:
    """Пересчёт при закрытии сбора: цена может только снизиться. → (тариф, итог, возврат)."""
    rate = tariff_for_load(final_load_kg, p).rate
    final = min(paid_delivery_rub, round(weight_kg * rate))
    return rate, final, paid_delivery_rub - final
