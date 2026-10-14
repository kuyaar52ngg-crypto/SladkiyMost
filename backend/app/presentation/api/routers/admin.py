"""API кабинета администратора: аналитика, волны, заказы, товары, загрузка фото, Telegram."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request

from app.application import account, analytics, catalog, content, orders, uploads, waves
from app.application import reviews as R
from app.application import sellers as Sl
from app.application import notifications as notify
from app.application.ports import ProductFilter, UnitOfWork
from app.domain.entities import OrderStatus, ReviewStatus, User
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
    w = waves.change_wave_status(u, wave_id, body.status, d, body.note.strip() or "Изменено администратором")
    notify.wave_status_changed(u, c.notifier, w, c.site_url)
    return S.WaveOut.of(waves.get_wave_view(u, d, wave_id))


def _wave_data(b: S.WaveIn) -> waves.WaveData:
    return waves.WaveData(b.departure, b.cutoff, b.arrival_from, b.arrival_to, b.base_load_kg)


@router.post("/waves", response_model=S.WaveOut, status_code=201)
def wave_create(body: S.WaveIn, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    if body.direction is None:
        raise DomainError("Выберите направление")
    w = waves.create_wave(u, d, body.direction, _wave_data(body))
    return S.WaveOut.of(waves.get_wave_view(u, d, w.id))


@router.put("/waves/{wave_id}", response_model=S.WaveOut)
def wave_update(wave_id: str, body: S.WaveIn, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    waves.update_wave(u, d, wave_id, _wave_data(body))
    return S.WaveOut.of(waves.get_wave_view(u, d, wave_id))


@router.delete("/waves/{wave_id}")
def wave_delete(wave_id: str, move_to: str | None = None, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return {"ok": True, "moved": waves.delete_wave(u, d, wave_id, move_to)}


@router.get("/orders", response_model=list[S.OrderOut])
def order_list(status: OrderStatus | None = None, wave: str | None = None,
               u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return [_order_out(u, d, o) for o in orders.all_orders(u, status, wave)]


@router.get("/orders/{code}", response_model=S.OrderOut)
def order_detail(code: str, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return _order_out(u, d, orders.get_order(u, code))


@router.get("/waves/{wave_id}", response_model=S.WaveOut)
def wave_detail(wave_id: str, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return S.WaveOut.of(waves.get_wave_view(u, d, wave_id))


@router.get("/shops", response_model=list[S.ShopOut])
def shops(u: UnitOfWork = Depends(uow)):
    out = []
    for sh in u.shops.list():
        prods = Sl.shop_products(u, sh.id)
        login = next((x.phone for x in u.users.of_shop(sh.id)), "")
        out.append(S.ShopOut.of(sh, products=len(prods), published=sum(p.active for p in prods),
                                in_review=sum(p.review for p in prods), orders=len(Sl.shop_orders(u, sh.id)),
                                login_phone=login))
    return out


@router.post("/shops", response_model=S.ShopOut, status_code=201)
def shop_create(body: S.ShopCreateIn, c: Container = Depends(container), u: UnitOfWork = Depends(uow)):
    data = Sl.ShopData(**body.model_dump(exclude={"login_phone", "password", "owner_name"}))
    sh, seller = Sl.create_shop(u, c.hasher, data, body.login_phone, body.password, body.owner_name)
    return S.ShopOut.of(sh, login_phone=seller.phone)


@router.put("/shops/{shop_id}", response_model=S.ShopOut)
def shop_update(shop_id: int, body: S.ShopIn, u: UnitOfWork = Depends(uow)):
    return S.ShopOut.of(Sl.update_shop(u, shop_id, Sl.ShopData(**body.model_dump())))


@router.post("/shops/{shop_id}/status", response_model=S.ShopOut)
def shop_status(shop_id: int, body: S.ShopStatusIn, u: UnitOfWork = Depends(uow)):
    return S.ShopOut.of(Sl.set_shop_status(u, shop_id, body.status))


@router.post("/products/{product_id}/review", response_model=S.ProductOut)
def product_review(product_id: str, body: S.ReviewIn, u: UnitOfWork = Depends(uow)):
    return S.ProductOut.of(Sl.review_product(u, product_id, body.approve))


@router.get("/orders/{code}/shops", response_model=list[S.ShopOrderOut])
def order_shops(code: str, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    """Подготовка позиций заказа у каждого поставщика."""
    from .seller import shop_order_out
    o = orders.get_order(u, code)
    return [shop_order_out(u, d, Sl.shop_order(u, sh.id, o.number), sh.name) for sh in Sl.shops_of_order(u, o)]


@router.get("/customers", response_model=list[S.CustomerOut])
def customers(u: UnitOfWork = Depends(uow)):
    by_user: dict[int, list] = {}
    for o in u.orders.list():
        if o.user_id is not None:
            by_user.setdefault(o.user_id, []).append(o)
    out = []
    for c in u.users.customers():
        own = sorted(by_user.get(c.id, []), key=lambda o: o.number)
        paid = [o for o in own if o.status != OrderStatus.CANCELLED]
        out.append(S.CustomerOut(id=c.id, name=c.name, phone=c.phone, email=c.email, telegram=bool(c.tg_chat_id),
                                 created_at=c.created_at, orders=len(own),
                                 active_orders=sum(o.is_active for o in own), spent_rub=sum(o.total_rub for o in paid),
                                 last_order=own[-1].code if own else None))
    return out


@router.get("/tickets", response_model=list[S.TicketOut])
def ticket_list(u: UnitOfWork = Depends(uow)):
    users = {c.id: c for c in u.users.customers()}
    return [S.TicketOut.of(t, users.get(t.user_id)) for t in u.tickets.list()]


@router.post("/tickets/{number}/messages", response_model=S.TicketOut)
def ticket_reply(number: int, body: S.MessageIn, admin: User = Depends(require_admin), u: UnitOfWork = Depends(uow),
                 c: Container = Depends(container)):
    t = account.add_message(u, admin, number, body.text)
    notify.ticket_updated(u, c.notifier, t, c.site_url, by_support=True)
    return S.TicketOut.of(t, u.users.get(t.user_id))


@router.post("/tickets/{number}/status", response_model=S.TicketOut)
def ticket_status(number: int, body: S.TicketStatusIn, admin: User = Depends(require_admin),
                  u: UnitOfWork = Depends(uow), c: Container = Depends(container)):
    t = account.set_ticket_status(u, admin, number, body.status)
    notify.ticket_updated(u, c.notifier, t, c.site_url, by_support=True)
    return S.TicketOut.of(t, u.users.get(t.user_id))


@router.post("/orders/{code}/status", response_model=S.OrderOut)
def order_status(code: str, body: S.OrderStatusIn, u: UnitOfWork = Depends(uow), d: date = Depends(today),
                 c: Container = Depends(container)):
    before = orders.get_order(u, code).status
    o = orders.change_order_status(u, d, code, body.status, body.note)
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
        name = c.bot.setup(c.webhook_url, c.webhook_secret, c.site_url)
    except Exception as e:
        raise DomainError(f"Telegram не принял настройку: {e}") from e
    return S.BotOut(username=name)


@router.get("/telegram", response_model=S.BotOut)
def telegram_info(c: Container = Depends(container)):
    c.ensure_bot()
    return S.BotOut(username=c.bot.username() if c.bot else None)


# ---------------- категории ----------------
def _categories(u: UnitOfWork) -> list[S.CategoryOut]:
    return [S.CategoryOut.of(cat, n) for cat, n in content.categories(u)]


@router.get("/categories", response_model=list[S.CategoryOut])
def category_list(u: UnitOfWork = Depends(uow)):
    return _categories(u)


@router.post("/categories", response_model=list[S.CategoryOut], status_code=201)
def category_create(body: S.CategoryIn, u: UnitOfWork = Depends(uow)):
    content.create_category(u, body.name or "")
    return _categories(u)


@router.put("/categories/{category_id}", response_model=list[S.CategoryOut])
def category_update(category_id: int, body: S.CategoryIn, u: UnitOfWork = Depends(uow)):
    content.update_category(u, category_id, body.name, body.active)
    return _categories(u)


@router.post("/categories/{category_id}/move", response_model=list[S.CategoryOut])
def category_move(category_id: int, body: S.MoveIn, u: UnitOfWork = Depends(uow)):
    content.move_category(u, category_id, body.delta)
    return _categories(u)


@router.delete("/categories/{category_id}", response_model=list[S.CategoryOut])
def category_delete(category_id: int, u: UnitOfWork = Depends(uow)):
    content.delete_category(u, category_id)
    return _categories(u)


# ---------------- отзывы ----------------
def _review_out(u: UnitOfWork, r) -> S.ReviewOut:
    p = u.products.get(r.product_id)
    return S.ReviewOut.of(r, p.name if p else r.product_id)


@router.get("/reviews", response_model=list[S.ReviewOut])
def review_list(status: ReviewStatus | None = None, u: UnitOfWork = Depends(uow)):
    items = R.all_reviews(u, status)
    names = {p.id: p.name for p in u.products.list(ProductFilter(include_inactive=True))}
    return [S.ReviewOut.of(r, names.get(r.product_id, r.product_id)) for r in items]


@router.post("/reviews/{review_id}", response_model=S.ReviewOut)
def review_moderate(review_id: int, body: S.ModerateIn, u: UnitOfWork = Depends(uow), c: Container = Depends(container)):
    before = u.reviews.get(review_id)
    r = R.moderate(u, review_id, body.status, body.reply)
    if before and (before.status != r.status or before.reply != r.reply):
        p = u.products.get(r.product_id)
        notify.review_moderated(u, c.notifier, r, p.name if p else r.product_id, c.site_url)
    return _review_out(u, r)


# ---------------- тексты сайта и настройки ----------------
@router.get("/content")
def get_content(u: UnitOfWork = Depends(uow)):
    return content.site_content(u)


@router.put("/content")
def put_content(body: S.ContentIn, u: UnitOfWork = Depends(uow)):
    return content.save_site_content(u, body.model_dump())


@router.get("/settings")
def get_settings(u: UnitOfWork = Depends(uow)):
    return content.platform_settings(u)


@router.put("/settings")
def put_settings(body: S.SettingsIn, u: UnitOfWork = Depends(uow)):
    return content.save_platform_settings(u, body.model_dump())
