"""Unit of Work: одна транзакция PostgreSQL на сценарий."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from .repositories import (
    SqlAddressRepository,
    SqlNotificationRepository,
    SqlOrderRepository,
    SqlProductRepository,
    SqlShopOrderRepository,
    SqlShopRepository,
    SqlTicketRepository,
    SqlUserRepository,
    SqlWaveRepository,
)


def make_session_factory(url: str, serverless: bool = False) -> sessionmaker[Session]:
    if serverless:
        # Serverless (Vercel) + transaction pooler Supabase (порт 6543): без пула соединений
        # в процессе и без server-side prepared statements, которые пулер не поддерживает.
        engine = create_engine(url, poolclass=NullPool, connect_args={"prepare_threshold": None})
    else:
        engine = create_engine(url, pool_pre_ping=True)
    return sessionmaker(engine, expire_on_commit=False)


class SqlUnitOfWork:
    def __init__(self, session_factory: sessionmaker[Session]):
        self._factory = session_factory

    def __enter__(self) -> "SqlUnitOfWork":
        self.session = self._factory()
        self.products = SqlProductRepository(self.session)
        self.waves = SqlWaveRepository(self.session)
        self.orders = SqlOrderRepository(self.session)
        self.users = SqlUserRepository(self.session)
        self.addresses = SqlAddressRepository(self.session)
        self.notifications = SqlNotificationRepository(self.session)
        self.tickets = SqlTicketRepository(self.session)
        self.shops = SqlShopRepository(self.session)
        self.shop_orders = SqlShopOrderRepository(self.session)
        return self

    def __exit__(self, *exc) -> None:
        self.session.rollback()
        self.session.close()

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
