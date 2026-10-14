from datetime import date

import pytest

from app.application import orders as O
from app.application import waves as W
from app.domain.entities import Direction, OrderStatus, WaveStatus
from app.domain.errors import Conflict, DomainError
from .catalog_data import PRODUCTS

from .fakes import MemUow

TODAY = date(2026, 10, 14)


@pytest.fixture
def uow():
    u = MemUow()
    for p in PRODUCTS:
        u.products.save(p)
    W.sync_schedule(u, TODAY)
    return u


def order_cmd(wave_id, items=(("YKT-001", 2),), **kw):
    return O.PlaceOrderCommand(
        quote=O.QuoteRequest([O.CartLine(i, q) for i, q in items], wave_id, gift=kw.pop("gift", False)),
        customer_name="Тест", customer_phone="+7 (914) 000-00-01",
        recipient_name="Получатель", recipient_phone="+7 (949) 000-00-02", pickup_point="Донецк", consent=True, **kw)


def open_wave(uow, d=Direction.YKT_DNR):
    return W.list_waves(uow, TODAY, d, only_open=True)[0].wave


def test_schedule_and_auto_close(uow):
    waves = W.list_waves(uow, TODAY)
    assert any(v.open for v in waves)
    assert all(v.wave.status != WaveStatus.COLLECTING for v in waves if v.wave.cutoff < TODAY)


def test_place_order_and_wave_lifecycle(uow):
    w = open_wave(uow)
    o = O.place_order(uow, TODAY, order_cmd(w.id, gift=True, gift_message="С любовью"))
    assert o.code == "СМ-1025" and o.status == OrderStatus.ACCEPTED and o.recipient.region.value == "DNR"
    assert o.gift_rub == 250 and o.gift.message == "С любовью"
    assert W.get_wave_view(uow, TODAY, w.id).load_kg == o.weight_kg

    W.change_wave_status(uow, w.id, WaveStatus.CLOSED, TODAY)
    o = O.get_order(uow, "СМ-1025")
    assert o.status == OrderStatus.ASSEMBLING and o.final_delivery_rub <= o.delivery_rub
    W.change_wave_status(uow, w.id, WaveStatus.TRANSIT, TODAY)
    assert O.get_order(uow, "1025").status == OrderStatus.TRANSIT


def test_mixed_regions_rejected(uow):
    with pytest.raises(DomainError, match="одного региона"):
        O.resolve_items(uow, [O.CartLine("YKT-001", 1), O.CartLine("DNR-001", 1)])


def test_closed_wave_rejects_orders(uow):
    w = open_wave(uow)
    W.change_wave_status(uow, w.id, WaveStatus.CLOSED, TODAY)
    with pytest.raises(Conflict):
        O.place_order(uow, TODAY, order_cmd(w.id))


def test_postponed_wave_moves_orders(uow):
    w = open_wave(uow)
    O.place_order(uow, TODAY, order_cmd(w.id))
    W.change_wave_status(uow, w.id, WaveStatus.POSTPONED, TODAY)
    assert O.get_order(uow, "СМ-1025").wave_id != w.id


def test_cancel_only_by_owner_and_before_assembly(uow):
    w = open_wave(uow)
    O.place_order(uow, TODAY, order_cmd(w.id))
    with pytest.raises(Exception):
        O.cancel_order(uow, TODAY, "СМ-1025", None, "+7 (900) 111-11-11")
    assert O.cancel_order(uow, TODAY, "СМ-1025", None, "89140000001").status == OrderStatus.CANCELLED
