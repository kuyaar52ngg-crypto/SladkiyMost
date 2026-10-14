"""Сценарии работы с волнами: расписание, витрина волн, предложения для корзины, смена статуса."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable, Sequence

from app.domain import logistics as L
from app.domain.entities import (
    WAVE_TO_ORDER_STATUS,
    Direction,
    LineItem,
    OrderEvent,
    OrderStatus,
    Wave,
    WaveStatus,
)
from app.domain.errors import NotFound

from .ports import UnitOfWork

# Оценка «внешней» загрузки волны (другие каналы продаж/демо). Реализация — в infrastructure.
BaseLoad = Callable[[Wave, str], float]


def no_base_load(_: Wave, __: str) -> float:
    return 0.0


@dataclass(frozen=True)
class WaveView:
    wave: Wave
    load_kg: float
    rate: float
    discount_percent: int
    open: bool
    days_left: int
    orders_count: int

    @property
    def fill(self) -> float:
        return self.load_kg / L.DEFAULT_POLICY.max_load_kg


def _status_by_date(w: Wave, today: date) -> WaveStatus:
    if today < w.departure:
        return WaveStatus.CLOSED
    if today < w.arrival_from:
        return WaveStatus.TRANSIT
    if today <= w.arrival_to + timedelta(days=5):
        return WaveStatus.ARRIVED
    return WaveStatus.DONE


def sync_schedule(uow: UnitOfWork, today: date, base_load: BaseLoad = no_base_load,
                  p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> None:
    """Создаёт недостающие волны (8 недель назад … 6 недель вперёд) и закрывает просроченный приём."""
    existing = uow.waves.existing_ids()
    for direction in Direction:
        has_open = any(w.cutoff >= today for w in uow.waves.list(direction))
        for w in L.schedule(direction, today - timedelta(days=56), today + timedelta(days=42), p):
            if w.id in existing:
                continue
            past = w.cutoff < today
            kind = "past" if past else ("future" if has_open else "current")
            has_open = has_open or not past
            w.base_load_kg = round(base_load(w, kind), 1)
            if past:
                w.status = _status_by_date(w, today)
            uow.waves.add(w)
    for w in uow.waves.list():
        if w.status == WaveStatus.COLLECTING and today > w.cutoff:
            _apply_status(uow, w, WaveStatus.CLOSED, today, "Автоматически: истёк срок приёма", p)
    uow.commit()


def _views(uow: UnitOfWork, today: date, waves: Sequence[Wave], p: L.LogisticsPolicy) -> list[WaveView]:
    weights = uow.waves.orders_weight()
    counts: dict[str, int] = {}
    for o in uow.orders.list():
        if o.status != OrderStatus.CANCELLED:
            counts[o.wave_id] = counts.get(o.wave_id, 0) + 1
    out = []
    for w in waves:
        load = round(w.base_load_kg + weights.get(w.id, 0.0), 1)
        t = L.tariff_for_load(load, p)
        is_open = w.status == WaveStatus.COLLECTING and today <= w.cutoff and load < p.max_load_kg
        out.append(WaveView(w, load, t.rate, t.discount_percent, is_open,
                            max(0, (w.cutoff - today).days), counts.get(w.id, 0)))
    return out


def list_waves(uow: UnitOfWork, today: date, direction: Direction | None = None, only_open: bool = False,
               p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> list[WaveView]:
    views = _views(uow, today, uow.waves.list(direction), p)
    return [v for v in views if v.open] if only_open else views


def get_wave_view(uow: UnitOfWork, today: date, wave_id: str, p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> WaveView:
    w = uow.waves.get(wave_id)
    if not w:
        raise NotFound("Волна не найдена")
    return _views(uow, today, [w], p)[0]


@dataclass(frozen=True)
class WaveOffer:
    view: WaveView
    quote: L.Quote | None  # None для закрытых волн


def offers_for_items(uow: UnitOfWork, today: date, items: Sequence[LineItem],
                     p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> list[WaveOffer]:
    """Ближайшие открытые волны (до 3) + последняя закрытая — с расчётом доставки для корзины."""
    direction = Direction.from_origin(items[0].region)
    views = list_waves(uow, today, direction, p=p)
    open_ = [v for v in views if v.open][:3]
    closed = [v for v in views if not v.open and v.wave.departure >= today - timedelta(days=3)
              and v.wave.status != WaveStatus.COLLECTING][-1:]
    return [WaveOffer(v, L.quote(items, v.wave, v.load_kg, p=p)) for v in open_] + [WaveOffer(v, None) for v in closed]


def change_wave_status(uow: UnitOfWork, wave_id: str, status: WaveStatus, today: date, note: str = "",
                       p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> Wave:
    w = uow.waves.get(wave_id)
    if not w:
        raise NotFound("Волна не найдена")
    _apply_status(uow, w, status, today, note, p)
    uow.commit()
    return w


def _apply_status(uow: UnitOfWork, w: Wave, status: WaveStatus, today: date, note: str,
                  p: L.LogisticsPolicy) -> None:
    prev = w.status
    w.status = status
    orders = [o for o in uow.orders.list(wave_id=w.id) if o.status != OrderStatus.CANCELLED]
    if status == WaveStatus.CLOSED and prev == WaveStatus.COLLECTING:
        # итоговый пересчёт доставки по фактической загрузке — цена может только снизиться
        load = round(w.base_load_kg + sum(o.weight_kg for o in orders), 1)
        w.final_load_kg = load
        w.final_rate = L.tariff_for_load(load, p).rate
        for o in orders:
            _, o.final_delivery_rub, o.refund_rub = L.final_delivery(o.weight_kg, o.delivery_rub, load, p)
    if status == WaveStatus.POSTPONED:
        # партия не набрала минимум — заказы переносятся в следующую открытую волну
        nxt = next((x for x in uow.waves.list(w.direction)
                    if x.departure > w.departure and x.status == WaveStatus.COLLECTING), None)
        if nxt:
            for o in orders:
                o.wave_id = nxt.id
                o.history.append(OrderEvent(o.status, today,
                                            f"Перенесён в волну {nxt.departure:%d.%m}: партия не набрала {p.min_load_kg} кг"))
    target = WAVE_TO_ORDER_STATUS.get(status)
    for o in orders:
        if target and o.status != OrderStatus.RECEIVED:
            o.move_to(target, today, f"Волна: {status.value}")
        uow.orders.save(o)
    uow.waves.save(w)
