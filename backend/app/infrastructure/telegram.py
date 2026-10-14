"""Telegram Bot API: отправка уведомлений и настройка вебхука."""
from __future__ import annotations

import logging

import httpx

log = logging.getLogger(__name__)


class TelegramBot:
    def __init__(self, token: str, timeout: float = 3.0):
        self.token, self.timeout = token, timeout
        self._username: str | None = None

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def _call(self, method: str, payload: dict | None = None) -> dict:
        r = httpx.post(f"https://api.telegram.org/bot{self.token}/{method}", json=payload or {}, timeout=self.timeout)
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or f"Telegram {method}: HTTP {r.status_code}")
        return data["result"]

    def send(self, chat_id: int, text: str) -> None:
        if not self.enabled:
            return
        try:
            self._call("sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
                                       "disable_web_page_preview": True})
        except Exception:  # уведомление не должно ломать заказ
            log.exception("Telegram: не удалось отправить сообщение в чат %s", chat_id)

    def username(self) -> str | None:
        if self.enabled and not self._username:
            try:
                self._username = self._call("getMe")["username"]
            except Exception:
                log.exception("Telegram: getMe")
        return self._username

    def set_webhook(self, url: str, secret: str) -> str:
        """Регистрирует вебхук и возвращает имя бота. Ошибки пробрасываются — их видит администратор."""
        self.timeout = max(self.timeout, 10)
        self._call("setWebhook", {"url": url, "secret_token": secret, "allowed_updates": ["message"],
                                  "drop_pending_updates": True})
        self._username = self._call("getMe")["username"]
        return self._username


class NullNotifier:
    def send(self, chat_id: int, text: str) -> None:
        pass
