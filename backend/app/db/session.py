"""Synchronous SQLAlchemy engine (psycopg 3). Async routes call it through a worker thread."""

from __future__ import annotations

from functools import lru_cache

from sqlalchemy import Engine, create_engine, text

from app.core.config import get_settings


def make_engine(url: str) -> Engine:
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_timeout=10,
        connect_args={"connect_timeout": 10},
    )


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return make_engine(get_settings().database_url)


def ping(engine: Engine) -> None:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
