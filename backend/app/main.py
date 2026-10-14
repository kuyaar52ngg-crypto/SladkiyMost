"""Composition root: связывает инфраструктуру (PostgreSQL, Storage, Telegram) с presentation (FastAPI).

Запуск: uv run uvicorn app.main:app --reload
"""
import hashlib
import hmac

from app.infrastructure.clock import SystemClock
from app.infrastructure.config import Settings, settings
from app.infrastructure.db.uow import SqlUnitOfWork, make_session_factory
from app.infrastructure.email import NullEmailLinks, SupabaseEmailLinks
from app.infrastructure.security import Argon2Hasher, ResetLinkTokens, SessionTokens
from app.infrastructure.storage import LocalStorage, SupabaseStorage
from app.infrastructure.telegram import TelegramBot
from app.presentation.api.app import create_app
from app.presentation.api.deps import Container

if settings.serverless and settings.jwt_secret == Settings.model_fields["jwt_secret"].default:
    raise RuntimeError("Задайте JWT_SECRET: с секретом по умолчанию сессии можно подделать")

_sessions = make_session_factory(settings.database_url, settings.serverless)
_bot = TelegramBot(settings.telegram_bot_token)

app = create_app(
    Container(
        uow_factory=lambda: SqlUnitOfWork(_sessions),
        clock=SystemClock(),
        hasher=Argon2Hasher(),
        sessions=SessionTokens(settings.jwt_secret),
        storage=SupabaseStorage(settings.supabase_url, settings.supabase_service_key, settings.storage_bucket)
        if settings.supabase_url and settings.supabase_service_key else LocalStorage(),
        notifier=_bot,
        bot=_bot,
        site_url=settings.site_url.rstrip("/"),
        api_url=settings.api_url.rstrip("/"),
        admin_phone=settings.admin_phone,
        admin_password=settings.admin_password,
        webhook_secret=settings.telegram_webhook_secret
        or hmac.new(settings.jwt_secret.encode(), b"telegram-webhook", hashlib.sha256).hexdigest(),
        cookie_secure=settings.cookie_secure,
        mail=SupabaseEmailLinks(settings.supabase_url, settings.supabase_service_key)
        if settings.supabase_url and settings.supabase_service_key else NullEmailLinks(),
        reset_tokens=ResetLinkTokens(settings.jwt_secret),
    ),
    cors_origins=settings.cors_origins,
)
