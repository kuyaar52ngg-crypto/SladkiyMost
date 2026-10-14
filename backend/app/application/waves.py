"""Сценарии работы с волнами: расписание, витрина волн, предложения для корзины, смена статуса."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Sequence

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
from app.domain.errors import Conflict, DomainError, NotFound

from . import content

from .ports import UnitOfWork

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


def sync_schedule(uow: UnitOfWork, today: date, p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> list[Wave]:
    """Создаёт недостающие волны (8 недель назад … 6 недель вперёд) и закрывает просроченный приём.

    Возвращает волны, приём в которые закрыт автоматически.
    """
    existing = uow.waves.existing_ids() | deleted_ids(uow)
    auto = content.platform_settings(uow)["waves_auto_schedule"]
    for direction in Direction if auto else ():
        for w in L.schedule(direction, today - timedelta(days=56), today + timedelta(days=42), p):
            if w.id in existing:
                continue
            if w.cutoff < today:
                w.status = _status_by_date(w, today)
            uow.waves.add(w)
    closed = []
    for w in uow.waves.list():
        if w.status == WaveStatus.COLLECTING and today > w.cutoff:
            _apply_status(uow, w, WaveStatus.CLOSED, today, "Автоматически: истёк срок приёма", p)
            closed.append(w)
    uow.commit()
    return closed


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


# ---------------- ручное ведение партий (админка) ----------------
DELETED_KEY = "waves_deleted"


def deleted_ids(uow: UnitOfWork) -> set[str]:
    """Партии расписания, удалённые администратором, — их не нужно создавать заново."""
    return set((uow.settings.get(DELETED_KEY) or {}).get("ids", []))


def _remember_deleted(uow: UnitOfWork, ids: set[str]) -> None:
    uow.settings.put(DELETED_KEY, {"ids": sorted(ids)})


@dataclass(frozen=True)
class WaveData:
    departure: date
    cutoff: date
    arrival_from: date | None = None   # не указано — по нормативу доставки
    arrival_to: date | None = None
    base_load_kg: float = 0.0


def _apply_data(w: Wave, data: WaveData, p: L.LogisticsPolicy) -> None:
    a_from, a_to, off = L.arrival_window(data.departure, p)
    a_from, a_to = data.arrival_from or a_from, data.arrival_to or a_to
    if data.cutoff > data.departure:
        raise DomainError("Приём заказов должен закончиться не позже отправки")
    if a_from < data.departure:
        raise DomainError("Прибытие не может быть раньше отправки")
    if a_to < a_from:
        raise DomainError("Конец окна прибытия — не раньше его начала")
    if (a_to - data.departure).days > 120:
        raise DomainError("Слишком долгая доставка: проверьте даты прибытия")
    if not 0 <= data.base_load_kg <= p.max_load_kg:
        raise DomainError(f"Загрузка вне системы — от 0 до {p.max_load_kg} кг")
    w.departure, w.cutoff, w.arrival_from, w.arrival_to = data.departure, data.cutoff, a_from, a_to
    w.off_season = off
    w.base_load_kg = round(data.base_load_kg, 1)


def create_wave(uow: UnitOfWork, today: date, direction: Direction, data: WaveData,
                p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> Wave:
    wid = L.wave_id(direction, data.departure)
    if uow.waves.get(wid):
        raise Conflict("Партия этого направления с такой датой отправки уже есть")
    if data.departure < today:
        raise DomainError("Дата отправки уже прошла")
    w = Wave(wid, direction, data.departure, data.cutoff, data.departure, data.departure, False)
    _apply_data(w, data, p)
    w.status = WaveStatus.COLLECTING if today <= w.cutoff else WaveStatus.CLOSED
    uow.waves.add(w)
    deleted = deleted_ids(uow)
    if wid in deleted:
        _remember_deleted(uow, deleted - {wid})
    uow.commit()
    return w


def update_wave(uow: UnitOfWork, today: date, wave_id: str, data: WaveData,
                p: L.LogisticsPolicy = L.DEFAULT_POLICY) -> Wave:
    """Даты и загрузка вне системы. Направление не меняется — оно задаёт, какие заказы попадают в партию."""
    w = uow.waves.get(wave_id)
    if not w:
        raise NotFound("Волна не найдена")
    if w.status == WaveStatus.DONE:
        raise Conflict("Завершённую партию изменить нельзя")
    _apply_data(w, data, p)
    if w.status == WaveStatus.COLLECTING and today > w.cutoff:
        _apply_status(uow, w, WaveStatus.CLOSED, today, "Изменён срок приёма", p)
    uow.waves.save(w)
    uow.commit()
    return w


def delete_wave(uow: UnitOfWork, today: date, wave_id: str, move_to: str | None = None) -> int:
    """Удаляет партию. Заказы (если есть) переносятся в другую партию того же направления.

    Возвращает число перенесённых активных заказов.
    """
    w = uow.waves.get(wave_id)
    if not w:
        raise NotFound("Волна не найдена")
    orders = uow.orders.list(wave_id=w.id)
    active = [o for o in orders if o.status != OrderStatus.CANCELLED]
    if orders:
        if not move_to:
            if active:
                raise Conflict(f"В партии {len(active)} заказ(ов) — выберите партию, куда их перенести")
            raise Conflict("В партии есть отменённые заказы — выберите партию, куда перенести их историю")
        target = uow.waves.get(move_to)
        if not target or target.id == w.id:
            raise NotFound("Партия для переноса не найдена")
        if target.direction != w.direction:
            raise DomainError("Заказы можно перенести только в партию того же направления")
        if active and target.status in (WaveStatus.DONE, WaveStatus.ARRIVED):
            raise DomainError("Нельзя перенести заказы в прибывшую или завершённую партию")
        for o in orders:
            o.wave_id = target.id
            if o.status != OrderStatus.CANCELLED:
                o.history.append(OrderEvent(o.status, today, f"Перенесён в партию {target.departure:%d.%m}: "
                                                             "прежняя партия отменена"))
            uow.orders.save(o)
    uow.waves.delete(w.id)
    _remember_deleted(uow, deleted_ids(uow) | {w.id})
    uow.commit()
    return len(active)
