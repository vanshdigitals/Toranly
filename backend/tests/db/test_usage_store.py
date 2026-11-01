"""Postgres-backed limits, migrations and cleanup. Needs TEST_DATABASE_URL (skips otherwise)."""

from __future__ import annotations

import threading
import time
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, inspect, select, text

from app.core.ratelimit import AiLimits, LimitExceededError, PostgresUsageStore
from app.db.models import AiGlobalUsage, AiIpUsage, AiUsage
from tests.ai.sample import suggest_body
from tests.conftest import FIXED_NOW, TEST_DATABASE_URL, build_client, make_settings
from tests.db.migrate import downgrade, upgrade
from tests.fakes import FakeProvider, ok, recorded

pytestmark = pytest.mark.db

URL = "/api/v1/ai/suggest"
LIMITS = AiLimits(2, 8, 30, 300, Decimal("2.00"))
COST = Decimal("0.010000")


def _client(pg: Engine, provider: FakeProvider, **settings: Any) -> TestClient:
    return build_client(make_settings(**settings), provider, PostgresUsageStore(pg), engine=pg)


@pytest.fixture
def run(pg: Engine) -> Iterator[Any]:
    """Factory: an entered TestClient on Postgres with a fixed clock."""
    opened: list[TestClient] = []

    def make(provider: FakeProvider | None = None, **settings: Any) -> TestClient:
        c = _client(pg, provider or FakeProvider(), **settings)
        c.__enter__()
        c.app.state.ai_service.clock = lambda: FIXED_NOW  # type: ignore[attr-defined]
        opened.append(c)
        return c

    yield make
    for c in opened:
        c.__exit__(None, None, None)


def _new_device(c: TestClient) -> None:
    c.cookies.clear()
    assert c.get("/api/v1/ai/status").status_code == 200


def _reservation(contract: str) -> Decimal:
    from app.ai.context import render
    from app.ai.contracts import get_contract
    from app.ai.contracts.models import PlanContext
    from app.ai.usage import Prices
    from tests.ai.sample import context

    prompt = render(get_contract(contract), PlanContext.model_validate(context()), None)
    return Prices(Decimal("1.25"), Decimal("2.50")).cost(prompt.estimated_input_tokens, 2500)


def _ok_steps(n: int) -> list[Any]:
    return [ok(recorded("theme_suggest.valid.json"), 800, 300) for _ in range(n)]


def test_layer1_device_burst(run: Any) -> None:
    c = run(FakeProvider(_ok_steps(3)))
    _new_device(c)
    codes = [c.post(URL, json=suggest_body("theme.suggest")).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    r = c.post(URL, json=suggest_body("theme.suggest"))
    assert r.json()["layer"] == "device_minute"
    assert r.headers["retry-after"] == "45"  # 60 - 15 seconds
    assert "Wait a minute" in r.json()["detail"]


def test_layer2_device_day(run: Any) -> None:
    c = run(FakeProvider(_ok_steps(6)), ai_limit_per_device_per_minute=100)
    _new_device(c)
    codes = [c.post(URL, json=suggest_body("theme.suggest")).status_code for _ in range(6)]
    assert codes == [200] * 5 + [429]  # AI_LIMIT_PER_DEVICE_PER_DAY default 5
    r = c.post(URL, json=suggest_body("theme.suggest"))
    assert r.json()["layer"] == "device_day"
    assert int(r.headers["retry-after"]) == 13 * 3600 + 29 * 60 + 45


def test_layer3_ip_day(run: Any) -> None:
    c = run(FakeProvider(_ok_steps(4)), ai_limit_per_ip_per_day=3)
    results = []
    for _ in range(4):
        _new_device(c)  # a fresh device each time; same IP
        results.append(c.post(URL, json=suggest_body("theme.suggest")))
    assert [r.status_code for r in results] == [200, 200, 200, 429]
    assert results[-1].json()["layer"] == "ip_day"


def test_layer4_global_count(run: Any) -> None:
    c = run(FakeProvider(_ok_steps(3)), ai_global_daily_limit=2)
    results = []
    for _ in range(3):
        _new_device(c)
        results.append(c.post(URL, json=suggest_body("theme.suggest")))
    assert [r.status_code for r in results] == [200, 200, 429]
    assert results[-1].json()["layer"] == "global_day"


def test_layer4_spend_cap(run: Any) -> None:
    reserve = _reservation("theme.suggest")
    # Room for exactly one worst-case reservation; the first call then costs $0.00175
    # (800 input x $1.25/M + 300 output x $2.50/M), leaving less than any reservation.
    c = run(FakeProvider(_ok_steps(3)), ai_daily_spend_limit_usd=str(reserve))
    _new_device(c)
    first = c.post(URL, json=suggest_body("theme.suggest"))
    assert first.status_code == 200
    _new_device(c)
    second = c.post(URL, json=suggest_body("theme.suggest"))
    assert second.status_code == 429 and second.json()["layer"] == "spend_cap"
    status = c.get("/api/v1/ai/status").json()
    assert status["available"] is False and status["reason"] == "spend_cap"


def test_layer5_provider_bucket_busy_releases_reservation(run: Any, pg: Engine) -> None:
    # RPM 1 x 0.8 -> 1 request per minute for this process.
    c = run(FakeProvider(_ok_steps(2)), xai_account_rpm=1, ai_limit_per_device_per_minute=10)
    _new_device(c)
    assert c.post(URL, json=suggest_body("theme.suggest")).status_code == 200
    r = c.post(URL, json=suggest_body("theme.suggest"))
    assert r.status_code == 503 and r.json()["code"] == "ai_busy"
    assert int(r.headers["retry-after"]) >= 1
    with pg.connect() as conn:
        assert conn.execute(select(AiGlobalUsage.count)).scalar_one() == 1  # busy one released
        assert conn.execute(select(AiIpUsage.count)).scalar_one() == 1


def test_layer5_concurrency_semaphore(run: Any) -> None:
    provider = FakeProvider(_ok_steps(2), delay=1.0)
    c = run(provider, ai_max_concurrent=1, ai_limit_per_device_per_minute=10)
    c.app.state.ai_service.semaphore_wait = 0.1  # type: ignore[attr-defined]
    _new_device(c)
    results: list[int] = []

    def call() -> None:
        results.append(c.post(URL, json=suggest_body("theme.suggest")).status_code)

    threads = [threading.Thread(target=call) for _ in range(2)]
    for t in threads:
        t.start()
        time.sleep(0.2)
    for t in threads:
        t.join()
    assert sorted(results) == [200, 503]
    assert len(provider.requests) == 1


def test_counters_correct_under_parallel_requests(pg: Engine) -> None:
    store = PostgresUsageStore(pg)
    limits = AiLimits(
        per_device_minute=100,
        per_device_day=8,
        per_ip_day=100,
        global_day=100,
        spend_cap_usd=Decimal(100),
    )
    outcomes: list[str] = []
    lock = threading.Lock()
    barrier = threading.Barrier(20)

    def attempt() -> None:
        barrier.wait()
        try:
            store.reserve("d" * 64, "i" * 64, FIXED_NOW, COST, limits)
            result = "ok"
        except LimitExceededError as exc:
            result = exc.layer
        with lock:
            outcomes.append(result)

    threads = [threading.Thread(target=attempt) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert outcomes.count("ok") == 8
    assert outcomes.count("device_day") == 12
    with pg.connect() as conn:
        assert conn.execute(select(AiGlobalUsage.count)).scalar_one() == 8
        assert conn.execute(select(AiIpUsage.count)).scalar_one() == 8
        assert conn.execute(select(AiGlobalUsage.est_cost_usd)).scalar_one() == COST * 8


def test_ip_and_global_rows_parallel(pg: Engine) -> None:
    store = PostgresUsageStore(pg)
    limits = AiLimits(100, 100, 5, 100, Decimal(100))
    ok_count = 0
    lock = threading.Lock()
    barrier = threading.Barrier(15)

    def attempt(n: int) -> None:
        nonlocal ok_count
        barrier.wait()
        try:
            store.reserve(f"{n:064d}", "i" * 64, FIXED_NOW, COST, limits)
            with lock:
                ok_count += 1
        except LimitExceededError as exc:
            assert exc.layer == "ip_day"

    threads = [threading.Thread(target=attempt, args=(n,)) for n in range(15)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert ok_count == 5
    with pg.connect() as conn:
        assert conn.execute(select(AiIpUsage.count)).scalar_one() == 5
        assert conn.execute(select(AiGlobalUsage.count)).scalar_one() == 5
        assert conn.execute(text("SELECT sum(count) FROM ai_usage")).scalar_one() == 5


def test_failed_layer_rolls_back_earlier_increments(pg: Engine) -> None:
    store = PostgresUsageStore(pg)
    limits = AiLimits(100, 100, 100, 100, Decimal("0.015"))
    store.reserve("a" * 64, "i" * 64, FIXED_NOW, COST, limits)
    with pytest.raises(LimitExceededError) as info:
        store.reserve("b" * 64, "i" * 64, FIXED_NOW, COST, limits)
    assert info.value.layer == "spend_cap"
    with pg.connect() as conn:
        assert conn.execute(select(AiIpUsage.count)).scalar_one() == 1  # not 2
        assert conn.execute(text("SELECT count(*) FROM ai_usage")).scalar_one() == 1


def test_extend_finalize_release(pg: Engine) -> None:
    store = PostgresUsageStore(pg)
    limits = AiLimits(100, 100, 100, 100, Decimal("0.025"))
    res = store.reserve("a" * 64, "i" * 64, FIXED_NOW, COST, limits)
    assert store.extend(res, COST, limits)
    assert not store.extend(res, COST, limits)  # would reach 0.03 > 0.025
    store.finalize(res, 1000, 500, Decimal("0.002500"))
    with pg.connect() as conn:
        row = conn.execute(select(AiGlobalUsage)).one()
        assert row.est_cost_usd == Decimal("0.002500")
        assert (row.input_tokens, row.output_tokens) == (1000, 500)
        dev = conn.execute(select(AiUsage)).one()
        assert (dev.input_tokens, dev.output_tokens, dev.count) == (1000, 500, 1)
    res2 = store.reserve("b" * 64, "i" * 64, FIXED_NOW, COST, limits)
    store.release(res2)
    snap = store.snapshot("b" * 64, "i" * 64, FIXED_NOW)
    assert snap.device_day == 0 and snap.ip_day == 1 and snap.global_count == 1
    assert snap.global_cost_usd == Decimal("0.002500")


def test_cleanup_deletes_rows_older_than_30_days(pg: Engine) -> None:
    store = PostgresUsageStore(pg)
    limits = AiLimits(100, 100, 100, 100, Decimal(100))
    today = date(2026, 10, 28)
    for days_ago in (0, 30, 31, 90):
        when = datetime.combine(today - timedelta(days=days_ago), datetime.min.time(), UTC)
        store.reserve(f"{days_ago:064d}", f"{days_ago:064d}", when, COST, limits)
    deleted = store.cleanup(today)
    assert deleted == 6  # 2 days x (device, ip, global)
    with pg.connect() as conn:
        days = sorted(conn.execute(select(AiGlobalUsage.day)).scalars())
    assert days == [today - timedelta(days=30), today]


def test_migrations_upgrade_and_downgrade(pg_engine: Engine) -> None:
    downgrade(TEST_DATABASE_URL, "base")
    tables = set(inspect(pg_engine).get_table_names())
    assert not {"ai_usage", "ai_ip_usage", "ai_global_usage"} & tables
    upgrade(TEST_DATABASE_URL, "head")
    insp = inspect(pg_engine)
    assert {"ai_usage", "ai_ip_usage", "ai_global_usage"} <= set(insp.get_table_names())
    assert insp.get_pk_constraint("ai_usage")["constrained_columns"] == [
        "device_hash",
        "day",
        "minute_bucket",
    ]
    assert {i["name"] for i in insp.get_indexes("ai_usage")} == {"ix_ai_usage_day"}
    # No event data tables exist on the server in this phase.
    assert set(insp.get_table_names()) == {
        "ai_usage",
        "ai_ip_usage",
        "ai_global_usage",
        "alembic_version",
    }


def test_readiness_with_database(run: Any) -> None:
    c = run()
    r = c.get("/api/v1/health/ready")
    assert r.status_code == 200 and r.json() == {
        "status": "ready",
        "database": "ok",
        "ai": {"xai": "ok", "groq": "not_configured"},
    }
