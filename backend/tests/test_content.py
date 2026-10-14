"""Категории, отзывы, тексты сайта, настройки площадки и восстановление пароля."""

import pytest

from app.application import auth, catalog, content
from app.application import reviews as R
from app.domain.entities import Region, ReviewStatus
from app.domain.errors import Conflict, DomainError, Forbidden, Unauthorized
from app.infrastructure.security import ResetLinkTokens

from .fakes import FakeMail, FakeNotifier
from .test_accounts import H, TODAY, place, uow  # noqa: F401 — фикстура uow


def product_data(**kw):
    d = dict(name="Пастила", region=Region.YKT, manufacturer="Фабрика", category="Мармелад", weight_g=200, price_rub=300,
             temp_sensitive=False, shelf_life_days=30, photos=["https://cdn.test/a.jpg"])
    return catalog.ProductData(**{**d, **kw})


def test_categories(uow):
    c = content.create_category(uow, "  Чак-чак ")
    assert c.name == "Чак-чак" and content.category_names(uow)[-1] == "Чак-чак"
    with pytest.raises(Conflict):
        content.create_category(uow, "чак-чак")
    p = catalog.save_product(uow, product_data(category="Чак-чак"))
    # переименование переносит товары, удалить категорию с товарами нельзя
    content.update_category(uow, c.id, name="Чак-чак и халва")
    assert uow.products.get(p.id).category == "Чак-чак и халва"
    with pytest.raises(Conflict):
        content.delete_category(uow, c.id)
    # скрытая — пропадает с витрины, но товары в ней можно редактировать
    content.update_category(uow, c.id, active=False)
    assert "Чак-чак и халва" not in content.category_names(uow)
    catalog.save_product(uow, product_data(category="Чак-чак и халва", price_rub=350), p.id)
    with pytest.raises(DomainError):
        catalog.save_product(uow, product_data(category="Нет такой"))
    first = content.move_category(uow, c.id, -100)[0]
    assert first.id == c.id
    uow.products.delete(p.id)
    content.delete_category(uow, c.id)
    assert "Чак-чак и халва" not in content.category_names(uow, with_hidden=True)


def test_reviews_only_for_received_orders(uow):
    from app.application import orders as O
    from app.domain.entities import OrderStatus

    u = auth.register(uow, H, "+7 (914) 111-22-33", "Анна Морозова", "secret123")
    o = place(uow, u.id)
    assert R.to_review(uow, u) == []
    with pytest.raises(Forbidden):
        R.leave_review(uow, u, "YKT-001", 5, "Вкусно")
    for s in (OrderStatus.ASSEMBLING, OrderStatus.TRANSIT, OrderStatus.PICKUP, OrderStatus.RECEIVED):
        O.change_order_status(uow, TODAY, o.code, s)
    assert [x.product_id for x in R.to_review(uow, u)] == ["YKT-001"]
    with pytest.raises(DomainError):
        R.leave_review(uow, u, "YKT-001", 6, "")
    r = R.leave_review(uow, u, "YKT-001", 5, "Очень вкусно")
    assert r.status == ReviewStatus.PENDING and r.author == "Анна"
    assert R.product_reviews(uow, "YKT-001").count == 0           # на модерации — не видно
    with pytest.raises(Conflict):
        R.leave_review(uow, u, "YKT-001", 4, "Ещё раз")
    R.moderate(uow, r.id, ReviewStatus.PUBLISHED, "Спасибо!")
    s = R.product_reviews(uow, "YKT-001")
    assert (s.count, s.rating, s.reviews[0].reply) == (1, 5.0, "Спасибо!")


def test_content_and_settings(uow):
    c = content.site_content(uow)
    assert c["hero"]["title"] and c["banner"]["enabled"] is False
    c["banner"] = {"enabled": True, "text": "Скидка на зефир", "link": "/catalog"}
    c["contacts"]["telegram"] = "@sladkiy_most"
    assert content.save_site_content(uow, c)["banner"]["text"] == "Скидка на зефир"
    with pytest.raises(DomainError):
        content.save_site_content(uow, {**c, "banner": {"enabled": True, "text": "x", "link": "javascript:alert(1)"}})
    with pytest.raises(DomainError):
        content.save_site_content(uow, {**c, "hero": {**c["hero"], "title": "  "}})

    content.save_platform_settings(uow, {**content.platform_settings(uow), "orders_open": False,
                                         "orders_closed_message": "Уехали на ярмарку"})
    with pytest.raises(Conflict, match="ярмарку"):
        place(uow)
    content.save_platform_settings(uow, {**content.platform_settings(uow), "orders_open": True, "min_order_rub": 100000})
    with pytest.raises(DomainError, match="Минимальная"):
        place(uow)
    content.save_platform_settings(uow, {**content.platform_settings(uow), "min_order_rub": 0,
                                         "reviews_premoderation": False})
    assert place(uow).number


def test_password_reset_by_telegram_and_email(uow):
    mail, tokens, bot = FakeMail(), ResetLinkTokens("secret-of-sufficient-length-for-tests"), FakeNotifier()
    u = auth.register(uow, H, "+7 (914) 111-22-33", "Анна", "secret123", email="Anna@Example.ru")
    auth.attach_telegram(uow, u.id, 777)

    # неизвестный телефон/почта — тихо, без подсказки, что аккаунта нет
    auth.request_password_reset(uow, mail, tokens, bot, "+7 (900) 123-45-67", "https://site")
    auth.request_password_reset(uow, mail, tokens, bot, "nobody@example.ru", "https://site")
    assert bot.sent == [] and mail.sent == []

    auth.request_password_reset(uow, mail, tokens, bot, "8 914 111 22 33", "https://site")
    assert bot.sent[0][0] == 777 and mail.sent == [("anna@example.ru", "https://site/reset")]
    token = bot.links[0].split("?t=")[1]
    auth.reset_password(uow, H, mail, tokens, "brand-new-pass", token=token)
    assert H.verify("brand-new-pass", uow.users.get(u.id).password_hash)
    with pytest.raises(Unauthorized):                         # ссылка одноразовая: пароль уже другой
        auth.reset_password(uow, H, mail, tokens, "another-pass-1", token=token)

    auth.request_password_reset(uow, mail, tokens, bot, "anna@example.ru", "https://site")
    user = auth.reset_password(uow, H, mail, tokens, "from-email-pass", access_token="token-for:anna@example.ru")
    assert user.id == u.id and H.verify("from-email-pass", uow.users.get(u.id).password_hash)
    with pytest.raises(Unauthorized):
        auth.reset_password(uow, H, mail, tokens, "from-email-pass", access_token="garbage")
    with pytest.raises(DomainError):
        auth.reset_password(uow, H, mail, tokens, "short", token=token)
