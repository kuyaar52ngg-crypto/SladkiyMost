"""Фабрика FastAPI-приложения и трансляция доменных ошибок в HTTP."""
from __future__ import annotations

import logging
import re
import time

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.domain.errors import Conflict, DomainError, Forbidden, NotFound, Unauthorized

from .deps import Container
from .routers import account, admin, auth, seller, shop, telegram

STATUS = {NotFound: 404, Conflict: 409, Forbidden: 403, Unauthorized: 401}
log = logging.getLogger(__name__)

# Изменения, которые должны сразу увидеть открытые страницы (витрина, кабинеты, админка).
LIVE_CHANGES = re.compile(r"^/api/(admin|seller|orders|account/(reviews|tickets))(/|$)")
LIVE_KEY = "live"


def create_app(container: Container, cors_origins: list[str] | None = None) -> FastAPI:
    app = FastAPI(title="Сладкий мост API", version="1.0.0",
                  description="Маркетплейс сладостей Якутия ⇄ Донбасс со сборными отправками")
    app.state.container = container
    if cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_methods=["*"], allow_headers=["*"],
                           allow_credentials=True)

    @app.exception_handler(DomainError)
    async def domain_error(_: Request, e: DomainError):
        return JSONResponse({"detail": str(e)}, status_code=STATUS.get(type(e), 400))

    def bump_live() -> None:
        with container.uow_factory() as u:
            u.settings.put(LIVE_KEY, {"rev": time.time_ns() // 1_000_000})
            u.commit()

    @app.middleware("http")
    async def live_revision(request: Request, call_next):
        response = await call_next(request)
        if request.method != "GET" and response.status_code < 400 and LIVE_CHANGES.match(request.url.path):
            try:
                await run_in_threadpool(bump_live)
            except Exception:
                log.exception("Не удалось отметить изменение данных")
        return response

    @app.get("/api/live")
    def live():
        """Номер последнего изменения данных: страницы опрашивают его и обновляются, когда он меняется."""
        with container.uow_factory() as u:
            return {"rev": (u.settings.get(LIVE_KEY) or {}).get("rev", 0)}

    @app.get("/api/health")
    def health():
        return {"ok": True}

    app.include_router(shop.router)
    app.include_router(auth.router)
    app.include_router(account.router)
    app.include_router(admin.router)
    app.include_router(seller.router)
    app.include_router(telegram.router)
    return app
