"""Личный кабинет покупателя: профиль, адреса, уведомления, черновик открытки, поддержка."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.application import account as A
from app.application import notifications as notify
from app.application.ports import UnitOfWork
from app.domain.entities import TICKET_TOPICS, User

from .. import schemas as S
from ..deps import Container, container, require_user, uow

router = APIRouter(prefix="/api/account", tags=["account"])


@router.put("/profile", response_model=S.UserOut)
def update_profile(body: S.ProfileIn, user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    patch = A.ProfilePatch(**body.model_dump(exclude_unset=True))
    return S.UserOut.of(A.update_profile(u, user.id, patch, clear_email="email" in body.model_fields_set))


@router.post("/password")
def change_password(body: S.PasswordIn, user: User = Depends(require_user), c: Container = Depends(container),
                    u: UnitOfWork = Depends(uow)):
    A.change_password(u, c.hasher, user.id, body.current, body.new)
    return {"ok": True}


@router.put("/gift-draft", response_model=S.UserOut)
def gift_draft(body: S.GiftDraftIn, user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    return S.UserOut.of(A.save_gift_draft(u, user.id, body.model_dump()))


# ---------------- адреса ----------------
@router.get("/addresses", response_model=list[S.AddressOut])
def addresses(user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    return [S.AddressOut.of(a) for a in u.addresses.of_user(user.id)]


@router.post("/addresses", response_model=S.AddressOut, status_code=201)
def address_create(body: S.AddressIn, user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    return S.AddressOut.of(A.save_address(u, user.id, A.AddressData(**body.model_dump())))


@router.put("/addresses/{address_id}", response_model=S.AddressOut)
def address_update(address_id: int, body: S.AddressIn, user: User = Depends(require_user),
                   u: UnitOfWork = Depends(uow)):
    return S.AddressOut.of(A.save_address(u, user.id, A.AddressData(**body.model_dump()), address_id))


@router.post("/addresses/{address_id}/default", response_model=S.AddressOut)
def address_default(address_id: int, user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    return S.AddressOut.of(A.set_default_address(u, user.id, address_id))


@router.delete("/addresses/{address_id}")
def address_delete(address_id: int, user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    A.delete_address(u, user.id, address_id)
    return {"ok": True}


# ---------------- уведомления ----------------
@router.get("/notifications", response_model=list[S.NotificationOut])
def notifications(user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    return [S.NotificationOut.of(n) for n in u.notifications.of_user(user.id)]


@router.post("/notifications/read")
def notifications_read(body: S.ReadIn, user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    A.mark_read(u, user.id, body.ids)
    return {"ok": True}


# ---------------- поддержка ----------------
@router.get("/tickets/topics", response_model=list[str])
def topics():
    return TICKET_TOPICS


@router.get("/tickets", response_model=list[S.TicketOut])
def tickets(user: User = Depends(require_user), u: UnitOfWork = Depends(uow)):
    return [S.TicketOut.of(t) for t in A.tickets_of(u, user)]


@router.post("/tickets", response_model=S.TicketOut, status_code=201)
def ticket_create(body: S.TicketIn, user: User = Depends(require_user), u: UnitOfWork = Depends(uow),
                  c: Container = Depends(container)):
    t = A.create_ticket(u, user, body.topic, body.text, body.order_code)
    notify.ticket_created(u, c.notifier, t, c.site_url)
    return S.TicketOut.of(t)


@router.post("/tickets/{number}/messages", response_model=S.TicketOut)
def ticket_message(number: int, body: S.MessageIn, user: User = Depends(require_user), u: UnitOfWork = Depends(uow),
                   c: Container = Depends(container)):
    t = A.add_message(u, user, number, body.text)
    notify.ticket_updated(u, c.notifier, t, c.site_url, by_support=False)
    return S.TicketOut.of(t)
