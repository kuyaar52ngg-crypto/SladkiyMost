"""Ошибки предметной области — транслируются в HTTP-коды на уровне presentation."""


class DomainError(Exception):
    """Нарушено бизнес-правило (HTTP 400)."""


class NotFound(DomainError):
    """Сущность не найдена (HTTP 404)."""


class Conflict(DomainError):
    """Действие невозможно в текущем состоянии (HTTP 409)."""


class Forbidden(DomainError):
    """Нет доступа (HTTP 403)."""
