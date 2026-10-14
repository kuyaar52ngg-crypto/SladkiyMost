"""API кабинета администратора: аналитика, волны, заказы, товары, загрузка фото, Telegram."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request

from app.application import analytics, catalog, orders, uploads, waves
from app.application import notifications as notify
from app.application.ports import ProductFilter, UnitOfWork
from app.domain.entities import OrderStatus
from app.domain.errors import DomainError

from .. import schemas as S
from ..deps import Container, container, require_admin, today, uow
from .shop import _order_out

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats", response_model=S.StatsOut)
def stats(u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return S.StatsOut.of(analytics.stats(u, d))


@router.get("/waves", response_model=list[S.WaveOut])
def wave_list(u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return [S.WaveOut.of(v) for v in reversed(waves.list_waves(u, d))]


@router.post("/waves/{wave_id}/status", response_model=S.WaveOut)
def wave_status(wave_id: str, body: S.WaveStatusIn, u: UnitOfWork = Depends(uow), d: date = Depends(today),
                c: Container = Depends(container)):
    w = waves.change_wave_status(u, wave_id, body.status, d, "Изменено администратором")
    notify.wave_status_changed(u, c.notifier, w, c.site_url)
    return S.WaveOut.of(waves.get_wave_view(u, d, wave_id))


@router.get("/orders", response_model=list[S.OrderOut])
def order_list(status: OrderStatus | None = None, wave: str | None = None,
               u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return [_order_out(u, d, o) for o in orders.all_orders(u, status, wave)]


@router.post("/orders/{code}/status", response_model=S.OrderOut)
def order_status(code: str, body: S.OrderStatusIn, u: UnitOfWork = Depends(uow), d: date = Depends(today),
                 c: Container = Depends(container)):
    before = orders.get_order(u, code).status
    o = orders.change_order_status(u, d, code, body.status)
    if o.status != before:
        notify.order_status_changed(u, c.notifier, o, c.site_url)
    return _order_out(u, d, o)


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


@router.delete("/products/{product_id}", response_model=S.DeletedOut)
def product_delete(product_id: str, u: UnitOfWork = Depends(uow)):
    return S.DeletedOut(deleted=catalog.delete_product(u, product_id))


@router.post("/uploads", response_model=S.UploadOut)
def upload(body: S.UploadIn, c: Container = Depends(container), d: date = Depends(today)):
    s = uploads.request_upload(c.storage, body.content_type, body.size, d)
    return S.UploadOut(upload_url=s.upload_url, public_url=s.public_url)


@router.put("/uploads/local/{path:path}", status_code=204)
async def upload_local(path: str, request: Request, c: Container = Depends(container)):
    """Приём файла для локального хранилища (разработка без Supabase)."""
    file = getattr(c.storage, "file", None)
    if not file:
        raise HTTPException(404, "Не найдено")
    body = await request.body()
    if len(body) > uploads.MAX_BYTES:
        raise DomainError("Файл больше 20 МБ")
    target = file(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)


@router.post("/telegram/setup", response_model=S.BotOut)
def telegram_setup(c: Container = Depends(container)):
    """Регистрирует вебхук бота (один раз после деплоя или смены токена)."""
    if not c.bot or not c.bot.enabled:
        raise DomainError("Не задан TELEGRAM_BOT_TOKEN")
    try:
        name = c.bot.set_webhook(f"{c.api_url}/api/telegram/webhook", c.webhook_secret)
    except Exception as e:
        raise DomainError(f"Telegram не принял настройку: {e}") from e
    return S.BotOut(username=name)


@router.get("/telegram", response_model=S.BotOut)
def telegram_info(c: Container = Depends(container)):
    return S.BotOut(username=c.bot.username() if c.bot else None)
