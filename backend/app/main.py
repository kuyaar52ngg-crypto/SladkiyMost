"""Composition root: связывает инфраструктуру (PostgreSQL) с presentation (FastAPI).

Запуск: uv run uvicorn app.main:app --reload
"""
from app.infrastructure.clock import SystemClock
from app.infrastructure.config import settings
from app.infrastructure.db.uow import SqlUnitOfWork, make_session_factory
from app.presentation.api.app import create_app
from app.presentation.api.deps import Container

_sessions = make_session_factory(settings.database_url, settings.serverless)

app = create_app(
    Container(
        uow_factory=lambda: SqlUnitOfWork(_sessions),
        clock=SystemClock(),
        admin_token=settings.admin_token,
    ),
    cors_origins=settings.cors_origins,
)
