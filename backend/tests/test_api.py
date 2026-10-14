"""Интеграционные тесты API на реальном PostgreSQL (TEST_DATABASE_URL). Пропускаются без БД."""
import os
from datetime import date

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

URL = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://sm:sm@localhost:5432/sladkiy_most_test")


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.infrastructure.clock import SystemClock
    from app.infrastructure.db.models import Base
    from app.infrastructure.db.uow import SqlUnitOfWork, make_session_factory
    from tests.catalog_data import PRODUCTS
    from app.presentation.api.app import create_app
    from app.presentation.api.deps import Container

    try:
        engine = create_engine(URL)
        with engine.begin() as c:
            c.execute(text("SELECT 1"))
    except OperationalError:
        pytest.skip("PostgreSQL недоступен")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    sessions = make_session_factory(URL)
    with SqlUnitOfWork(sessions) as u:
        for p in PRODUCTS:
            u.products.save(p)
        u.commit()
    app = create_app(Container(lambda: SqlUnitOfWork(sessions), SystemClock(date(2026, 10, 14)), "secret"))
    return TestClient(app)


def test_end_to_end_order_flow(client):
    assert len(client.get("/api/products", params={"region": "DNR"}).json()) == 3
    offers = client.post("/api/waves/offers", json={"items": [{"id": "DNR-001", "qty": 2}]}).json()
    wave = offers[0]["wave"]
    assert wave["direction"] == "DNR-YKT" and offers[0]["quote"]["delivery_rub"] > 0

    body = {"items": [{"id": "DNR-001", "qty": 2}], "wave_id": wave["id"], "customer_name": "Иван",
            "customer_phone": "+7 (914) 222-33-44", "recipient_name": "Иван", "recipient_phone": "+7 (914) 222-33-44",
            "pickup_point": "Якутск", "consent": True}
    r = client.post("/api/orders", json=body)
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    assert client.get("/api/orders", params={"phone": "89142223344"}).json()[0]["code"] == code

    assert client.get("/api/admin/stats").status_code == 401
    h = {"X-Admin-Token": "secret"}
    r = client.post(f"/api/admin/waves/{wave['id']}/status", json={"status": "closed"}, headers=h)
    assert r.status_code == 200
    assert client.get(f"/api/orders/{code}").json()["status"] == "assembling"
    assert client.post("/api/orders", json=body).status_code == 409   # волна закрыта


def test_validation_errors(client):
    assert client.post("/api/waves/offers", json={"items": [{"id": "YKT-001", "qty": 1}, {"id": "DNR-001", "qty": 1}]}).status_code == 400
    assert client.get("/api/orders/СМ-99999").status_code == 404
