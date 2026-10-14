# Сладкий мост — маркетплейс сладостей Якутия ⇄ Донбасс

**Демо:** https://sladkiy-most.vercel.app

**Запуск локально:** `docker compose up --build` 

## Стек

| Слой | Технологии |
|---|---|
| Фронтенд | **Next.js 15** (App Router, RSC), **React 19**, **TypeScript**, **Tailwind CSS 4** |
| Бэкенд | **Python 3.12+**, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic |
| База данных | **PostgreSQL 16** |
| Тесты | pytest (домен, use cases, API на реальном PostgreSQL) |

## Архитектура 

```
backend/app/
  domain/            ← ядро: сущности, правила волн, тарифы, сезонность.
    entities.py        Product, Wave, Order, статусы, направления
    logistics.py       расписание волн, тариф от заполнения, расчёт доставки, термоупаковка
    errors.py
  application/       ← сценарии (use cases); зависят только от domain и портов
    ports.py           интерфейсы репозиториев, UnitOfWork, Clock
    waves.py           расписание, витрина волн, предложения для корзины, смена статуса волны
    orders.py          расчёт, оформление, отмена, отслеживание
    catalog.py, analytics.py
  infrastructure/    ← реализация портов: PostgreSQL (SQLAlchemy), настройки, seed
  presentation/api/  ← FastAPI: роутеры, Pydantic-схемы, трансляция ошибок в HTTP
  main.py            ← composition root: связывает infrastructure и presentation
migrations/          ← Alembic

frontend/src/
  app/               маршруты: (shop)/… — витрина и оформление, admin/… — кабинет администратора
  features/          сценарии UI: корзина и состояние (shop), каталог, оформление, заказы, доставка
  widgets/           шапка, подвал, мобильная навигация, карточки товара и волны
  shared/            API-клиент и типы, форматирование, UI-примитивы
```

Зависимости направлены внутрь: `presentation → application → domain`, `infrastructure → application/domain`.
Бизнес-логика живёт только в бэкенде: фронтенд получает расчёт доставки из API
(`/api/waves/offers`, `/api/quote`, `/api/quote/estimate`).

## Запуск

**Docker (всё сразу):**
```bash
docker compose up --build      
```

**Локально:**
```bash
# 1. Бэкенд
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.infrastructure.seed      
uv run uvicorn app.main:app --reload          
# 2. Фронтенд
cd frontend
npm install
npm run dev                                    
```




## Функционал 

| Требование | Где |
|---|---|
| Двусторонний каталог, витрины «Сладости Якутии» / «Сладости Донбасса», карточки, фильтры, поиск, корзина | `/catalog`, `/product/[id]`, `/cart` |
| Сборные отправки: дата отправки, окончание приёма, заполненность партии | `/checkout/wave`, главная, `/delivery` |
| Расчёт доставки от веса заказа и заполнения партии | `/checkout/calc`, калькулятор на `/delivery` |
| Отслеживание: принят → в сборке → в пути → на пункте выдачи → получен | `/orders`, `/orders/[code]` |
| Подарочный сценарий: получатель в другом регионе, открытка, подпись, сюрприз | `/gift`, шаг «Оформление» |
| Кабинет администратора: товары, волны, статусы заказов | `/admin` |
| Оплата — имитация (заглушка) | шаг «Оформление» |


## Бизнес-модель
Комиссия 15 % с продажи товаров; подарочное оформление (250 ₽); термоупаковка (150 ₽); корпоративные наборы (B2B).
Доставка продаётся по себестоимости доли в партии.
