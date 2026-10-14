"""Аккаунты: регистрация, вход, выход, профиль, привязка Telegram."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.application import auth
from app.application.ports import UnitOfWork
from app.domain.entities import User
from app.domain.errors import DomainError

from .. import schemas as S
from ..deps import SESSION_COOKIE, Container, container, current_user, require_user, uow

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_AGE = 30 * 24 * 3600


def _start_session(response: Response, c: Container, user: User) -> S.UserOut:
    response.set_cookie(SESSION_COOKIE, c.sessions.issue(user.id), max_age=MAX_AGE, httponly=True,
                        secure=c.cookie_secure, samesite="lax", path="/")
    return S.UserOut.of(user)


@router.post("/register", response_model=S.UserOut, status_code=201)
def register(body: S.RegisterIn, response: Response, c: Container = Depends(container), u: UnitOfWork = Depends(uow)):
    user = auth.register(u, c.hasher, body.phone, body.name, body.password, body.email)
    return _start_session(response, c, user)


@router.post("/login", response_model=S.UserOut)
def login(body: S.LoginIn, response: Response, c: Container = Depends(container), u: UnitOfWork = Depends(uow)):
    return _start_session(response, c, auth.authenticate(u, c.hasher, body.phone, body.password, c.clock.now()))


@router.post("/logout")
def logout(response: Response, c: Container = Depends(container)):
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=c.cookie_secure, samesite="lax")
    return {"ok": True}


@router.get("/me", response_model=S.UserOut | None)
def me(user: User | None = Depends(current_user)):
    return S.UserOut.of(user) if user else None


@router.post("/telegram-link", response_model=S.LinkOut)
def telegram_link(user: User = Depends(require_user), c: Container = Depends(container), u: UnitOfWork = Depends(uow)):
    name = c.bot.username() if c.bot else None
    if not name:
        raise DomainError("Telegram-бот ещё не подключён администратором")
    return S.LinkOut(url=f"https://t.me/{name}?start={auth.telegram_link_token(u, user.id)}")
