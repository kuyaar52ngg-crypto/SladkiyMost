"""Хеширование паролей (Argon2) и подпись сессий (JWT)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash


class Argon2Hasher:
    def __init__(self):
        self._h = PasswordHash.recommended()

    def hash(self, password: str) -> str:
        return self._h.hash(password)

    def verify(self, password: str, password_hash: str) -> bool:
        try:
            return self._h.verify(password, password_hash)
        except Exception:
            return False


class SessionTokens:
    def __init__(self, secret: str, ttl: timedelta = timedelta(days=30)):
        self.secret, self.ttl = secret, ttl

    def issue(self, user_id: int) -> str:
        now = datetime.now(timezone.utc)
        return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + self.ttl}, self.secret, algorithm="HS256")

    def read(self, token: str) -> int | None:
        try:
            return int(jwt.decode(token, self.secret, algorithms=["HS256"])["sub"])
        except (jwt.PyJWTError, KeyError, ValueError):
            return None
