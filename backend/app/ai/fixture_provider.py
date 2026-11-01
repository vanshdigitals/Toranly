"""Offline AI provider for end-to-end tests and local UI checks (APP_ENV=test only).

Returns the recorded, schema-valid output for each contract from app/ai/fixtures, so the whole
pipeline (limits, validation, envelopes, usage) runs for real without a network call or cost.
Enabled with AI_FAKE_PROVIDER=true; the settings refuse it outside APP_ENV=test.

End-to-end tests can force the provider-busy path (503 ai_busy with Retry-After) by putting the
theme word `e2e-busy` in the plan: every provider then answers 429 with a short Retry-After.
"""

from __future__ import annotations

from pathlib import Path

from app.ai.provider import ProviderRateLimitedError, ProviderRequest, ProviderResult

FIXTURES = Path(__file__).parent / "fixtures"

BUSY_MARKER = "e2e-busy"
BUSY_RETRY_SECONDS = 3.0

# Contracts without a recording of their own reuse a compatible one.
ALIASES = {"plan_revise": "plan_generate"}


class FixtureProvider:
    """Recorded outputs keyed by contract schema name (for example `menu_suggest`)."""

    model = "fixture"

    async def generate(self, request: ProviderRequest) -> ProviderResult:
        if BUSY_MARKER in request.user:
            raise ProviderRateLimitedError(BUSY_RETRY_SECONDS)
        name = ALIASES.get(request.schema_name, request.schema_name)
        text = (FIXTURES / f"{name}.valid.json").read_text(encoding="utf-8")
        # Token counts roughly like a real call, so usage and cost accounting are exercised.
        return ProviderResult(text, None, len(request.user) // 4, len(text) // 4, self.model)
