"""Начальное наполнение БД: каталог (приложение А кейса) + демо-заказы.

Запуск: `uv run python -m app.infrastructure.seed` (идемпотентно — товары обновляются, заказы
создаются только в пустой БД).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.application import waves as wave_cases
from app.application.orders import (
    CartLine,
    PlaceOrderCommand,
    QuoteRequest,
    place_order,
    resolve_items,
)
from app.application.ports import UnitOfWork
from app.domain import logistics as L
from app.domain.entities import (
    PICKUP_POINTS,
    REGION_INFO,
    Direction,
    Order,
    OrderEvent,
    OrderStatus,
    Product,
    ReceiveMethod,
    Recipient,
    Region,
)

from .clock import SystemClock
from .config import settings
from .db.uow import SqlUnitOfWork, make_session_factory
from .demo import demo_base_load

Y = "ЯХК (Якутский хлебокомбинат)"
D1 = "Кондитерская «Донецкая» (усл.)"
D2 = "Фабрика «Степная сладость» (усл.)"


def _p(id, region, manufacturer, name, category, weight_g, price_rub, temp, shelf, photo, description, composition, tag=""):
    return Product(id, Region(region), manufacturer, name, category, weight_g, price_rub, temp, shelf,
                   f"/img/{photo}.jpg", description, composition, tag)


PRODUCTS = [
    _p("YKT-001", "YKT", Y, "Зефир с брусникой", "Зефир и пастила", 250, 420, False, 30, "zephyr", "Нежный зефир с лёгкой ягодной кислинкой. К чашке чая, спокойному вечеру и разговорам о самом дорогом.", "Яблочное пюре, сахар, брусничное пюре, яичный белок, пектин. Содержит яйцо.", "Ягодный вкус"),
    _p("YKT-002", "YKT", Y, "Зефир с голубикой", "Зефир и пастила", 250, 430, False, 30, "zephyr", "Воздушный зефир с северной голубикой — мягкий и не приторный.", "Яблочное пюре, сахар, пюре голубики, яичный белок, агар."),
    _p("YKT-003", "YKT", Y, "Мармелад с клюквой", "Мармелад", 200, 390, False, 90, "marmalade", "Яркий мармелад из северной клюквы в сахарной обсыпке.", "Клюквенное пюре, сахар, патока, пектин, лимонная кислота.", "Северная ягода"),
    _p("YKT-004", "YKT", Y, "Мармелад «Северная ягода»", "Мармелад", 300, 480, False, 90, "marmalade", "Ассорти мармелада: брусника, клюква, смородина, морошка.", "Ягодные пюре, сахар, патока, пектин."),
    _p("YKT-005", "YKT", Y, "Конфеты с кедровым орехом", "Шоколад и конфеты", 180, 590, True, 120, "cedar", "Шоколадные конфеты с начинкой из сибирского кедрового ореха.", "Шоколад молочный, кедровый орех, сахар, какао-масло. Может содержать следы арахиса.", "Хит"),
    _p("YKT-006", "YKT", Y, "Конфеты «Якутские ночи»", "Шоколад и конфеты", 250, 650, True, 120, "cedar", "Конфеты в тёмном шоколаде с ягодным пралине — в подарочной коробке.", "Шоколад тёмный, пралине, брусника сушёная, сахар."),
    _p("YKT-007", "YKT", Y, "Трюфели «Полярные»", "Шоколад и конфеты", 200, 610, True, 60, "truffles", "Трюфели ручной работы, обсыпанные какао, с мягкой сливочной начинкой.", "Шоколад, сливки, сливочное масло, какао-порошок."),
    _p("YKT-008", "YKT", Y, "Пряник «Олонхо» с мёдом", "Печенье и вафли", 300, 340, False, 60, "cookies", "Медовый пряник с пряностями по мотивам якутского эпоса.", "Мука пшеничная, мёд, сахар, яйцо, пряности."),
    _p("YKT-009", "YKT", Y, "Печенье овсяное с голубикой", "Печенье и вафли", 400, 320, False, 90, "cookies", "Рассыпчатое овсяное печенье с кусочками сушёной голубики.", "Овсяные хлопья, мука, сахар, масло сливочное, голубика сушёная."),
    _p("YKT-010", "YKT", Y, "Пастила брусничная", "Зефир и пастила", 150, 360, False, 60, "marmalade", "Тонкая пастила из брусники — без лишнего сахара.", "Брусничное пюре, яблочное пюре, сахар."),
    _p("YKT-011", "YKT", Y, "Шоколад с брусникой", "Шоколад и конфеты", 100, 260, True, 180, "wafers", "Молочный шоколад с хрустящей сушёной брусникой.", "Шоколад молочный, брусника сушёная."),
    _p("YKT-012", "YKT", Y, "Набор «Вкус Севера»", "Подарочные наборы", 800, 1890, True, 30, "gift", "Подарочная коробка: зефир, конфеты с кедровым орехом, мармелад и пряник.", "См. состав входящих изделий. Содержит орехи и яйцо.", "В подарок"),
    _p("DNR-001", "DNR", D1, "Трюфели с какао", "Шоколад и конфеты", 200, 560, True, 60, "truffles", "Классические трюфели с насыщенным какао — к крепкому чаю или кофе.", "Шоколад, сливки, масло сливочное, какао-порошок.", "К чаю"),
    _p("DNR-002", "DNR", D1, "Печенье «Домашнее»", "Печенье и вафли", 400, 350, False, 90, "cookies", "Песочное печенье по домашнему рецепту — тёплый вкус детства.", "Мука пшеничная, масло сливочное, сахар, яйцо, ваниль."),
    _p("DNR-003", "DNR", D2, "Вафли с шоколадом", "Печенье и вафли", 300, 310, True, 120, "wafers", "Хрустящие вафли в шоколадной глазури.", "Мука, сахар, какао, глазурь шоколадная, растительное масло."),
    _p("DNR-004", "DNR", D2, "Вафли «Донецкие» с орехом", "Печенье и вафли", 250, 290, False, 120, "wafers", "Тонкие вафли с ореховой начинкой.", "Мука, сахар, фундук, растительное масло."),
    _p("DNR-005", "DNR", D2, "Конфеты «Степные» с фундуком", "Шоколад и конфеты", 200, 540, True, 120, "cedar", "Шоколадные конфеты с цельным фундуком.", "Шоколад молочный, фундук, сахар.", "Хит"),
    _p("DNR-006", "DNR", D1, "Зефир ванильный", "Зефир и пастила", 250, 380, False, 30, "zephyr", "Классический ванильный зефир — мягкий и воздушный.", "Яблочное пюре, сахар, яичный белок, пектин, ваниль."),
    _p("DNR-007", "DNR", D1, "Мармелад вишнёвый", "Мармелад", 200, 330, False, 90, "marmalade", "Мармелад из донбасской вишни.", "Вишнёвое пюре, сахар, пектин."),
    _p("DNR-008", "DNR", D1, "Печенье с абрикосом", "Печенье и вафли", 350, 330, False, 90, "cookies", "Песочное печенье с абрикосовым джемом.", "Мука, масло сливочное, сахар, абрикосовый джем."),
    _p("DNR-009", "DNR", D2, "Шоколадные конфеты ассорти", "Шоколад и конфеты", 300, 690, True, 120, "truffles", "Ассорти конфет: пралине, трюфель, карамель.", "Шоколад, сахар, орехи, сливки."),
    _p("DNR-010", "DNR", D1, "Набор «Тепло Донбасса»", "Подарочные наборы", 750, 1690, True, 30, "gift", "Подарочная коробка: трюфели, домашнее печенье, вафли и зефир.", "См. состав входящих изделий. Содержит орехи и яйцо.", "В подарок"),
]

DEMO_NAME, DEMO_PHONE = "Анна Морозова", "+7 (914) 123-45-67"


def _past_order(uow: UnitOfWork, wave, lines, statuses: list[OrderStatus]) -> None:
    """Исторический заказ в уже закрытой волне (минуя проверку открытости — только для демо)."""
    items = resolve_items(uow, [CartLine(pid, q) for pid, q in lines])
    q = L.quote(items, wave, 0)
    created = wave.cutoff - timedelta(days=3)
    dest = wave.direction.destination
    o = Order(
        number=uow.orders.next_number(), created_at=datetime(created.year, created.month, created.day, 9, tzinfo=timezone.utc),
        customer_name=DEMO_NAME, customer_phone=DEMO_PHONE,
        recipient=Recipient(DEMO_NAME, DEMO_PHONE, dest, REGION_INFO[dest]["city"], ReceiveMethod.PICKUP, PICKUP_POINTS[dest][0]),
        items=items, direction=wave.direction, wave_id=wave.id, goods_rub=q.goods_rub, weight_kg=q.weight_kg,
        rate_rub=q.rate, delivery_rub=q.delivery_rub, thermo_rub=q.thermo_rub, gift_rub=0, receive_rub=0,
        total_rub=q.total_rub, history=[OrderEvent(OrderStatus.ACCEPTED, created, "Заказ принят и оплачен (имитация оплаты)")],
    )
    for s in statuses:
        o.move_to(s, created)
    uow.orders.add(o)


def seed(uow_factory) -> None:
    today = SystemClock(settings.today).today()
    with uow_factory() as uow:
        for p in PRODUCTS:
            if not uow.products.get(p.id):
                uow.products.save(p)
        uow.commit()
        wave_cases.sync_schedule(uow, today, demo_base_load if settings.demo_load else wave_cases.no_base_load)
        if uow.orders.list():
            return
        past = [w for w in uow.waves.list(Direction.DNR_YKT) if w.cutoff < today]
        if len(past) >= 3:
            _past_order(uow, past[-3], [("DNR-001", 1), ("DNR-002", 2)],
                        [OrderStatus.ASSEMBLING, OrderStatus.TRANSIT, OrderStatus.PICKUP, OrderStatus.RECEIVED])
        if past:
            _past_order(uow, past[-1], [("DNR-003", 2), ("DNR-005", 1)], [OrderStatus.ASSEMBLING, OrderStatus.TRANSIT])
        uow.commit()
        open_ykt = wave_cases.list_waves(uow, today, Direction.YKT_DNR, only_open=True)
        if open_ykt:
            place_order(uow, today, PlaceOrderCommand(
                quote=QuoteRequest([CartLine("YKT-001", 2), CartLine("YKT-005", 1)], open_ykt[0].wave.id, gift=True),
                customer_name=DEMO_NAME, customer_phone=DEMO_PHONE,
                recipient_name="Елена Морозова", recipient_phone="+7 (949) 555-24-18",
                pickup_point=PICKUP_POINTS[Region.DNR][0],
                gift_message="Мама, пусть этот подарок напомнит о наших чаепитиях. Обнимаю, даже когда далеко.",
                gift_signature="Твоя Аня", gift_surprise=True, consent=True,
            ))


if __name__ == "__main__":
    seed(lambda: SqlUnitOfWork(make_session_factory(settings.database_url)))
    print("Seed: OK")
