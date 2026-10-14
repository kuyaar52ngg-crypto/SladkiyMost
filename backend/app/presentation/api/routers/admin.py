"""API кабинета администратора: аналитика, волны, заказы, товары."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends

from app.application import analytics, catalog, orders, waves
from app.application.ports import ProductFilter, UnitOfWork
from app.domain.entities import OrderStatus

from .. import schemas as S
from ..deps import require_admin, today, uow
from .shop import _order_out

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.post("/login")
def login():
    return {"ok": True}


@router.get("/stats", response_model=S.StatsOut)
def stats(u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return S.StatsOut.of(analytics.stats(u, d))


@router.get("/waves", response_model=list[S.WaveOut])
def wave_list(u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return [S.WaveOut.of(v) for v in reversed(waves.list_waves(u, d))]


@router.post("/waves/{wave_id}/status", response_model=S.WaveOut)
def wave_status(wave_id: str, body: S.WaveStatusIn, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    waves.change_wave_status(u, wave_id, body.status, d, "Изменено администратором")
    return S.WaveOut.of(waves.get_wave_view(u, d, wave_id))


@router.get("/orders", response_model=list[S.OrderOut])
def order_list(status: OrderStatus | None = None, wave: str | None = None,
               u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return [_order_out(u, d, o) for o in orders.all_orders(u, status, wave)]


@router.post("/orders/{code}/status", response_model=S.OrderOut)
def order_status(code: str, body: S.OrderStatusIn, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return _order_out(u, d, orders.change_order_status(u, d, code, body.status))


@router.get("/products", response_model=list[S.ProductOut])
def product_list(u: UnitOfWork = Depends(uow)):
    return [S.ProductOut.of(p) for p in catalog.list_products(u, ProductFilter(include_inactive=True))]


def _data(b: S.ProductIn) -> catalog.ProductData:
    return catalog.ProductData(**b.model_dump())


@router.post("/products", response_model=S.ProductOut, status_code=201)
def product_create(body: S.ProductIn, u: UnitOfWork = Depends(uow)):
    return S.ProductOut.of(catalog.save_product(u, _data(body)))


@router.put("/products/{product_id}", response_model=S.ProductOut)
def product_update(product_id: str, body: S.ProductIn, u: UnitOfWork = Depends(uow)):
    return S.ProductOut.of(catalog.save_product(u, _data(body), product_id))


@router.post("/products/{product_id}/active", response_model=S.ProductOut)
def product_active(product_id: str, body: S.ActiveIn, u: UnitOfWork = Depends(uow)):
    return S.ProductOut.of(catalog.set_product_active(u, product_id, body.active))
