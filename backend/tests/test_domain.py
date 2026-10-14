from datetime import date

from app.domain import logistics as L
from app.domain.entities import Direction, LineItem, Region


def item(weight_g=1000, qty=1, price=400, choc=False):
    return LineItem("X", "X", Region.YKT, "", weight_g, price, choc, qty)


def test_tariff_by_fill():
    assert L.tariff_for_load(150).rate == 500   # ровно 50 % — ещё без скидки
    assert L.tariff_for_load(151).rate == 400   # > 50 % → −20 %
    assert L.tariff_for_load(240).rate == 400
    assert L.tariff_for_load(241).rate == 325   # > 80 % → −35 %


def test_schedule_every_14_days_cutoff_3_days():
    w = L.schedule(Direction.YKT_DNR, date(2026, 10, 1), date(2026, 11, 30))
    assert [x.departure for x in w] == [date(2026, 10, 6), date(2026, 10, 20), date(2026, 11, 3), date(2026, 11, 17)]
    assert w[1].cutoff == date(2026, 10, 17)


def test_off_season_adds_7_days():
    assert L.arrival_window(date(2026, 9, 8)) == (date(2026, 9, 18), date(2026, 9, 22), False)
    a_from, _, off = L.arrival_window(date(2026, 11, 3))
    assert off and a_from == date(2026, 11, 20)


def test_thermo_required_for_chocolate_in_winter_and_summer():
    choc = [item(choc=True)]
    assert L.thermo_rule(date(2026, 12, 15), choc).required
    assert L.thermo_rule(date(2026, 7, 1), choc).required
    assert not L.thermo_rule(date(2026, 9, 15), choc).required
    assert not L.thermo_rule(date(2026, 12, 15), [item()]).required


def test_quote_weight_times_rate_with_projected_load():
    wave = L.schedule(Direction.YKT_DNR, date(2026, 9, 1), date(2026, 9, 30))[0]
    assert L.billable_weight_kg(1) == 1.1
    q = L.quote([item()], wave, 150)
    assert (q.rate, q.delivery_rub, q.total_rub) == (400, 440, 840)
    assert not L.quote([item()], wave, 299.5).fits
    assert L.quote([item(choc=True)], wave, 0, thermo=True).thermo_rub == 150


def test_final_delivery_never_increases():
    assert L.final_delivery(2, 1000, 260) == (325, 650, 350)
    assert L.final_delivery(2, 800, 10)[1] == 800
