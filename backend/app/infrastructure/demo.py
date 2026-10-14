"""Демо-данные: условная загрузка волн от других покупателей (чтобы были видны скидки)."""
from app.domain.entities import Direction, Wave


def demo_base_load(wave: Wave, kind: str) -> float:
    h = 0
    for c in wave.id:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    if kind == "past":
        return 190 + h % 95
    if kind == "current":
        return 128 if wave.direction == Direction.YKT_DNR else 196
    return 8 + h % 30
