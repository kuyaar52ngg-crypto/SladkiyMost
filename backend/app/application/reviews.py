"""Отзывы о товарах: оставляют покупатели полученных заказов, публикует администратор (или сразу — без премодерации)."""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.entities import OrderStatus, Review, ReviewStatus, User
from app.domain.errors import Conflict, DomainError, Forbidden, NotFound

from . import content
from .ports import UnitOfWork

TEXT_MAX = 1500


@dataclass(frozen=True)
class Summary:
    rating: float
    count: int
    reviews: list[Review]


def product_reviews(uow: UnitOfWork, product_id: str) -> Summary:
    items = uow.reviews.list(status=ReviewStatus.PUBLISHED, product_id=product_id)
    avg = round(sum(r.rating for r in items) / len(items), 1) if items else 0.0
    return Summary(avg, len(items), items)


@dataclass(frozen=True)
class Reviewable:
    """Товар из полученного заказа, о котором покупатель ещё не написал."""
    product_id: str
    name: str
    photo: str
    order_number: int


def to_review(uow: UnitOfWork, user: User) -> list[Reviewable]:
    done = {r.product_id for r in uow.reviews.list(user_id=user.id)}
    out: dict[str, Reviewable] = {}
    for o in sorted(uow.orders.by_user(user.id), key=lambda o: -o.number):
        if o.status != OrderStatus.RECEIVED:
            continue
        for i in o.items:
            if i.product_id not in done and i.product_id not in out:
                out[i.product_id] = Reviewable(i.product_id, i.name, i.photo, o.number)
    return list(out.values())


def my_reviews(uow: UnitOfWork, user: User) -> list[Review]:
    return uow.reviews.list(user_id=user.id)


def leave_review(uow: UnitOfWork, user: User, product_id: str, rating: int, text: str) -> Review:
    if not 1 <= rating <= 5:
        raise DomainError("Поставьте оценку от 1 до 5")
    text = (text or "").strip()
    if len(text) > TEXT_MAX:
        raise DomainError(f"Отзыв — не длиннее {TEXT_MAX} символов")
    if any(r.product_id == product_id for r in uow.reviews.list(user_id=user.id)):
        raise Conflict("Вы уже оставили отзыв об этом товаре")
    item = next((x for x in to_review(uow, user) if x.product_id == product_id), None)
    if not item:
        raise Forbidden("Отзыв можно оставить на товар из полученного заказа")
    premod = content.platform_settings(uow)["reviews_premoderation"]
    r = Review(id=None, product_id=product_id, user_id=user.id, order_number=item.order_number,
               author=user.name.split()[0] if user.name else "Покупатель", rating=rating, text=text,
               status=ReviewStatus.PENDING if premod else ReviewStatus.PUBLISHED)
    uow.reviews.add(r)
    uow.commit()
    return r


def all_reviews(uow: UnitOfWork, status: ReviewStatus | None = None) -> list[Review]:
    return uow.reviews.list(status=status)


def moderate(uow: UnitOfWork, review_id: int, status: ReviewStatus | None = None, reply: str | None = None) -> Review:
    r = uow.reviews.get(review_id)
    if not r:
        raise NotFound("Отзыв не найден")
    if status is not None:
        r.status = status
    if reply is not None:
        reply = reply.strip()
        if len(reply) > TEXT_MAX:
            raise DomainError(f"Ответ — не длиннее {TEXT_MAX} символов")
        r.reply = reply
    uow.reviews.save(r)
    uow.commit()
    return r
