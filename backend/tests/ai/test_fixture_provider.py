"""AI_FAKE_PROVIDER: recorded outputs through the real pipeline, test environment only."""

from __future__ import annotations

import pytest

from app.ai.contracts import CONTRACTS
from app.core.config import ConfigError
from tests.ai.sample import suggest_body
from tests.conftest import build_client, device_cookie, make_settings
from tests.fakes import MemoryUsageStore

URL = "/api/v1/ai/suggest"


@pytest.mark.parametrize("contract", sorted(CONTRACTS))
def test_every_contract_answers_from_fixtures(contract: str) -> None:
    settings = make_settings(ai_fake_provider=True, ai_limit_per_device_per_minute=50)
    with build_client(settings, store=MemoryUsageStore()) as c:
        device_cookie(c)
        feedback = "Fewer decor items" if contract == "plan.revise" else None
        body = suggest_body(contract) | {"feedback": feedback}
        res = c.post(URL, json=body)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["status"] == "ready"
        assert data["items"]


def test_busy_marker_returns_503_with_retry_after() -> None:
    settings = make_settings(ai_fake_provider=True, ai_limit_per_device_per_minute=50)
    with build_client(settings, store=MemoryUsageStore()) as c:
        device_cookie(c)
        body = suggest_body("menu.suggest")
        body["context"]["preferences"] = {"theme_words": ["e2e-busy"]}
        res = c.post(URL, json=body)
        assert res.status_code == 503
        assert res.json()["code"] == "ai_busy"
        assert int(res.headers["Retry-After"]) >= 1


@pytest.mark.parametrize("env", ["development", "production"])
def test_refused_outside_test_env(env: str) -> None:
    with pytest.raises((ConfigError, ValueError), match="AI_FAKE_PROVIDER"):
        make_settings(app_env=env, ai_fake_provider=True)
