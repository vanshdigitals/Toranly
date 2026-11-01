"""Token and cost accounting, and the provider guard (layer 5 of the AI limits)."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_UP, Decimal

from app.core.ratelimit import TokenBucket

MILLION = Decimal(1_000_000)
COST_QUANTUM = Decimal("0.000001")


@dataclass(frozen=True)
class Prices:
    input_per_m: Decimal
    output_per_m: Decimal

    def cost(self, input_tokens: int, output_tokens: int) -> Decimal:
        """USD for one call: input tokens x input price + output tokens x output price."""
        raw = (
            Decimal(input_tokens) * self.input_per_m + Decimal(output_tokens) * self.output_per_m
        ) / MILLION
        return raw.quantize(COST_QUANTUM, rounding=ROUND_UP)


@dataclass
class Usage:
    """Tokens and estimated cost of one logical request, across every provider attempt."""

    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cost_usd: Decimal = Decimal(0)
    attempts: dict[str, int] = field(default_factory=dict)

    def add(
        self,
        input_tokens: int,
        output_tokens: int,
        reasoning_tokens: int = 0,
        prices: Prices | None = None,
    ) -> None:
        """Record one response. With `prices`, its cost is added (provider-specific prices).

        Reasoning tokens reported separately are billed on top of output tokens. If a provider
        already includes them in output_tokens (as OpenAI does) this overestimates cost, which
        only makes the spend cap stricter. Settled by the live smoke test, which prints both.
        """
        self.input_tokens += max(0, input_tokens)
        self.output_tokens += max(0, output_tokens)
        self.reasoning_tokens += max(0, reasoning_tokens)
        if prices is not None:
            self.cost_usd += prices.cost(
                max(0, input_tokens), max(0, output_tokens + reasoning_tokens)
            )

    def count_attempt(self, provider: str) -> None:
        self.attempts[provider] = self.attempts.get(provider, 0) + 1

    @property
    def called(self) -> bool:
        return bool(self.attempts)

    @property
    def billable_output_tokens(self) -> int:
        return self.output_tokens + self.reasoning_tokens


class ProviderGuard:
    """Keeps this process under one provider's account limits.

    Requests/minute = account RPM x XAI_SAFETY_FACTOR and tokens/minute = account TPM x
    XAI_SAFETY_FACTOR, both divided by WEB_CONCURRENCY because each worker process has its own
    bucket. The request bucket's burst is RPM/48 (at least 1): xAI derives its per-second cap
    from the per-minute budget the same way (docs.x.ai, rate limits). Each provider has its own
    guard; the AI_MAX_CONCURRENT semaphore is shared and lives in the AI service.
    """

    def __init__(self, rpm: int, tpm: int, workers: int = 1) -> None:
        per_worker_rpm = max(1.0, rpm / workers)
        per_worker_tpm = max(1.0, tpm / workers)
        self.bucket = TokenBucket(
            requests_per_minute=per_worker_rpm,
            tokens_per_minute=per_worker_tpm,
            request_capacity=max(1.0, float(int(per_worker_rpm / 48))),
        )

    def try_acquire(self, estimated_tokens: int) -> float | None:
        """None when a request may be sent now, else the seconds to wait."""
        return self.bucket.try_acquire(estimated_tokens)
