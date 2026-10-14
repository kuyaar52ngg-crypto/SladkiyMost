"""Аккаунты: регистрация и вход покупателя, первый администратор, привязка Telegram, восстановление пароля."""
from __future__ import annotations

import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta

from app.domain.entities import Role, User
from app.domain.errors import Conflict, DomainError, Forbidden, NotFound, Unauthorized

from .orders import PHONE_RE, phone_digits
from .ports import EmailLinks, Notifier, PasswordHasher, ResetTokens, UnitOfWork

log = logging.getLogger(__name__)

MAX_FAILED_LOGINS = 5
LOCK_FOR = timedelta(minutes=15)
MIN_PASSWORD = 8
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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
    email = (email or "").strip()
    if email and (len(email) > 160 or not EMAIL_RE.match(email)):
        raise DomainError("Проверьте адрес электронной почты")
    user = User(id=None, role=Role.CUSTOMER, phone=phone, name=name, password_hash=hasher.hash(password),
                email=email or None)
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


def attach_telegram(uow: UnitOfWork, user_id: int, chat_id: int) -> User:
    """Привязка из Telegram Mini App: личный чат с ботом совпадает с id пользователя Telegram."""
    user = get_user(uow, user_id)
    if user.tg_chat_id != chat_id:
        user.tg_chat_id, user.tg_link_token = chat_id, None
        uow.users.save(user)
        uow.commit()
    return user


def by_telegram(uow: UnitOfWork, chat_id: int) -> User | None:
    return uow.users.by_chat(chat_id)


def link_telegram(uow: UnitOfWork, token: str, chat_id: int) -> User | None:
    user = uow.users.by_link_token(token) if token else None
    if not user:
        return None
    user.tg_chat_id, user.tg_link_token = chat_id, None
    uow.users.save(user)
    uow.commit()
    return user


# ---------------- восстановление пароля ----------------
def password_fingerprint(password_hash: str) -> str:
    """Отпечаток текущего пароля: ссылка сброса перестаёт работать, как только пароль сменён."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def request_password_reset(uow: UnitOfWork, mail: EmailLinks, tokens: ResetTokens, notifier: Notifier,
                           login: str, site_url: str) -> None:
    """Ссылка для смены пароля — на почту (письмо Supabase Auth) и в Telegram, если он привязан.

    Ответ не зависит от того, найден ли аккаунт: так нельзя перебором узнать, кто зарегистрирован.
    """
    login = (login or "").strip()
    if "@" in login:
        if len(login) > 160:
            raise DomainError("Проверьте адрес электронной почты")
        if uow.users.by_email(login) and mail.enabled:
            mail.send_link(login.lower(), f"{site_url}/reset")
        return
    if len(phone_digits(login)) != 10:
        raise DomainError("Укажите телефон или электронную почту из профиля")
    user = uow.users.by_phone(phone_digits(login))
    if not user:
        return
    if user.tg_chat_id:
        token = tokens.issue(user.id, password_fingerprint(user.password_hash))
        notifier.send(user.tg_chat_id, "🔑 Запрошена смена пароля на «Сладком мосте». Ссылка действует 1 час. "
                      "Если это были не вы — просто проигнорируйте сообщение.",
                      link=f"{site_url}/reset?t={token}", button="Сменить пароль")
    if user.email and mail.enabled:
        mail.send_link(user.email.lower(), f"{site_url}/reset")


def reset_password(uow: UnitOfWork, hasher: PasswordHasher, mail: EmailLinks, tokens: ResetTokens, password: str,
                   token: str = "", access_token: str = "") -> User:
    """Новый пароль по ссылке из Telegram (token) или из письма (access_token сессии Supabase Auth)."""
    _password(password)
    if token:
        found = tokens.read(token)
        user = uow.users.get(found[0]) if found else None
        if not user or found[1] != password_fingerprint(user.password_hash):
            raise Unauthorized("Ссылка устарела — запросите новую")
    elif access_token:
        email = mail.email_of(access_token) if mail.enabled else None
        if not email:
            raise Unauthorized("Ссылка из письма устарела — запросите новую")
        users = uow.users.by_email(email)
        if not users:
            raise NotFound("Аккаунт с этой почтой не найден")
        if len(users) > 1:
            raise Conflict("К этой почте привязано несколько аккаунтов — восстановите доступ по номеру телефона")
        user = users[0]
    else:
        raise Unauthorized("Откройте ссылку из письма или из Telegram")
    user.password_hash = hasher.hash(password)
    user.failed_logins, user.locked_until = 0, None
    uow.users.save(user)
    uow.commit()
    return user
