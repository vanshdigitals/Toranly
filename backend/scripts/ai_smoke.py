"""AI provider smoke test. Never runs in the test suite or CI.

Default (no flag): checks failover with mocked providers (xAI fails with a billing error, Groq
answers). No network, no cost.

--live: one minimal real request per provider, each tested on its own (xAI does not fail over
to Groq here). Uses the budget.suggest contract, the smallest output. Reads keys from
backend/.env or the environment and never prints them; errors are reported as a category and
HTTP status only. Costs a fraction of a US cent per provider when the key works.

    uv run python -m scripts.ai_smoke                 # mocked failover, free
    uv run python -m scripts.ai_smoke --live          # real calls: xAI and Groq
    uv run python -m scripts.ai_smoke --live --provider groq
"""

from __future__ import annotations

import argparse
import asyncio
import time

from pydantic import ValidationError

from app.ai.context import render
from app.ai.contracts import CONTRACTS
from app.ai.contracts.models import PlanContext
from app.ai.guards import apply_guards
from app.ai.provider import ProviderError, ProviderRequest, ProviderResult
from app.ai.registry import build_provider
from app.ai.usage import Prices
from app.core.config import Settings
from tests.ai.sample import context

CONTRACT = "budget.suggest"


def _request(contract: str, max_tokens: int, timeout: float) -> ProviderRequest:
    prompt = render(CONTRACTS[contract], PlanContext.model_validate(context()), None)
    return ProviderRequest(
        system=prompt.system,
        user=prompt.user,
        schema_name=CONTRACTS[contract].schema_name,
        schema=prompt.schema,
        max_output_tokens=max_tokens,
        timeout_seconds=timeout,
    )


async def live(settings: Settings, names: list[str]) -> int:
    failures = 0
    for name in names:
        cfg = settings.providers[name]
        print(f"\n[{name}] model={cfg.model}")
        if not cfg.api_key.get_secret_value():
            print("  SKIPPED: no key configured")
            failures += 1
            continue
        provider = build_provider(cfg)
        started = time.perf_counter()
        try:
            result: ProviderResult = await provider.generate(
                _request(CONTRACT, cfg.max_output_tokens, settings.ai_request_timeout_seconds)
            )
        except ProviderError as exc:
            ms = round((time.perf_counter() - started) * 1000)
            print(
                f"  FAILED: category={exc.kind} status={getattr(exc, 'status', None)} "
                f"latency_ms={ms}"
            )
            failures += 1
            continue
        ms = round((time.perf_counter() - started) * 1000)
        cost = Prices(cfg.price_input_per_m, cfg.price_output_per_m).cost(
            result.input_tokens, result.output_tokens + result.reasoning_tokens
        )
        print(
            f"  response: model={result.model} latency_ms={ms} input={result.input_tokens} "
            f"output={result.output_tokens} reasoning={result.reasoning_tokens} est_cost=${cost}"
        )
        if result.refusal:
            print("  FAILED: the model refused")
            failures += 1
            continue
        try:
            envelope = CONTRACTS[CONTRACT].envelope.model_validate_json(
                result.text or "", strict=True
            )
        except ValidationError as exc:
            print(
                f"  FAILED: output did not match the {CONTRACT} contract "
                f"({exc.error_count()} errors)"
            )
            failures += 1
            continue
        guarded = apply_guards(list(envelope.items), PlanContext.model_validate(context()))  # type: ignore[attr-defined]
        print(f"  OK: valid {CONTRACT} output, {len(guarded.items)} items after guards")
    return failures


def mocked() -> int:
    """Failover through the real orchestrator with fake providers (same as the unit tests)."""
    import subprocess
    import sys

    print("Mocked failover check (no network): pytest tests/ai/test_failover.py")
    return subprocess.call([sys.executable, "-m", "pytest", "-q", "tests/ai/test_failover.py"])


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--live", action="store_true", help="make real, billable provider requests")
    parser.add_argument("--provider", choices=["xai", "groq", "both"], default="both")
    args = parser.parse_args()
    if not args.live:
        raise SystemExit(mocked())
    settings = Settings()
    names = ["xai", "groq"] if args.provider == "both" else [args.provider]
    print(
        f"Live smoke test: {len(names)} real request(s), contract {CONTRACT}. Keys are not printed."
    )
    failures = asyncio.run(live(settings, names))
    print(f"\n{len(names) - failures} of {len(names)} provider(s) OK")
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
