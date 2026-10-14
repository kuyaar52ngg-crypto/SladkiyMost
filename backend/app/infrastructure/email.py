"""Письма со ссылкой для входа через Supabase Auth (magic link).

Своего почтового сервера у площадки нет: Supabase отправляет письмо со ссылкой, ссылка ведёт на
/reset сайта с access_token в адресе, а API по этому токену узнаёт подтверждённую почту.
"""
from __future__ import annotations

import logging

import httpx

from app.domain.errors import DomainError

log = logging.getLogger(__name__)


class SupabaseEmailLinks:
    enabled = True

    def __init__(self, url: str, key: str):
        self.url, self.key = url.rstrip("/"), key

    def send_link(self, email: str, redirect_to: str) -> None:
        try:
            r = httpx.post(f"{self.url}/auth/v1/otp", params={"redirect_to": redirect_to},
                           headers={"apikey": self.key}, json={"email": email, "create_user": True}, timeout=10)
        except httpx.HTTPError as e:
            log.warning("Supabase Auth недоступен: %s", e)
            raise DomainError("Не удалось отправить письмо — попробуйте позже") from e
        if r.status_code == 429:
            raise DomainError("Письмо уже отправлено — повторить можно через минуту")
        if r.status_code >= 400:
            log.warning("Supabase Auth /otp %s: %s", r.status_code, r.text[:300])
            raise DomainError("Не удалось отправить письмо — попробуйте позже")

    def email_of(self, access_token: str) -> str | None:
        try:
            r = httpx.get(f"{self.url}/auth/v1/user", timeout=10,
                          headers={"apikey": self.key, "Authorization": f"Bearer {access_token}"})
            data = r.json() if r.status_code == 200 else {}
        except (httpx.HTTPError, ValueError):
            return None
        email = data.get("email")
        return email.lower() if email and data.get("email_confirmed_at") else None


class NullEmailLinks:
    """Почта не подключена (локальная разработка без Supabase)."""
    enabled = False

    def send_link(self, email: str, redirect_to: str) -> None:
        pass

    def email_of(self, access_token: str) -> str | None:
        return None
