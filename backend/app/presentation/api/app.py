"""Фабрика FastAPI-приложения и трансляция доменных ошибок в HTTP."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.domain.errors import Conflict, DomainError, Forbidden, NotFound, Unauthorized

from .deps import Container
from .routers import admin, auth, shop, telegram

STATUS = {NotFound: 404, Conflict: 409, Forbidden: 403, Unauthorized: 401}


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

    @app.get("/api/health")
    def health():
        return {"ok": True}

    app.include_router(shop.router)
    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(telegram.router)
    return app
