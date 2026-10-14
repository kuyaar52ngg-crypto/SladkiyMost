"""Справочники и настройки площадки: категории каталога, тексты сайта, параметры приёма заказов."""
from __future__ import annotations

import copy

from app.domain.entities import Category
from app.domain.errors import Conflict, DomainError, NotFound

from .ports import ProductFilter, UnitOfWork

DEFAULT_CATEGORIES = ["Зефир и пастила", "Шоколад и конфеты", "Печенье и вафли", "Мармелад", "Подарочные наборы"]


# ---------------- категории ----------------
def ensure_categories(uow: UnitOfWork) -> None:
    """Пустой справочник заполняется стартовым набором (первый запуск)."""
    if not uow.categories.list():
        for i, name in enumerate(DEFAULT_CATEGORIES):
            uow.categories.add(Category(None, name, i))
        uow.commit()


def category_names(uow: UnitOfWork, with_hidden: bool = False) -> list[str]:
    return [c.name for c in uow.categories.list() if with_hidden or c.active]


def categories(uow: UnitOfWork) -> list[tuple[Category, int]]:
    """Категории с числом товаров (включая скрытые товары)."""
    counts: dict[str, int] = {}
    for p in uow.products.list(ProductFilter(include_inactive=True)):
        counts[p.category] = counts.get(p.category, 0) + 1
    return [(c, counts.get(c.name, 0)) for c in uow.categories.list()]


def _get_category(uow: UnitOfWork, category_id: int) -> Category:
    c = uow.categories.get(category_id)
    if not c:
        raise NotFound("Категория не найдена")
    return c


def _category_name(uow: UnitOfWork, name: str, skip_id: int | None = None) -> str:
    name = " ".join((name or "").split())
    if len(name) < 2:
        raise DomainError("Название категории — не короче 2 символов")
    if len(name) > 60:
        raise DomainError("Название категории — не длиннее 60 символов")
    if any(c.name.lower() == name.lower() and c.id != skip_id for c in uow.categories.list()):
        raise Conflict("Такая категория уже есть")
    return name


def create_category(uow: UnitOfWork, name: str) -> Category:
    existing = uow.categories.list()
    c = Category(None, _category_name(uow, name), max((x.position for x in existing), default=-1) + 1)
    uow.categories.add(c)
    uow.commit()
    return c


def update_category(uow: UnitOfWork, category_id: int, name: str | None = None, active: bool | None = None) -> Category:
    """Переименование переносит товары в новое название; скрытая категория пропадает из фильтров витрины."""
    c = _get_category(uow, category_id)
    if name is not None:
        new = _category_name(uow, name, skip_id=c.id)
        if new != c.name:
            for p in uow.products.list(ProductFilter(include_inactive=True, categories=[c.name])):
                p.category = new
                uow.products.save(p)
            c.name = new
    if active is not None:
        c.active = active
    uow.categories.save(c)
    uow.commit()
    return c


def move_category(uow: UnitOfWork, category_id: int, delta: int) -> list[Category]:
    items = uow.categories.list()
    i = next((k for k, c in enumerate(items) if c.id == category_id), None)
    if i is None:
        raise NotFound("Категория не найдена")
    j = max(0, min(len(items) - 1, i + delta))
    items.insert(j, items.pop(i))
    for pos, c in enumerate(items):
        if c.position != pos:
            c.position = pos
            uow.categories.save(c)
    uow.commit()
    return items


def delete_category(uow: UnitOfWork, category_id: int) -> None:
    c = _get_category(uow, category_id)
    if uow.products.list(ProductFilter(include_inactive=True, categories=[c.name])):
        raise Conflict("В категории есть товары — перенесите их или скройте категорию")
    uow.categories.delete(c.id)
    uow.commit()


# ---------------- тексты сайта ----------------
CONTENT_KEY = "content"
CONTENT_DEFAULTS: dict = {
    "banner": {"enabled": False, "text": "", "link": ""},
    "hero": {
        "overline": "Якутия и Донбасс · с любовью к родному",
        "title": "Вкус родного края — ближе, чем кажется",
        "subtitle": "Любимые сладости из Якутии и Донбасса. Объединяем заказы в сборные отправки, чтобы доставка была выгоднее.",
        "note": "Для себя, к семейному чаепитию и в подарок близким.",
    },
    "contacts": {"phone": "", "email": "", "telegram": "", "hours": ""},
    "footer": {"tagline": "Сладости, которые делают расстояния меньше."},
}
# ограничения длины полей: (блок, поле) -> символов
CONTENT_LIMITS = {
    ("banner", "text"): 200, ("banner", "link"): 300,
    ("hero", "overline"): 80, ("hero", "title"): 90, ("hero", "subtitle"): 300, ("hero", "note"): 160,
    ("contacts", "phone"): 40, ("contacts", "email"): 160, ("contacts", "telegram"): 100, ("contacts", "hours"): 100,
    ("footer", "tagline"): 160,
}
REQUIRED = {("hero", "title")}


def _link(value: str) -> str:
    if value and not (value.startswith("https://") or (value.startswith("/") and not value.startswith("//"))):
        raise DomainError("Ссылка — адрес страницы сайта (/catalog) или https://…")
    return value


def _merge(defaults: dict, stored: dict | None) -> dict:
    out = copy.deepcopy(defaults)
    for k, v in (stored or {}).items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k].update({f: x for f, x in v.items() if f in out[k] and type(x) is type(out[k][f])})
        elif k in out and type(v) is type(out[k]):
            out[k] = v
    return out


def site_content(uow: UnitOfWork) -> dict:
    return _merge(CONTENT_DEFAULTS, uow.settings.get(CONTENT_KEY))


def save_site_content(uow: UnitOfWork, data: dict) -> dict:
    content = _merge(CONTENT_DEFAULTS, data)
    for (block, f), limit in CONTENT_LIMITS.items():
        v = " ".join(str(content[block][f]).split())
        if (block, f) in REQUIRED and not v:
            raise DomainError("Заполните заголовок главной страницы")
        if len(v) > limit:
            raise DomainError(f"Слишком длинный текст: не больше {limit} символов")
        content[block][f] = v
    _link(content["banner"]["link"])
    if content["banner"]["enabled"] and not content["banner"]["text"]:
        raise DomainError("Добавьте текст объявления или выключите его")
    tg = content["contacts"]["telegram"]
    if tg and not (tg.startswith("@") or tg.startswith("https://t.me/")):
        raise DomainError("Telegram — в виде @username или https://t.me/…")
    uow.settings.put(CONTENT_KEY, content)
    uow.commit()
    return content


# ---------------- настройки площадки ----------------
SETTINGS_KEY = "settings"
SETTINGS_DEFAULTS: dict = {
    "orders_open": True,
    "orders_closed_message": "Приём заказов временно приостановлен. Загляните чуть позже!",
    "min_order_rub": 0,
    "reviews_premoderation": True,
}


def platform_settings(uow: UnitOfWork) -> dict:
    return _merge(SETTINGS_DEFAULTS, uow.settings.get(SETTINGS_KEY))


def save_platform_settings(uow: UnitOfWork, data: dict) -> dict:
    s = _merge(SETTINGS_DEFAULTS, data)
    s["orders_closed_message"] = " ".join(s["orders_closed_message"].split())[:300] or SETTINGS_DEFAULTS["orders_closed_message"]
    if not 0 <= s["min_order_rub"] <= 1_000_000:
        raise DomainError("Минимальная сумма заказа — от 0 до 1 000 000 ₽")
    uow.settings.put(SETTINGS_KEY, s)
    uow.commit()
    return s
