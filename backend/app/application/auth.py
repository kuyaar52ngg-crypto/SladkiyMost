"""Аккаунты: регистрация и вход покупателя, первый администратор, привязка Telegram."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from app.domain.entities import Role, User
from app.domain.errors import Conflict, DomainError, Forbidden, NotFound, Unauthorized

from .orders import PHONE_RE, phone_digits
from .ports import PasswordHasher, UnitOfWork

MAX_FAILED_LOGINS = 5
LOCK_FOR = timedelta(minutes=15)
MIN_PASSWORD = 8


def _phone(phone: str) -> str:
    phone = (phone or "").strip()
    if not PHONE_RE.match(phone) or len(phone_digits(phone)) != 10:
        raise DomainError("Проверьте номер телефона")
    return phone[:40]


def _password(password: str) -> str:
    if len(password or "") < MIN_PASSWORD:
        raise DomainError(f"Пароль — не короче {MIN_PASSWORD} символов")
    if len(password) > 128:
        raise DomainError("Слишком длинный пароль")
    return password


def register(uow: UnitOfWork, hasher: PasswordHasher, phone: str, name: str, password: str,
             email: str | None = None) -> User:
    phone, name = _phone(phone), (name or "").strip()[:120]
    if not name:
        raise DomainError("Укажите имя")
    _password(password)
    if uow.users.by_phone(phone_digits(phone)):
        raise Conflict("Этот телефон уже зарегистрирован — войдите")
    user = User(id=None, role=Role.CUSTOMER, phone=phone, name=name, password_hash=hasher.hash(password),
                email=(email or "").strip()[:160] or None)
    uow.users.add(user)
    uow.commit()
    return user


def authenticate(uow: UnitOfWork, hasher: PasswordHasher, phone: str, password: str, now: datetime) -> User:
    user = uow.users.by_phone(phone_digits(phone))
    if user and user.locked_until and user.locked_until > now:
        minutes = max(1, round((user.locked_until - now).total_seconds() / 60))
        raise Forbidden(f"Слишком много попыток входа. Попробуйте через {minutes} мин.")
    if not user or not hasher.verify(password or "", user.password_hash):
        if user:
            user.failed_logins += 1
            if user.failed_logins >= MAX_FAILED_LOGINS:
                user.failed_logins, user.locked_until = 0, now + LOCK_FOR
            uow.users.save(user)
            uow.commit()
        raise Unauthorized("Неверный телефон или пароль")
    if user.failed_logins or user.locked_until:
        user.failed_logins, user.locked_until = 0, None
        uow.users.save(user)
        uow.commit()
    return user


def get_user(uow: UnitOfWork, user_id: int) -> User:
    user = uow.users.get(user_id)
    if not user:
        raise NotFound("Пользователь не найден")
    return user


def ensure_admin(uow: UnitOfWork, hasher: PasswordHasher, phone: str, password: str) -> User | None:
    """Создаёт первого администратора из настроек окружения, если администраторов ещё нет."""
    if not phone or not password or uow.users.admins():
        return None
    phone = _phone(phone)
    user = uow.users.by_phone(phone_digits(phone))
    if user:
        user.role, user.password_hash = Role.ADMIN, hasher.hash(_password(password))
        uow.users.save(user)
    else:
        user = User(id=None, role=Role.ADMIN, phone=phone, name="Администратор",
                    password_hash=hasher.hash(_password(password)))
        uow.users.add(user)
    uow.commit()
    return user


def telegram_link_token(uow: UnitOfWork, user_id: int) -> str:
    """Одноразовый токен для deep link t.me/<бот>?start=<токен>."""
    user = get_user(uow, user_id)
    user.tg_link_token = secrets.token_urlsafe(24)
    uow.users.save(user)
    uow.commit()
    return user.tg_link_token


def link_telegram(uow: UnitOfWork, token: str, chat_id: int) -> User | None:
    user = uow.users.by_link_token(token) if token else None
    if not user:
        return None
    user.tg_chat_id, user.tg_link_token = chat_id, None
    uow.users.save(user)
    uow.commit()
    return user
