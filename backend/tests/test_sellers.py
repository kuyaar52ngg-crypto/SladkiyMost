"""Поставщики: магазин, товары с проверкой, подготовка своих позиций."""
from datetime import datetime, timezone

import pytest

from app.application import catalog, notifications
from app.application import orders as O
from app.application import sellers as Sl
from app.application import waves as W
from app.domain.entities import Direction, PrepStatus, Region, Role, ShopStatus
from app.domain.errors import Conflict, DomainError, Forbidden, NotFound

from .fakes import FakeNotifier
from .test_accounts import TODAY, H, uow  # noqa: F401

NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)


def product(**kw):
    d = dict(name="Зефир клюквенный", region=Region.DNR, manufacturer="", category="Зефир и пастила", weight_g=250,
             price_rub=400, temp_sensitive=False, shelf_life_days=30, photos=["https://cdn.test/a.jpg"])
    return catalog.ProductData(**{**d, **kw})


def shop(uow, phone="+7 (914) 700-00-01"):
    return Sl.create_shop(uow, H, Sl.ShopData(name="ЯХК", region=Region.YKT, contact_name="Ольга"), phone, "seller-pass", "Ольга")


def test_shop_and_moderation(uow):
    sh, seller = shop(uow)
    assert seller.role == Role.SELLER and seller.shop_id == sh.id
    with pytest.raises(Conflict):
        shop(uow)                                              # телефон занят
    draft = Sl.save_shop_product(uow, sh, product())
    assert draft.region == Region.YKT and draft.manufacturer == "ЯХК"   # регион и производитель — от магазина
    assert not draft.active and not draft.review and draft.shop_id == sh.id
    sent = Sl.save_shop_product(uow, sh, product(name="Зефир брусничный"), draft.id, submit=True)
    assert sent.review and not sent.active
    pub = Sl.review_product(uow, draft.id, approve=True)
    assert pub.active and not pub.review
    edited = Sl.save_shop_product(uow, sh, product(price_rub=450), draft.id)
    assert edited.active and edited.price_rub == 450           # правка опубликованного товара не снимает с витрины
    other, _ = shop(uow, "+7 (914) 700-00-02")
    with pytest.raises(NotFound):
        Sl.save_shop_product(uow, other, product(), draft.id)   # чужой товар
    Sl.set_shop_status(uow, sh.id, ShopStatus.BLOCKED)
    assert not uow.products.get(draft.id).active               # приостановка скрывает товары
    with pytest.raises(Forbidden):
        Sl.save_shop_product(uow, uow.shops.get(sh.id), product())


def test_prep_flow_and_notifications(uow):
    sh, seller = shop(uow)
    seller.tg_chat_id = 500
    uow.users.save(seller)
    p = Sl.save_shop_product(uow, sh, product(), submit=True)
    Sl.review_product(uow, p.id, approve=True)
    w = W.list_waves(uow, TODAY, Direction.YKT_DNR, only_open=True)[0].wave
    o = O.place_order(uow, TODAY, O.PlaceOrderCommand(
        quote=O.QuoteRequest([O.CartLine(p.id, 2), O.CartLine("YKT-001", 1)], w.id), customer_name="Анна",
        customer_phone="+7 (914) 000-00-01", recipient_name="Анна", recipient_phone="+7 (949) 000-00-02",
        pickup_point="Донецк", consent=True))
    n = FakeNotifier()
    notifications.order_placed(uow, n, o, "https://site")
    assert any(c == 500 and "Новый заказ" in t for c, t in n.sent)
    [v] = Sl.shop_orders(uow, sh.id)
    assert [i.product_id for i in v.items] == [p.id] and v.prep.status == PrepStatus.NEW   # только свои позиции
    with pytest.raises(DomainError):
        Sl.set_prep(uow, sh, o.number, PrepStatus.READY, NOW)  # этапы по порядку
    for st in (PrepStatus.CONFIRMED, PrepStatus.PREPARING, PrepStatus.READY, PrepStatus.HANDED):
        v = Sl.set_prep(uow, sh, o.number, st, NOW, "ok")
    assert [h.status for h in uow.shop_orders.get(o.number, sh.id).history][-1] == PrepStatus.HANDED
    with pytest.raises(DomainError):
        Sl.set_prep(uow, sh, o.number, PrepStatus.DONE, NOW)   # завершает администратор
    assert [s.id for s in Sl.shops_of_order(uow, o)] == [sh.id]
