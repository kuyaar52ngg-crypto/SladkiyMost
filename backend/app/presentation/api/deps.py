"""Зависимости FastAPI: Unit of Work, «сегодня», проверка администратора."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Callable, Iterator

from fastapi import Depends, Header, HTTPException, Request

from app.application import waves as wave_cases
from app.application.ports import Clock, UnitOfWork


@dataclass
class Container:
    """Собирается в composition root (app/main.py) — presentation не знает о конкретной БД."""
    uow_factory: Callable[[], UnitOfWork]
    clock: Clock
    admin_token: str
    _synced: date | None = None


def container(request: Request) -> Container:
    return request.app.state.container


def today(c: Container = Depends(container)) -> date:
    return c.clock.today()


def uow(c: Container = Depends(container), d: date = Depends(today)) -> Iterator[UnitOfWork]:
    with c.uow_factory() as u:
        if c._synced != d:  # расписание волн и авто-закрытие приёма — раз в день
            try:
                wave_cases.sync_schedule(u, d)
            except Exception:
                # параллельный экземпляр (serverless) мог уже создать те же волны
                u.rollback()
            c._synced = d
        yield u


def require_admin(c: Container = Depends(container), x_admin_token: str | None = Header(default=None)) -> None:
    if x_admin_token != c.admin_token:
        raise HTTPException(401, "Нужен вход администратора")
