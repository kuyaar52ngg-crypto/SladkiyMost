"""Зависимости FastAPI: Unit of Work, «сегодня», текущий пользователь, проверка администратора."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Callable, Iterator, Protocol

from fastapi import Depends, Request

from app.application import auth
from app.application import notifications as notify
from app.application import waves as wave_cases
from app.application.ports import Clock, ImageStorage, Notifier, PasswordHasher, UnitOfWork
from app.domain.entities import Role, User
from app.domain.errors import Forbidden, Unauthorized

log = logging.getLogger(__name__)

SESSION_COOKIE = "sm_session"


class Sessions(Protocol):
    """Подпись cookie сессии (реализация — infrastructure.security.SessionTokens)."""
    def issue(self, user_id: int) -> str: ...
    def read(self, token: str) -> int | None: ...


@dataclass
class Container:
    """Собирается в composition root (app/main.py) — presentation не знает о конкретной БД."""
    uow_factory: Callable[[], UnitOfWork]
    clock: Clock
    hasher: PasswordHasher
    sessions: Sessions
    storage: ImageStorage
    notifier: Notifier
    bot: Any = None                     # TelegramBot: имя бота, вебхук, проверка initData Mini App
    site_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    admin_phone: str = ""
    admin_password: str = ""
    webhook_secret: str = ""
    cookie_secure: bool = True
    _synced: date | None = None
    _admin_checked: bool = field(default=False)

    @property
    def webhook_url(self) -> str:
        return f"{self.api_url}/api/telegram/webhook"

    def ensure_bot(self) -> None:
        """Вебхук бота регистрируется сам — без ручной настройки после деплоя."""
        if self.bot and self.bot.enabled:
            self.bot.ensure_setup(self.webhook_url, self.webhook_secret, self.site_url)


def container(request: Request) -> Container:
    return request.app.state.container


def today(c: Container = Depends(container)) -> date:
    return c.clock.today()


def uow(c: Container = Depends(container), d: date = Depends(today)) -> Iterator[UnitOfWork]:
    with c.uow_factory() as u:
        if not c._admin_checked:  # первый администратор из ADMIN_PHONE / ADMIN_PASSWORD
            try:
                auth.ensure_admin(u, c.hasher, c.admin_phone, c.admin_password)
            except Exception:
                log.exception("Не удалось создать администратора")
                u.rollback()
            c._admin_checked = True
        if c._synced != d:  # расписание волн и авто-закрытие приёма — раз в день
            try:
                for w in wave_cases.sync_schedule(u, d):
                    notify.wave_status_changed(u, c.notifier, w, c.site_url, auto=True)
            except Exception:
                # параллельный экземпляр (serverless) мог уже создать те же волны
                u.rollback()
            c._synced = d
        yield u


def current_user(request: Request, c: Container = Depends(container), u: UnitOfWork = Depends(uow)) -> User | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:  # Telegram Mini App во фрейме (Telegram Web), где cookie недоступна
        scheme, _, bearer = request.headers.get("authorization", "").partition(" ")
        token = bearer if scheme.lower() == "bearer" else None
    uid = c.sessions.read(token) if token else None
    return u.users.get(uid) if uid is not None else None


def require_user(user: User | None = Depends(current_user)) -> User:
    if not user:
        raise Unauthorized("Войдите в аккаунт")
    return user


def require_admin(user: User | None = Depends(current_user)) -> User:
    if not user:
        raise Unauthorized("Нужен вход администратора")
    if user.role != Role.ADMIN:
        raise Forbidden("Нужны права администратора")
    return user
