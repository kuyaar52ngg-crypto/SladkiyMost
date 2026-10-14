"""Вебхук Telegram: /start <токен> привязывает чат к аккаунту."""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Body, Depends, Header, HTTPException

from app.application import auth
from app.application.ports import UnitOfWork

from ..deps import Container, container, uow

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.post("/webhook")
def webhook(update: dict = Body(default_factory=dict), c: Container = Depends(container),
            u: UnitOfWork = Depends(uow), x_telegram_bot_api_secret_token: str = Header(default="")):
    if not c.webhook_secret or not hmac.compare_digest(x_telegram_bot_api_secret_token, c.webhook_secret):
        raise HTTPException(403, "forbidden")
    msg = update.get("message") or {}
    chat = (msg.get("chat") or {}).get("id")
    text = (msg.get("text") or "").strip()
    if not chat or not text.startswith("/start"):
        return {"ok": True}
    token = text.split(maxsplit=1)[1] if " " in text else ""
    user = auth.link_telegram(u, token, int(chat))
    if user:
        c.notifier.send(chat, f"Готово, {user.name}! Сюда будут приходить уведомления о заказах «Сладкого моста».")
    else:
        c.notifier.send(chat, "Чтобы получать уведомления, нажмите «Подключить Telegram» в личном кабинете "
                              f"на сайте: {c.site_url}/orders")
    return {"ok": True}
