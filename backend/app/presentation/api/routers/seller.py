"""Кабинет поставщика: магазин, свои товары, свои позиции в заказах и их подготовка."""
from __future__ import annotations

from dataclasses import replace
from datetime import date

from fastapi import APIRouter, Depends

from app.application import catalog, uploads, waves
from app.application import notifications as notify
from app.application import sellers as Sl
from app.application.ports import UnitOfWork
from app.domain.entities import PREP_TITLES, OrderStatus, User

from .. import schemas as S
from ..deps import Container, container, require_seller, today, uow
from .shop import _order_out

router = APIRouter(prefix="/api/seller", tags=["seller"])


def _shop(u: UnitOfWork, user: User):
    return Sl.get_shop(u, user.shop_id)


def shop_order_out(u: UnitOfWork, d: date, v: Sl.ShopOrderView, shop_name: str = "") -> S.ShopOrderOut:
    """Поставщик видит только свои позиции и не видит контакты и платёж покупателя."""
    o = v.order
    own = replace(o, items=v.items, customer_phone="", goods_rub=v.goods_rub, delivery_rub=0, thermo_rub=0,
                  gift_rub=0, receive_rub=0, total_rub=v.goods_rub, refund_rub=0, final_delivery_rub=None,
                  payment_method="", weight_kg=round(sum(i.weight_g * i.qty for i in v.items) / 1000, 2))
    return S.ShopOrderOut(order=_order_out(u, d, own), shop_id=v.prep.shop_id, shop_name=shop_name,
                          prep_status=v.prep.status, prep_title=PREP_TITLES[v.prep.status],
                          prep_history=[S.PrepEventOut(status=h.status, title=PREP_TITLES[h.status], at=h.at, note=h.note)
                                        for h in v.prep.history])


@router.get("/shop", response_model=S.ShopOut)
def shop(user: User = Depends(require_seller), u: UnitOfWork = Depends(uow)):
    return S.ShopOut.of(_shop(u, user))


@router.put("/shop", response_model=S.ShopOut)
def shop_update(body: S.ShopIn, user: User = Depends(require_seller), u: UnitOfWork = Depends(uow)):
    current = _shop(u, user)
    data = Sl.ShopData(**{**body.model_dump(), "region": current.region})  # регион меняет только администратор
    return S.ShopOut.of(Sl.update_shop(u, user.shop_id, data))


@router.get("/products", response_model=list[S.ProductOut])
def products(user: User = Depends(require_seller), u: UnitOfWork = Depends(uow)):
    return [S.ProductOut.of(p) for p in Sl.shop_products(u, user.shop_id)]


def _data(body: S.SellerProductIn) -> catalog.ProductData:
    return catalog.ProductData(**body.model_dump(exclude={"submit"}))


@router.post("/products", response_model=S.ProductOut, status_code=201)
def product_create(body: S.SellerProductIn, user: User = Depends(require_seller), u: UnitOfWork = Depends(uow)):
    return S.ProductOut.of(Sl.save_shop_product(u, _shop(u, user), _data(body), submit=body.submit))


@router.put("/products/{product_id}", response_model=S.ProductOut)
def product_update(product_id: str, body: S.SellerProductIn, user: User = Depends(require_seller),
                   u: UnitOfWork = Depends(uow)):
    return S.ProductOut.of(Sl.save_shop_product(u, _shop(u, user), _data(body), product_id, submit=body.submit))


@router.post("/products/{product_id}/unpublish", response_model=S.ProductOut)
def product_unpublish(product_id: str, user: User = Depends(require_seller), u: UnitOfWork = Depends(uow)):
    return S.ProductOut.of(Sl.unpublish(u, user.shop_id, product_id))


@router.post("/uploads", response_model=S.UploadOut)
def upload(body: S.UploadIn, user: User = Depends(require_seller), c: Container = Depends(container),
           d: date = Depends(today)):
    s = uploads.request_upload(c.storage, body.content_type, body.size, d)
    return S.UploadOut(upload_url=s.upload_url, public_url=s.public_url)


@router.get("/orders", response_model=list[S.ShopOrderOut])
def orders(user: User = Depends(require_seller), u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return [shop_order_out(u, d, v) for v in Sl.shop_orders(u, user.shop_id)]


@router.get("/orders/{code}", response_model=S.ShopOrderOut)
def order(code: str, user: User = Depends(require_seller), u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    from app.application.orders import parse_code
    return shop_order_out(u, d, Sl.shop_order(u, user.shop_id, parse_code(code)))


@router.post("/orders/{code}/prep", response_model=S.ShopOrderOut)
def order_prep(code: str, body: S.PrepIn, user: User = Depends(require_seller), u: UnitOfWork = Depends(uow),
               d: date = Depends(today), c: Container = Depends(container)):
    from app.application.orders import parse_code
    sh = _shop(u, user)
    v = Sl.set_prep(u, sh, parse_code(code), body.status, c.clock.now(), body.note)
    notify.prep_changed(u, c.notifier, sh, v.order, body.status, c.site_url)
    return shop_order_out(u, d, v)


@router.get("/waves", response_model=list[S.WaveOut])
def shop_waves(user: User = Depends(require_seller), u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    """Партии, в которые попали заказы магазина."""
    ids = {v.order.wave_id for v in Sl.shop_orders(u, user.shop_id) if v.order.status != OrderStatus.CANCELLED}
    return [S.WaveOut.of(w) for w in waves.list_waves(u, d) if w.wave.id in ids]
