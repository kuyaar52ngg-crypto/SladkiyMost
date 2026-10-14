"""Telegram Bot API: уведомления, вебхук, кнопка меню Mini App и проверка initData."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from urllib.parse import parse_qsl

import httpx

log = logging.getLogger(__name__)

INIT_DATA_TTL = 24 * 3600


class TelegramBot:
    def __init__(self, token: str, timeout: float = 3.0):
        self.token, self.timeout = token, timeout
        self._username: str | None = None
        self._configured = False

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def _call(self, method: str, payload: dict | None = None, timeout: float | None = None) -> dict:
        r = httpx.post(f"https://api.telegram.org/bot{self.token}/{method}", json=payload or {},
                       timeout=timeout or self.timeout)
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or f"Telegram {method}: HTTP {r.status_code}")
        return data["result"]

    @staticmethod
    def _button(link: str | None, text: str = "Открыть") -> dict | None:
        if not link:
            return None
        # web_app открывает сайт внутри Telegram (только https); иначе — обычная ссылка
        target = {"web_app": {"url": link}} if link.startswith("https://") else {"url": link}
        return {"inline_keyboard": [[{"text": text, **target}]]}

    def send(self, chat_id: int, text: str, link: str | None = None, button: str = "Открыть") -> None:
        if not self.enabled:
            return
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
        if markup := self._button(link, button):
            payload["reply_markup"] = markup
        try:
            self._call("sendMessage", payload)
        except Exception:  # уведомление не должно ломать заказ
            log.exception("Telegram: не удалось отправить сообщение в чат %s", chat_id)

    def username(self) -> str | None:
        if self.enabled and not self._username:
            try:
                self._username = self._call("getMe")["username"]
            except Exception:
                log.exception("Telegram: getMe")
        return self._username

    def setup(self, webhook_url: str, secret: str, site_url: str) -> str:
        """Вебхук + кнопка «Магазин» в меню бота. Ошибки пробрасываются — их видит администратор."""
        self._call("setWebhook", {"url": webhook_url, "secret_token": secret, "allowed_updates": ["message"]},
                   timeout=10)
        if site_url.startswith("https://"):
            self._call("setChatMenuButton", {"menu_button": {"type": "web_app", "text": "Магазин",
                                                             "web_app": {"url": site_url}}}, timeout=10)
        self._username = self._call("getMe", timeout=10)["username"]
        self._configured = True
        return self._username

    def ensure_setup(self, webhook_url: str, secret: str, site_url: str) -> None:
        """Самонастройка: если вебхук не указывает на наш API, регистрирует его заново (раз на экземпляр)."""
        if not self.enabled or self._configured:
            return
        try:
            info = self._call("getWebhookInfo")
            if info.get("url") != webhook_url:
                self.setup(webhook_url, secret, site_url)
            self._configured = True
        except Exception:
            log.exception("Telegram: не удалось проверить вебхук")

    def verify_init_data(self, init_data: str, now: float | None = None) -> dict | None:
        """Проверяет подпись initData Telegram Mini App и возвращает пользователя Telegram."""
        if not self.enabled or not init_data:
            return None
        fields = dict(parse_qsl(init_data, keep_blank_values=True))
        received = fields.pop("hash", "")
        check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
        secret = hmac.new(b"WebAppData", self.token.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
        if not received or not hmac.compare_digest(expected, received):
            return None
        try:
            if (now or time.time()) - int(fields.get("auth_date", "0")) > INIT_DATA_TTL:
                return None
            user = json.loads(fields.get("user", "null"))
        except ValueError:
            return None
        return user if isinstance(user, dict) and isinstance(user.get("id"), int) else None


class NullNotifier:
    def send(self, chat_id: int, text: str, link: str | None = None, button: str = "Открыть") -> None:
        pass
