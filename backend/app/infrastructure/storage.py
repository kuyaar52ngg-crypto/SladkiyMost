"""Хранилище фото товаров.

SupabaseStorage — публичный bucket Supabase Storage (прод). LocalStorage — папка на диске для
локальной разработки без Supabase: файлы принимает и раздаёт сам API.
"""
from __future__ import annotations

from pathlib import Path

import httpx

from app.application.ports import SignedUpload
from app.domain.errors import DomainError


class SupabaseStorage:
    def __init__(self, url: str, service_key: str, bucket: str = "products"):
        self.url, self.key, self.bucket = url.rstrip("/"), service_key, bucket

    def signed_upload(self, path: str, content_type: str) -> SignedUpload:
        try:
            r = httpx.post(f"{self.url}/storage/v1/object/upload/sign/{self.bucket}/{path}",
                           headers={"Authorization": f"Bearer {self.key}", "apikey": self.key}, json={}, timeout=10)
            r.raise_for_status()
            signed = r.json()["url"]
        except (httpx.HTTPError, KeyError, ValueError) as e:
            raise DomainError("Хранилище фото недоступно, попробуйте позже") from e
        return SignedUpload(upload_url=f"{self.url}/storage/v1{signed}",
                            public_url=f"{self.url}/storage/v1/object/public/{self.bucket}/{path}")


class LocalStorage:
    """Файлы загружаются PUT-запросом в /api/admin/uploads/local/… и отдаются из /api/media/…"""

    def __init__(self, root: str = "uploads"):
        self.root = Path(root).resolve()

    def signed_upload(self, path: str, content_type: str) -> SignedUpload:
        return SignedUpload(upload_url=f"/api/admin/uploads/local/{path}", public_url=f"/api/media/{path}")

    def file(self, path: str) -> Path:
        p = (self.root / path).resolve()
        if self.root not in p.parents:
            raise DomainError("Некорректный путь")
        return p
