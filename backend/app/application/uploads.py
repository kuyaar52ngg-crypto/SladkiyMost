"""Загрузка фото товаров: файл идёт из браузера прямо в хранилище по подписанной ссылке.

HEIC/HEIF, TIFF, BMP и ICO браузер заранее конвертирует в JPEG — сюда приходят только
форматы, которые умеют показывать все браузеры.
"""
from __future__ import annotations

import uuid
from datetime import date

from app.domain.errors import DomainError

from .ports import ImageStorage, SignedUpload

MAX_BYTES = 20 * 1024 * 1024

EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/svg+xml": "svg",
}


def request_upload(storage: ImageStorage, content_type: str, size: int, today: date) -> SignedUpload:
    ct = (content_type or "").split(";")[0].strip().lower()
    ext = EXTENSIONS.get(ct)
    if not ext:
        raise DomainError("Этот формат не поддерживается: загрузите JPG, PNG, WEBP, AVIF, GIF, SVG, HEIC, TIFF или BMP")
    if size <= 0:
        raise DomainError("Файл пустой")
    if size > MAX_BYTES:
        raise DomainError("Файл больше 20 МБ")
    path = f"{today:%Y/%m}/{uuid.uuid4().hex}.{ext}"
    return storage.signed_upload(path, ct)
