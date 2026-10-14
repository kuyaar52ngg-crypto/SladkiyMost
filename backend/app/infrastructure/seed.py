"""Подготовка пустой БД: расписание волн на ближайшие недели. Товары добавляет владелец в кабинете.

Запуск: `uv run python -m app.infrastructure.seed` (идемпотентно).
"""
from __future__ import annotations

from app.application import waves as wave_cases

from .clock import SystemClock
from .config import settings
from .db.uow import SqlUnitOfWork, make_session_factory


def seed(uow_factory) -> None:
    with uow_factory() as uow:
        wave_cases.sync_schedule(uow, SystemClock().today())


if __name__ == "__main__":
    seed(lambda: SqlUnitOfWork(make_session_factory(settings.database_url)))
    print("Seed: OK")
