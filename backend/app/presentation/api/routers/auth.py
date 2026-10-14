"""Аккаунты: регистрация, вход, выход, профиль, привязка Telegram и вход из Telegram Mini App."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.application import auth
from app.application.ports import UnitOfWork
from app.domain.entities import User
from app.domain.errors import DomainError, Unauthorized

from .. import schemas as S
from ..deps import SESSION_COOKIE, Container, container, current_user, require_user, uow

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_AGE = 30 * 24 * 3600


def _start_session(response: Response, c: Container, user: User, with_token: bool = False) -> S.UserOut:
    token = c.sessions.issue(user.id)
    response.set_cookie(SESSION_COOKIE, token, max_age=MAX_AGE, httponly=True,
                        secure=c.cookie_secure, samesite="lax", path="/")
    out = S.UserOut.of(user)
    if with_token:
        out.token = token
    return out


def _tg_user_id(c: Container, init_data: str) -> int | None:
    tg = c.bot.verify_init_data(init_data) if init_data and c.bot else None
    return tg["id"] if tg else None


def _with_telegram(c: Container, u: UnitOfWork, user: User, init_data: str) -> tuple[User, bool]:
    """Вход/регистрация внутри Mini App: привязываем Telegram к аккаунту и отдаём токен сессии."""
    tg_id = _tg_user_id(c, init_data)
    if tg_id is None:
        return user, False
    return auth.attach_telegram(u, user.id, tg_id), True


@router.post("/register", response_model=S.UserOut, status_code=201)
def register(body: S.RegisterIn, response: Response, c: Container = Depends(container), u: UnitOfWork = Depends(uow)):
    user = auth.register(u, c.hasher, body.phone, body.name, body.password, body.email)
    user, in_app = _with_telegram(c, u, user, body.tg_init_data)
    return _start_session(response, c, user, in_app)


@router.post("/login", response_model=S.UserOut)
def login(body: S.LoginIn, response: Response, c: Container = Depends(container), u: UnitOfWork = Depends(uow)):
    user = auth.authenticate(u, c.hasher, body.phone, body.password, c.clock.now())
    user, in_app = _with_telegram(c, u, user, body.tg_init_data)
    return _start_session(response, c, user, in_app)


@router.post("/telegram", response_model=S.UserOut | None)
def telegram_login(body: S.TelegramAuthIn, response: Response, c: Container = Depends(container),
                   u: UnitOfWork = Depends(uow), user: User | None = Depends(current_user)):
    """Открытие сайта как Telegram Mini App: вход по подписанному initData.

    Если покупатель уже вошёл — Telegram привязывается к его аккаунту; если Telegram привязан к аккаунту —
    выполняется вход; иначе null (покупатель входит или регистрируется, и Telegram привяжется сам).
    """
    tg_id = _tg_user_id(c, body.init_data)
    if tg_id is None:
        raise Unauthorized("Не удалось проверить данные Telegram")
    c.ensure_bot()
    if user:
        return _start_session(response, c, auth.attach_telegram(u, user.id, tg_id), True)
    found = auth.by_telegram(u, tg_id)
    return _start_session(response, c, found, True) if found else None


@router.post("/logout")
def logout(response: Response, c: Container = Depends(container)):
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=c.cookie_secure, samesite="lax")
    return {"ok": True}


@router.get("/me", response_model=S.UserOut | None)
def me(user: User | None = Depends(current_user)):
    return S.UserOut.of(user) if user else None


@router.post("/telegram-link", response_model=S.LinkOut)
def telegram_link(user: User = Depends(require_user), c: Container = Depends(container), u: UnitOfWork = Depends(uow)):
    c.ensure_bot()
    name = c.bot.username() if c.bot else None
    if not name:
        raise DomainError("Telegram-бот не настроен: проверьте TELEGRAM_BOT_TOKEN")
    return S.LinkOut(url=f"https://t.me/{name}?start={auth.telegram_link_token(u, user.id)}")
