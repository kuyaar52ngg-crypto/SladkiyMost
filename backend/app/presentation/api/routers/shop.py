"""Публичное API витрины: каталог, волны, расчёт, заказы, отслеживание."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse

from app.application import catalog, content, orders, reviews, waves
from app.application import notifications as notify
from app.application.ports import ProductFilter, UnitOfWork
from app.domain import logistics as L
from app.domain.entities import (
    ORDER_FLOW,
    ORDER_STATUS_TITLES,
    PICKUP_POINTS,
    REGION_INFO,
    WAVE_STATUS_TITLES,
    Direction,
    LineItem,
    Region,
    User,
)
from app.domain.errors import NotFound

from .. import schemas as S
from ..deps import Container, container, current_user, require_user, today, uow

router = APIRouter(prefix="/api", tags=["shop"])


@router.get("/meta")
def meta(d: date = Depends(today), u: UnitOfWork = Depends(uow)):
    p = L.DEFAULT_POLICY
    rules = content.platform_settings(u)
    return {
        "today": d,
        "policy": {k: v for k, v in p.__dict__.items() if k != "anchors"},
        "regions": {r.value: REGION_INFO[r] for r in Region},
        "directions": {x.value: {"id": x.value, "from": x.origin.value, "to": x.destination.value, "title": x.title} for x in Direction},
        "pickup_points": {r.value: pts for r, pts in PICKUP_POINTS.items()},
        "categories": content.category_names(u),
        "content": content.site_content(u),
        "rules": {k: rules[k] for k in ("orders_open", "orders_closed_message", "min_order_rub")},
        "order_statuses": [{"id": s.value, "title": ORDER_STATUS_TITLES[s]} for s in ORDER_FLOW],
        "wave_statuses": {s.value: t for s, t in WAVE_STATUS_TITLES.items()},
    }


@router.get("/products", response_model=list[S.ProductOut])
def products(region: str = "", category: str = "", q: str = "", min_price: int | None = None,
             max_price: int | None = None, sort: str = "", limit: int | None = Query(None, ge=1, le=100),
             u: UnitOfWork = Depends(uow)):
    f = ProductFilter(regions=[r for r in region.split(",") if r], categories=[c for c in category.split(",") if c],
                      query=q, min_price=min_price, max_price=max_price)
    return [S.ProductOut.of(p) for p in catalog.list_products(u, f, sort)[:limit]]


@router.get("/products/{product_id}", response_model=S.ProductOut)
def product(product_id: str, u: UnitOfWork = Depends(uow)):
    return S.ProductOut.of(catalog.get_product(u, product_id))


@router.get("/products/{product_id}/reviews", response_model=S.ProductReviewsOut)
def product_reviews(product_id: str, u: UnitOfWork = Depends(uow)):
    r = reviews.product_reviews(u, product_id)
    return S.ProductReviewsOut(rating=r.rating, count=r.count, items=[S.ReviewOut.of(x) for x in r.reviews])


@router.get("/waves", response_model=list[S.WaveOut])
def wave_list(direction: Direction | None = None, only_open: bool = Query(False),
              u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return [S.WaveOut.of(v) for v in waves.list_waves(u, d, direction, only_open)]


@router.post("/waves/offers", response_model=list[S.OfferOut])
def wave_offers(body: S.OffersIn, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    items = orders.resolve_items(u, [orders.CartLine(i.id, i.qty) for i in body.items])
    return [S.OfferOut.of(o) for o in waves.offers_for_items(u, d, items)]


def _quote_request(b: S.QuoteIn) -> orders.QuoteRequest:
    return orders.QuoteRequest([orders.CartLine(i.id, i.qty) for i in b.items], b.wave_id, b.thermo, b.gift, b.receive)


@router.post("/quote", response_model=S.QuoteResponse)
def quote(body: S.QuoteIn, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    _, view, q = orders.quote_order(u, d, _quote_request(body))
    return S.QuoteResponse(wave=S.WaveOut.of(view), quote=S.QuoteOut.of(q))


@router.post("/quote/estimate", response_model=S.QuoteResponse)
def estimate(body: S.EstimateIn, u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    """Калькулятор доставки по весу — без корзины."""
    view = waves.get_wave_view(u, d, body.wave_id)
    item = LineItem("estimate", "Посылка", view.wave.direction.origin, "", round(body.weight_kg * 1000), 0, body.chocolate, 1)
    return S.QuoteResponse(wave=S.WaveOut.of(view), quote=S.QuoteOut.of(L.quote([item], view.wave, view.load_kg)))


def _order_out(u: UnitOfWork, d: date, o) -> S.OrderOut:
    return S.OrderOut.of(o, waves.get_wave_view(u, d, o.wave_id))


@router.post("/orders", response_model=S.OrderOut, status_code=201)
def create_order(b: S.OrderIn, u: UnitOfWork = Depends(uow), d: date = Depends(today),
                 user: User | None = Depends(current_user), c: Container = Depends(container)):
    cmd = orders.PlaceOrderCommand(
        quote=_quote_request(b), customer_name=b.customer_name, customer_phone=b.customer_phone,
        recipient_name=b.recipient_name, recipient_phone=b.recipient_phone, address=b.address,
        pickup_point=b.pickup_point, gift_message=b.gift_message, gift_signature=b.gift_signature,
        gift_card=b.gift_card, gift_surprise=b.gift_surprise, b2b=b.b2b, company=b.company,
        payment=b.payment, consent=b.consent, user_id=user.id if user else None,
    )
    o = orders.place_order(u, d, cmd)
    notify.order_placed(u, c.notifier, o, c.site_url)
    return _order_out(u, d, o)


@router.get("/orders", response_model=list[S.OrderOut])
def my_orders(user: User = Depends(require_user), u: UnitOfWork = Depends(uow), d: date = Depends(today)):
    return [_order_out(u, d, o) for o in orders.orders_of_user(u, user)]


@router.get("/orders/{code}", response_model=S.OrderOut)
def order(code: str, phone: str = "", u: UnitOfWork = Depends(uow), d: date = Depends(today),
          user: User | None = Depends(current_user)):
    return _order_out(u, d, orders.view_order(u, code, user, phone))


@router.post("/orders/{code}/cancel", response_model=S.OrderOut)
def cancel(code: str, body: S.CancelIn, u: UnitOfWork = Depends(uow), d: date = Depends(today),
           user: User | None = Depends(current_user), c: Container = Depends(container)):
    o = orders.cancel_order(u, d, code, user, body.phone)
    notify.order_cancelled(u, c.notifier, o, c.site_url, by_customer=True)
    return _order_out(u, d, o)


@router.get("/media/{path:path}", include_in_schema=False)
def media(path: str, c: Container = Depends(container)):
    """Фото из локального хранилища (разработка без Supabase)."""
    file = getattr(c.storage, "file", None)
    target = file(path) if file else None
    if not target or not target.is_file():
        raise NotFound("Файл не найден")
    return FileResponse(target)
