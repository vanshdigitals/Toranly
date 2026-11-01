"""Dual-provider failover (xAI primary, Groq fallback) with fake providers. No network."""

from __future__ import annotations

import io
import json
import logging
from collections.abc import Iterator
from dataclasses import replace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ai.context import render
from app.ai.contracts import CONTRACTS
from app.ai.contracts.models import PlanContext
from app.ai.provider import (
    ProviderAuthError,
    ProviderBadRequestError,
    ProviderBillingError,
    ProviderContentPolicyError,
    ProviderRateLimitedError,
    ProviderResult,
    ProviderServerError,
    ProviderTimeoutError,
)
from app.core.logging import JsonFormatter
from tests.ai.sample import suggest_body
from tests.conftest import FIXED_NOW, TEST_XAI_KEY, build_client, device_cookie, make_settings
from tests.fakes import FakeProvider, MemoryUsageStore, ok, recorded

URL = "/api/v1/ai/suggest"
TEST_GROQ_KEY = "gsk_TESTSENTINELGROQKEY0123456789abcdefghijklmnopqrs"
GROQ = {"groq_api_key": TEST_GROQ_KEY, "groq_account_rpm": 600, "groq_account_tpm": 2_000_000}
THEME = "theme_suggest.valid.json"


class Pair:
    def __init__(
        self, client: TestClient, xai: FakeProvider, groq: FakeProvider, store: MemoryUsageStore
    ):
        self.client, self.xai, self.groq, self.store = client, xai, groq, store
        self.sleeps: list[float] = []

    @property
    def service(self) -> Any:
        return self.client.app.state.ai_service  # type: ignore[attr-defined]

    def post(self, contract: str = "theme.suggest", **extra: Any) -> Any:
        if "tdv" not in self.client.cookies:
            device_cookie(self.client)
        return self.client.post(URL, json=suggest_body(contract, **extra))


def _pair(**settings: Any) -> Iterator[Pair]:
    xai, groq, store = FakeProvider(), FakeProvider(), MemoryUsageStore()
    values = {**GROQ, **settings}
    with build_client(make_settings(**values), xai, store, fallback=groq) as client:
        pair = Pair(client, xai, groq, store)
        pair.service.clock = lambda: FIXED_NOW

        async def fake_sleep(seconds: float) -> None:
            pair.sleeps.append(seconds)

        pair.service.sleep = fake_sleep
        yield pair


@pytest.fixture
def pair() -> Iterator[Pair]:
    yield from _pair()


def theme_ok(model: str = "grok-4.3", tokens: tuple[int, int] = (900, 300)) -> ProviderResult:
    return ProviderResult(recorded(THEME), None, tokens[0], tokens[1], model)


# --- provider selection --------------------------------------------------------------------


def test_xai_success_does_not_call_groq(pair: Pair) -> None:
    pair.xai.steps = [theme_ok()]
    body = pair.post().json()
    assert body["status"] == "ready"
    assert len(pair.xai.requests) == 1 and pair.groq.requests == []


def test_xai_timeout_then_groq_success(pair: Pair) -> None:
    pair.xai.steps = [ProviderTimeoutError("t"), ProviderTimeoutError("t")]
    pair.groq.steps = [theme_ok("openai/gpt-oss-120b")]
    body = pair.post().json()
    assert body["status"] == "ready"
    assert len(pair.xai.requests) == 2 and len(pair.groq.requests) == 1
    assert pair.service.provider_states()["xai"] == "cooldown"
    # While xAI cools down, the next request goes straight to Groq.
    pair.groq.steps = [theme_ok("openai/gpt-oss-120b")]
    assert pair.post().json()["status"] == "ready"
    assert len(pair.xai.requests) == 2 and len(pair.groq.requests) == 2


def test_xai_billing_error_fails_over_without_retry(pair: Pair) -> None:
    pair.xai.steps = [ProviderBillingError(403)]
    pair.groq.steps = [theme_ok("openai/gpt-oss-120b")]
    body = pair.post().json()
    assert body["status"] == "ready"
    assert len(pair.xai.requests) == 1  # billing errors are never retried
    assert pair.service.provider_states()["xai"] == "cooldown"


def test_xai_cooldown_expires(pair: Pair) -> None:
    now = [1000.0]
    pair.service.slot("xai").clock = lambda: now[0]
    pair.xai.steps = [ProviderBillingError(429)]
    pair.groq.steps = [theme_ok()]
    pair.post()
    assert pair.service.provider_states()["xai"] == "cooldown"
    now[0] += 61  # AI_FAILOVER_COOLDOWN_SECONDS default 60
    assert pair.service.provider_states()["xai"] == "ok"
    pair.xai.steps = [theme_ok()]
    pair.post()
    assert len(pair.xai.requests) == 2


def test_xai_rate_limit_retry_then_failover(pair: Pair) -> None:
    pair.xai.steps = [ProviderRateLimitedError(2), ProviderRateLimitedError(2)]
    pair.groq.steps = [theme_ok()]
    body = pair.post().json()
    assert body["status"] == "ready"
    assert pair.sleeps == [2] and len(pair.xai.requests) == 2 and len(pair.groq.requests) == 1


def test_xai_server_error_retried_on_xai_first(pair: Pair) -> None:
    pair.xai.steps = [ProviderServerError(502), theme_ok()]
    assert pair.post().json()["status"] == "ready"
    assert len(pair.xai.requests) == 2 and pair.groq.requests == []


def test_invalid_xai_credentials_disable_xai_and_use_groq(
    pair: Pair, caplog: pytest.LogCaptureFixture
) -> None:
    pair.xai.steps = [ProviderAuthError(400)]
    pair.groq.steps = [theme_ok(), theme_ok()]
    with caplog.at_level(logging.ERROR, logger="toranly.ai"):
        assert pair.post().json()["status"] == "ready"
    assert any(
        getattr(r, "alert", False) and r.__dict__.get("provider") == "xai" for r in caplog.records
    )
    assert pair.service.provider_states() == {"xai": "disabled", "groq": "ok"}
    assert pair.post().json()["status"] == "ready"
    assert len(pair.xai.requests) == 1  # never retried with the bad key
    status = pair.client.get("/api/v1/ai/status").json()
    # Not "provider_auth_failed": Groq still serves. (Two requests this minute hit the burst.)
    assert status["reason"] == "device_minute"


def test_groq_invalid_credentials_after_xai_failure(pair: Pair) -> None:
    pair.xai.steps = [ProviderServerError(503), ProviderServerError(503)]
    pair.groq.steps = [ProviderAuthError(401)]
    body = pair.post("timeline.suggest").json()
    assert body["status"] == "fallback"  # standard template, labelled as such
    assert pair.service.provider_states()["groq"] == "disabled"
    failed = pair.post("theme.suggest").json()  # xAI cooling down, Groq disabled
    assert failed["status"] == "failed" and failed["items"] == []


def test_both_providers_unavailable(pair: Pair) -> None:
    pair.xai.steps = [ProviderServerError(500), ProviderTimeoutError("t")]
    pair.groq.steps = [ProviderServerError(502), ProviderServerError(502)]
    body = pair.post("theme.suggest").json()
    assert body["status"] == "failed" and body["message"]
    assert len(pair.xai.requests) == 2 and len(pair.groq.requests) == 2
    status = pair.client.get("/api/v1/ai/status").json()
    assert status["available"] is False and status["reason"] == "circuit_open"


def test_both_rate_limited_returns_busy(pair: Pair) -> None:
    pair.xai.steps = [ProviderRateLimitedError(30)]
    pair.groq.steps = [ProviderRateLimitedError(20)]
    r = pair.post()
    assert r.status_code == 503 and r.json()["code"] == "ai_busy"
    assert r.headers["retry-after"] == "20"


# --- configuration -------------------------------------------------------------------------


def test_missing_primary_key_uses_groq() -> None:
    for p in _pair(xai_api_key=""):
        assert [s.name for s in p.service.slots] == ["groq"]
        p.groq.steps = [theme_ok()]
        assert p.post().json()["status"] == "ready"
        assert p.client.get("/api/v1/ai/status").json()["available"] is True


def test_missing_fallback_key_uses_xai_only() -> None:
    for p in _pair(groq_api_key=""):
        assert [s.name for s in p.service.slots] == ["xai"]
        p.xai.steps = [ProviderServerError(500), ProviderServerError(500)]
        assert p.post("timeline.suggest").json()["status"] == "fallback"
        assert p.groq.requests == []


def test_both_keys_missing() -> None:
    for p in _pair(xai_api_key="", groq_api_key=""):
        status = p.client.get("/api/v1/ai/status").json()
        assert status["available"] is False and status["reason"] == "no_key"
        assert p.post("timeline.suggest").json()["status"] == "fallback"
        assert p.xai.requests == [] and p.groq.requests == []


def test_failover_disabled() -> None:
    for p in _pair(ai_failover_enabled=False):
        assert [s.name for s in p.service.slots] == ["xai"]


def test_groq_as_primary() -> None:
    for p in _pair(ai_primary_provider="groq", ai_fallback_provider="xai"):
        assert [s.name for s in p.service.slots] == ["groq", "xai"]


def test_placeholder_keys_count_as_missing() -> None:
    s = make_settings(xai_api_key="your_xai_api_key_here", groq_api_key="your_groq_api_key_here")
    assert s.ai_disabled_reason == "no_key"


def test_legacy_timeout_variable_still_works(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("XAI_TIMEOUT_SECONDS", "12")
    from app.core.config import Settings

    assert Settings(_env_file=None).ai_request_timeout_seconds == 12  # type: ignore[call-arg]


# --- no failover where it cannot help ---------------------------------------------------------


def test_refusal_does_not_fail_over(pair: Pair) -> None:
    pair.xai.steps = [ok(recorded("refusal.json"))]
    body = pair.post().json()
    assert body["status"] == "failed" and body["message"].startswith("The assistant could not")
    assert pair.groq.requests == []


def test_content_policy_rejection_does_not_fail_over(pair: Pair) -> None:
    pair.xai.steps = [ProviderContentPolicyError(400)]
    body = pair.post().json()
    assert body["status"] == "failed" and pair.groq.requests == []
    assert len(pair.xai.requests) == 1


def test_client_validation_error_calls_no_provider(pair: Pair) -> None:
    device_cookie(pair.client)
    r = pair.client.post(URL, json={"contract": "theme.suggest", "context": {"notes": "x"}})
    assert r.status_code == 422
    assert pair.xai.requests == [] and pair.groq.requests == []


def test_provider_bad_request_fails_over_once(pair: Pair) -> None:
    pair.xai.steps = [ProviderBadRequestError(400)]
    pair.groq.steps = [theme_ok()]
    assert pair.post().json()["status"] == "ready"
    assert len(pair.xai.requests) == 1 and len(pair.groq.requests) == 1


def test_call_count_is_bounded(pair: Pair) -> None:
    # Every failure kind at once: never more than 2 calls per provider, one failover.
    pair.xai.steps = [ProviderTimeoutError("t"), ok("{not json")]
    pair.groq.steps = [ok("{not json"), ok("{still not json")]
    body = pair.post("timeline.suggest").json()
    assert body["status"] == "fallback"
    assert len(pair.xai.requests) == 2 and len(pair.groq.requests) == 2
    assert pair.groq.requests[1].repair_note  # the repair retry was on Groq, not a third call


# --- limits, cost, validation ------------------------------------------------------------------


def test_generation_counted_once_across_failover(pair: Pair) -> None:
    pair.xai.steps = [ProviderBillingError(403)]
    pair.groq.steps = [theme_ok(tokens=(1_000_000, 1_000_000))]
    pair.post()
    day = FIXED_NOW.date()
    g = pair.store.global_[day]
    assert g[0] == 1  # one application-level generation
    assert sum(v[0] for k, v in pair.store.device.items() if k[1] == day) == 1
    # Cost uses Groq's prices for the Groq call: 1M x $0.15 + 1M x $0.60.
    assert str(pair.store.global_cost(day)) == "0.750000"
    status = pair.client.get("/api/v1/ai/status").json()
    assert status["remainingToday"] == 4


def test_device_limit_applies_across_providers() -> None:
    for p in _pair(ai_limit_per_device_per_minute=100):
        p.xai.steps = [ProviderBillingError(403)]
        p.groq.steps = [theme_ok()] * 5
        codes = [p.post().status_code for _ in range(6)]
        assert codes == [200] * 5 + [429]  # AI_LIMIT_PER_DEVICE_PER_DAY default 5
        assert len(p.xai.requests) == 1 and len(p.groq.requests) == 5


def test_failover_respects_spend_cap(pair: Pair) -> None:
    prompt = render(
        CONTRACTS["theme.suggest"],
        PlanContext.model_validate(suggest_body("theme.suggest")["context"]),
        None,
    )
    cap = pair.service.slot("xai").reserve_cost(prompt)  # room for exactly one call
    pair.service.limits = replace(pair.service.limits, spend_cap_usd=cap)
    pair.xai.steps = [ProviderServerError(500)]
    body = pair.post("theme.suggest").json()
    # The retry and the failover both need another reservation, which the cap refuses.
    assert body["status"] == "failed"
    assert len(pair.xai.requests) == 1 and pair.groq.requests == []


def test_groq_output_is_validated_and_guarded(pair: Pair) -> None:
    pair.xai.steps = [ProviderBillingError(403)]
    pair.groq.steps = [ok(recorded("injection_influenced.json"))]
    body = pair.post().json()
    text = json.dumps(body["items"])
    assert "98765" not in text and "www." not in text and "booked" not in text
    pair.groq.steps = [ok(recorded("schema_invalid.json")), ok(recorded("schema_invalid.json"))]
    failed = pair.post("theme.suggest").json()
    assert failed["status"] == "failed"  # never accepted, same contract as xAI


def test_secrets_never_logged_or_returned(pair: Pair) -> None:
    from app.core.logging import redactor

    redactor.register([TEST_GROQ_KEY])
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logging.getLogger().addHandler(handler)
    try:
        pair.xai.steps = [ProviderAuthError(401)]
        pair.groq.steps = [Exception(f"boom {TEST_GROQ_KEY} {TEST_XAI_KEY}")]
        r = pair.post()
        logging.getLogger("toranly.test").warning("check %s %s", TEST_GROQ_KEY, TEST_XAI_KEY)
        health = pair.client.get("/api/v1/health/ready")
    finally:
        logging.getLogger().removeHandler(handler)
    output = stream.getvalue()
    for secret in (TEST_GROQ_KEY, TEST_XAI_KEY):
        assert secret not in r.text and secret not in health.text and secret not in output
    assert "[REDACTED]" in output
