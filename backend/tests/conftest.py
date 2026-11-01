"""Shared fixtures. No network: xAI is replaced by FakeProvider unless a test is marked live."""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text

from app.core.config import Settings
from app.main import create_app
from tests.fakes import FakeProvider, MemoryUsageStore

TEST_XAI_KEY = "xai-TESTSENTINELKEY0123456789abcdefghijklmnop"
ORIGIN = "http://testserver"
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://toranly:toranly@localhost:5432/toranly_test"
)
FIXED_NOW = datetime(2026, 10, 28, 10, 30, 15, tzinfo=UTC)


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "app_env": "test",
        "database_url": TEST_DATABASE_URL,
        "session_secret": "s" * 64,
        "ip_hash_salt": "p" * 32,
        "xai_api_key": TEST_XAI_KEY,
        "xai_account_rpm": 600,
        "xai_account_tpm": 2_000_000,
        "cors_origins": "http://localhost:5173",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


@pytest.fixture
def fake_provider() -> FakeProvider:
    return FakeProvider()


@pytest.fixture
def memory_store() -> MemoryUsageStore:
    return MemoryUsageStore()


def build_client(
    settings: Settings,
    provider: Any = None,
    store: Any = None,
    engine: Engine | None = None,
    fallback: Any = None,
) -> TestClient:
    app = create_app(
        settings,
        provider=provider,
        fallback_provider=fallback,
        store=store or MemoryUsageStore(),
        engine=engine
        or create_engine(
            "postgresql+psycopg://unused:unused@127.0.0.1:1/unused",
            connect_args={"connect_timeout": 1},
        ),
        run_cleanup=False,
    )
    return TestClient(app, base_url=ORIGIN, headers={"Origin": ORIGIN})


@pytest.fixture
def client(fake_provider: FakeProvider, memory_store: MemoryUsageStore) -> Iterator[TestClient]:
    with build_client(make_settings(), fake_provider, memory_store) as c:
        c.app.state.ai_service.clock = lambda: FIXED_NOW  # type: ignore[attr-defined]
        yield c


def device_cookie(c: TestClient) -> str:
    """Call /ai/status once so the client holds a signed device cookie."""
    response = c.get("/api/v1/ai/status")
    assert response.status_code == 200, response.text
    return response.cookies.get("tdv") or c.cookies.get("tdv") or ""


# --- Postgres ---------------------------------------------------------------------------------


@pytest.fixture(scope="session")
def pg_engine() -> Iterator[Engine]:
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"Postgres not reachable at TEST_DATABASE_URL ({type(exc).__name__})")
    from tests.db.migrate import downgrade, upgrade

    downgrade(TEST_DATABASE_URL, "base")
    upgrade(TEST_DATABASE_URL, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def pg(pg_engine: Engine) -> Engine:
    with pg_engine.begin() as conn:
        conn.execute(text("TRUNCATE ai_usage, ai_ip_usage, ai_global_usage"))
    return pg_engine
