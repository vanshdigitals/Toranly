"""T-AI-SMOKE: one real call per contract and provider. Costs money; never runs by default.

Run it yourself with the keys in backend/.env (or the environment):
    uv run pytest -m live -s                     # every contract, xAI and Groq
    uv run pytest -m live -s -k groq             # one provider
For a single cheap check per provider use `uv run python -m scripts.ai_smoke --live`.
Each provider is tested on its own (no failover here). A provider without a key is skipped.
If xAI rejects the Responses request shape, set XAI_API_STYLE=chat and run again.
"""

from __future__ import annotations

import asyncio
import time
from decimal import Decimal

import pytest

from app.ai.context import render
from app.ai.contracts import CONTRACTS
from app.ai.contracts.models import PlanContext
from app.ai.guards import apply_guards
from app.ai.provider import ProviderRequest
from app.ai.registry import build_provider
from app.ai.usage import Prices, ProviderGuard
from app.core.config import Settings
from tests.ai.sample import context

pytestmark = pytest.mark.live

# One guard per provider, as in the app: back-to-back calls would otherwise exceed a small
# account TPM (Groq free tier: 8000) and fail with 429.
_guards: dict[str, ProviderGuard] = {}


@pytest.fixture(scope="module")
def settings() -> Settings:
    return Settings()


def _pace(provider_name: str, rpm: int, tpm: int, tokens: int) -> None:
    guard = _guards.setdefault(provider_name, ProviderGuard(rpm, tpm))
    while (wait := guard.try_acquire(tokens)) is not None:
        time.sleep(wait)


@pytest.mark.parametrize("provider_name", ["xai", "groq"])
@pytest.mark.parametrize("name", list(CONTRACTS))
def test_live_contract(settings: Settings, provider_name: str, name: str) -> None:
    cfg = settings.providers[provider_name]
    if not cfg.api_key.get_secret_value():
        pytest.skip(f"{provider_name.upper()}_API_KEY is not set")
    contract = CONTRACTS[name]
    ctx = PlanContext.model_validate(context())
    feedback = "Make it simpler and cheaper." if name == "plan.revise" else None
    prompt = render(contract, ctx, feedback)
    _pace(provider_name, cfg.rpm, cfg.tpm, prompt.estimated_input_tokens + cfg.max_output_tokens)
    result = asyncio.run(
        build_provider(cfg).generate(
            ProviderRequest(
                system=prompt.system,
                user=prompt.user,
                schema_name=contract.schema_name,
                schema=prompt.schema,
                max_output_tokens=cfg.max_output_tokens,
                timeout_seconds=settings.ai_request_timeout_seconds,
            )
        )
    )
    assert result.input_tokens > 0 and result.output_tokens > 0, "usage tokens missing"
    assert result.refusal is None, f"refused: {result.refusal}"
    envelope = contract.envelope.model_validate_json(result.text or "", strict=True)
    guarded = apply_guards(list(envelope.items), ctx)  # type: ignore[attr-defined]
    # Same conservative billing as the app: reasoning tokens reported separately are added.
    cost = Prices(cfg.price_input_per_m, cfg.price_output_per_m).cost(
        result.input_tokens, result.output_tokens + result.reasoning_tokens
    )
    print(
        f"\n{provider_name}/{name}: model={result.model} input={result.input_tokens} "
        f"(estimated {prompt.estimated_input_tokens}) output={result.output_tokens} "
        f"reasoning={result.reasoning_tokens} items={len(guarded.items)} "
        f"warnings={len(guarded.warnings)} cost=${cost}"
    )
    assert cost < Decimal("0.05")
