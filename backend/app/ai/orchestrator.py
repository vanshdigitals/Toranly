"""AI suggestion orchestration: limits, provider failover, retries, validation, guards.

Providers are tried in the order AI_PRIMARY_PROVIDER, then AI_FALLBACK_PROVIDER when
AI_FAILOVER_ENABLED (xAI then Groq by default). Per provider, at most
1 + AI_MAX_RETRIES_PER_PROVIDER calls, covering transient retries, one 429 retry and the
JSON repair retry. Then:
- 5xx, connection error or timeout: retry, then fail over; the provider cools down
  AI_FAILOVER_COOLDOWN_SECONDS after exhausting its retries
- 429: honour Retry-After up to 10 s for the retry, else cool down and fail over; if every
  provider is rate limited the client gets 503 ai_busy
- billing (no credits, spending limit): no retry, cool down, fail over, alert in logs
- bad credentials (401, 403, xAI's 400 "Incorrect API key"): provider disabled for this
  process, fail over, alert in logs
- invalid output after the repair retry, or a provider-side 400: fail over
- refusals and content-policy rejections: never fail over (that would bypass a refusal)
- circuit breaker per provider: opens after 5 consecutive failures for 60 s
The application-level generation is counted once (one reservation), however many providers
are tried. When no provider produces a result, plan.generate and timeline.suggest return the
standard template (status "fallback"); every other contract returns status "failed".
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from anyio import to_thread
from pydantic import BaseModel, ValidationError

from app.ai.context import RenderedPrompt, render
from app.ai.contracts import CONTRACTS, Contract, get_contract
from app.ai.contracts.models import BudgetShare, PlanContext, TaskItem
from app.ai.guards import apply_guards, scrub_text
from app.ai.provider import (
    Provider,
    ProviderAuthError,
    ProviderBadRequestError,
    ProviderBillingError,
    ProviderContentPolicyError,
    ProviderError,
    ProviderRateLimitedError,
    ProviderRequest,
    ProviderResult,
    ProviderTimeoutError,
)
from app.ai.usage import Prices, ProviderGuard, Usage
from app.core.config import Settings
from app.core.errors import ProblemError
from app.core.ratelimit import (
    AiLimits,
    LimitExceededError,
    LimitLayer,
    Reservation,
    UsageStore,
    next_reset,
)
from app.domain.templates import TEMPLATES

logger = logging.getLogger("toranly.ai")

TOTAL_BUDGET_SECONDS = 45.0
MAX_RETRY_AFTER_SECONDS = 10.0
SEMAPHORE_WAIT_SECONDS = 2.0
# Time kept back for the next provider while one remains in the chain.
FALLBACK_RESERVE_SECONDS = 15.0
# Do not start a provider call with less time than this left.
MIN_CALL_SECONDS = 3.0
# Error categories after which the same provider is not called again for this request.
FINAL_FOR_PROVIDER = frozenset({"auth", "billing", "bad_request"})

MSG_UNAVAILABLE = "AI suggestions aren't available right now."
MSG_FALLBACK = "AI is unavailable right now. Here is our standard template instead."
MSG_FAILED = "AI suggestions aren't available right now. Nothing in your plan was changed."
MSG_TIMEOUT = "This took too long. Nothing was changed."
MSG_REFUSAL = "The assistant could not help with this request."
MSG_BUSY = "The AI service is busy. Try again in a few seconds."

LIMIT_MESSAGES: dict[LimitLayer, str] = {
    "device_minute": "You're asking for suggestions quickly. Wait a minute and try again.",
    "device_day": "You have used today's AI suggestions. Try again tomorrow.",
    "ip_day": "Today's AI suggestions for your network have been used. Try again tomorrow.",
    "global_day": "AI suggestions have reached today's limit. Try again tomorrow.",
    "spend_cap": "AI suggestions have reached today's limit. Try again tomorrow.",
}

DISABLED_MESSAGES: dict[str, str] = {
    "no_key": MSG_UNAVAILABLE,
    "limits_not_configured": MSG_UNAVAILABLE,
    "provider_auth_failed": MSG_UNAVAILABLE,
    "circuit_open": "AI suggestions are paused for a minute after repeated errors.",
}

Status = Literal["ready", "fallback", "failed"]


class CircuitBreaker:
    def __init__(
        self,
        threshold: int = 5,
        cooldown_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.threshold = threshold
        self.cooldown = cooldown_seconds
        self.clock = clock
        self.failures = 0
        self.opened_at: float | None = None

    def is_open(self) -> bool:
        if self.opened_at is None:
            return False
        if self.clock() - self.opened_at >= self.cooldown:
            # Half-open: allow the next call; one more failure re-opens immediately.
            self.opened_at = None
            self.failures = self.threshold - 1
            return False
        return True

    def retry_after(self) -> int:
        if self.opened_at is None:
            return 0
        return max(1, math.ceil(self.cooldown - (self.clock() - self.opened_at)))

    def record_success(self) -> None:
        self.failures = 0
        self.opened_at = None

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.threshold:
            self.opened_at = self.clock()


@dataclass
class SuggestOutcome:
    status: Status
    items: list[dict[str, Any]] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    message: str | None = None
    usage: Usage = field(default_factory=Usage)


@dataclass(frozen=True)
class Availability:
    available: bool
    reason: str | None
    message: str | None
    remaining_today: int
    resets_at: datetime


def _validation_summary(exc: ValidationError) -> str:
    lines = []
    for err in exc.errors(include_input=False, include_url=False)[:10]:
        loc = ".".join(str(p) for p in err.get("loc", ()))
        lines.append(f"- {loc or 'root'}: {err.get('msg', 'invalid')}")
    return "\n".join(lines)


def template_items(contract: Contract, context: PlanContext) -> list[dict[str, Any]]:
    """Deterministic items from domain/templates.py, in the contract's item format."""
    tpl = TEMPLATES[context.event_type.value]
    existing = {t.strip().lower() for t in context.existing_task_titles}
    items: list[BaseModel] = []
    if contract.name == "plan.generate":
        items.extend(
            BudgetShare(
                kind="budget_share",
                category_key=s.key,
                label=s.label,
                share_pct=float(s.share_percent),
                rationale="Standard template share for this kind of celebration.",
            )
            for s in tpl.shares
        )
    titles = [t.title for t in tpl.tasks]
    items.extend(
        TaskItem(
            kind="task",
            title=t.title,
            offset_days=t.offset_days,
            category_key=t.category_key,
            is_milestone=t.is_milestone,
            depends_on_titles=[titles[i] for i in t.depends_on_indexes],
        )
        for t in tpl.tasks
        if t.title.strip().lower() not in existing
    )
    return [i.model_dump(mode="json") for i in items]


@dataclass
class ProviderSlot:
    """One configured provider in the failover chain, with its own health state."""

    name: str
    model: str
    provider: Provider
    guard: ProviderGuard
    prices: Prices
    max_output_tokens: int
    breaker: CircuitBreaker = field(default_factory=CircuitBreaker)
    clock: Callable[[], float] = time.monotonic
    disabled: bool = False  # bad credentials: skipped until the key is fixed and the app restarts
    cooldown_until: float = 0.0

    def state(self) -> str:
        if self.disabled:
            return "disabled"
        if self.clock() < self.cooldown_until:
            return "cooldown"
        if self.breaker.is_open():
            return "circuit_open"
        return "ok"

    def cool_down(self, seconds: float) -> None:
        self.cooldown_until = max(self.cooldown_until, self.clock() + max(0.0, seconds))

    def reserve_cost(self, prompt: RenderedPrompt) -> Decimal:
        return self.prices.cost(prompt.estimated_input_tokens, self.max_output_tokens)


@dataclass
class SlotResult:
    """Result of trying one provider: a final outcome, or a reason to try the next one."""

    outcome: SuggestOutcome | None = None
    category: str = "unknown"
    message: str = MSG_FAILED
    busy_wait: float | None = None


class AiService:
    def __init__(
        self,
        settings: Settings,
        slots: list[ProviderSlot],
        store: UsageStore,
        clock: Callable[[], datetime] | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        total_budget_seconds: float = TOTAL_BUDGET_SECONDS,
        semaphore_wait_seconds: float = SEMAPHORE_WAIT_SECONDS,
    ) -> None:
        from app.core.clock import now_utc

        self.settings = settings
        self.slots = slots
        self.store = store
        self.clock = clock or now_utc
        self.sleep = sleep
        self.total_budget = total_budget_seconds
        self.semaphore_wait = semaphore_wait_seconds
        self.semaphore = asyncio.Semaphore(settings.ai_max_concurrent)
        self._min_reservation: Decimal | None = None
        self.limits = AiLimits(
            per_device_minute=settings.ai_limit_per_device_per_minute,
            per_device_day=settings.ai_limit_per_device_per_day,
            per_ip_day=settings.ai_limit_per_ip_per_day,
            global_day=settings.ai_global_daily_limit,
            spend_cap_usd=settings.ai_daily_spend_limit_usd,
        )

    def slot(self, name: str) -> ProviderSlot:
        return next(s for s in self.slots if s.name == name)

    # --- availability ------------------------------------------------------------------------

    def provider_states(self) -> dict[str, str]:
        """Sanitised health per provider in the chain (no keys, no error text)."""
        states: dict[str, str] = {str(n): "not_configured" for n in self.settings.provider_chain}
        states.update({s.name: s.state() for s in self.slots})
        return states

    def usable_slots(self) -> list[ProviderSlot]:
        return [s for s in self.slots if s.state() == "ok"]

    def disabled_reason(self) -> str | None:
        if self.settings.ai_disabled_reason:
            return self.settings.ai_disabled_reason
        if not self.slots:
            return "no_key"
        if self.usable_slots():
            return None
        if all(s.disabled for s in self.slots):
            return "provider_auth_failed"
        return "circuit_open"

    def availability(self, device_hash: str, ip_hash: str) -> Availability:
        """Synchronous (reads Postgres); call from a worker thread."""
        now = self.clock()
        resets = next_reset(now)
        reason = self.disabled_reason()
        if reason:
            return Availability(False, reason, DISABLED_MESSAGES[reason], 0, resets)
        snap = self.store.snapshot(device_hash, ip_hash, now)
        lim = self.limits
        remaining = max(
            0,
            min(
                lim.per_device_day - snap.device_day,
                lim.per_ip_day - snap.ip_day,
                lim.global_day - snap.global_count,
            ),
        )
        layer: LimitLayer | None = None
        if snap.device_day >= lim.per_device_day:
            layer = "device_day"
        elif snap.ip_day >= lim.per_ip_day:
            layer = "ip_day"
        elif snap.global_count >= lim.global_day:
            layer = "global_day"
        elif snap.global_cost_usd + self.min_reservation() > lim.spend_cap_usd:
            layer = "spend_cap"
            remaining = 0
        elif snap.device_minute >= lim.per_device_minute:
            layer = "device_minute"
        if layer:
            return Availability(False, layer, LIMIT_MESSAGES[layer], remaining, resets)
        return Availability(True, None, None, remaining, resets)

    def min_reservation(self) -> Decimal:
        """The smallest worst-case reservation any request can make (smallest contract prompt
        with a minimal context, on the cheapest configured provider). Status reports the spend
        cap as reached below this."""
        if self._min_reservation is None:
            minimal = PlanContext.model_validate(
                {
                    "event_type": "family",
                    "month": "2000-01",
                    "days_until_event": 0,
                    "guest_band": "1-25",
                    "budget_total_inr": 0,
                }
            )
            prompt = min(
                (render(get_contract(name), minimal, None) for name in CONTRACTS),
                key=lambda p: p.estimated_input_tokens,
            )
            costs = [s.reserve_cost(prompt) for s in self.slots] or [Decimal(0)]
            self._min_reservation = min(costs)
        return self._min_reservation

    # --- suggest -----------------------------------------------------------------------------

    def _no_ai(self, contract: Contract, context: PlanContext, message: str) -> SuggestOutcome:
        if contract.has_fallback:
            return SuggestOutcome(
                status="fallback",
                items=template_items(contract, context),
                assumptions=["Standard template, not personalised by AI."],
                message=MSG_FALLBACK,
            )
        return SuggestOutcome(status="failed", message=message)

    async def suggest(
        self,
        contract_name: str,
        context: PlanContext,
        feedback: str | None,
        device_hash: str,
        ip_hash: str,
    ) -> SuggestOutcome:
        contract = get_contract(contract_name)
        if contract.name == "plan.revise" and not (feedback and feedback.strip()):
            raise ProblemError(
                422, "feedback_required", "Tell the assistant what to change in the plan."
            )
        reason = self.disabled_reason()
        if reason:
            return self._no_ai(contract, context, DISABLED_MESSAGES[reason])
        slots = self.usable_slots()

        prompt = render(contract, context, feedback)
        # The first call may go to any usable provider (the primary can be skipped when its
        # bucket is empty), so reserve the most expensive single call among them.
        reserve_cost = max(s.reserve_cost(prompt) for s in slots)
        try:
            reservation = await to_thread.run_sync(
                self.store.reserve, device_hash, ip_hash, self.clock(), reserve_cost, self.limits
            )
        except LimitExceededError as exc:
            logger.info("ai_limit", extra={"layer": exc.layer, "contract": contract.name})
            raise ProblemError(
                429,
                "ai_limit_reached",
                LIMIT_MESSAGES[exc.layer],
                retry_after=exc.retry_after,
                extra={"layer": exc.layer},
            ) from None

        usage = Usage()
        served_by: list[str] = []
        try:
            try:
                await asyncio.wait_for(self.semaphore.acquire(), self.semaphore_wait)
            except TimeoutError:
                raise ProblemError(503, "ai_busy", MSG_BUSY, retry_after=5) from None
            try:
                outcome = await self._run(
                    contract, context, prompt, reservation, slots, usage, served_by
                )
            finally:
                self.semaphore.release()
        finally:
            await self._settle(reservation, usage)
        outcome.usage = usage
        logger.info(
            "ai_suggest",
            extra={
                "contract": contract.name,
                "outcome": outcome.status,
                "provider": served_by[-1] if served_by else None,
                "failover": len(usage.attempts) > 1,
                "attempts": dict(usage.attempts),
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.billable_output_tokens,
                "est_cost_usd": str(usage.cost_usd),
            },
        )
        return outcome

    async def _settle(self, reservation: Reservation, usage: Usage) -> None:
        if not usage.called:
            await to_thread.run_sync(self.store.release, reservation)
            return
        await to_thread.run_sync(
            self.store.finalize,
            reservation,
            usage.input_tokens,
            usage.billable_output_tokens,
            usage.cost_usd,
        )

    async def _run(
        self,
        contract: Contract,
        context: PlanContext,
        prompt: RenderedPrompt,
        reservation: Reservation,
        slots: list[ProviderSlot],
        usage: Usage,
        served_by: list[str],
    ) -> SuggestOutcome:
        """Try each usable provider once, in chain order, until one gives a final outcome.

        A provider is left only after it failed (or was busy before any call), so a request is
        never generated twice on purpose. Every provider gets at most
        1 + AI_MAX_RETRIES_PER_PROVIDER calls; the whole request stays inside the 45 s budget,
        and while a later provider remains, 15 s of it is kept back for that provider.
        """
        loop = asyncio.get_running_loop()
        deadline = loop.time() + self.total_budget
        results: list[SlotResult] = []
        for index, slot in enumerate(slots):
            has_next = index < len(slots) - 1
            phase_deadline = deadline - (FALLBACK_RESERVE_SECONDS if has_next else 0)
            if results:
                logger.warning(
                    "ai_failover",
                    extra={
                        "provider": slot.name,
                        "category": results[-1].category,
                        "failover": True,
                        "contract": contract.name,
                    },
                )
            result = await self._try_slot(
                slot, contract, context, prompt, reservation, usage, phase_deadline, served_by
            )
            if result.outcome is not None:
                return result.outcome
            results.append(result)

        # Only capacity problems (local bucket or provider 429) end as 503 ai_busy, so the
        # client can retry later. Any real failure ends with the fallback or failed outcome.
        if results and all(r.category in ("busy", "rate_limited") for r in results):
            wait = min((r.busy_wait or 10.0) for r in results)
            raise ProblemError(503, "ai_busy", MSG_BUSY, retry_after=max(1, math.ceil(wait)))
        failures = [r for r in results if r.category not in ("busy", "rate_limited")]
        message = failures[-1].message if failures else MSG_FAILED
        return self._no_ai(contract, context, message)

    async def _try_slot(
        self,
        slot: ProviderSlot,
        contract: Contract,
        context: PlanContext,
        prompt: RenderedPrompt,
        reservation: Reservation,
        usage: Usage,
        phase_deadline: float,
        served_by: list[str],
    ) -> SlotResult:
        loop = asyncio.get_running_loop()
        max_calls = 1 + self.settings.ai_max_retries_per_provider
        est_tokens = prompt.estimated_input_tokens + slot.max_output_tokens
        calls = 0
        repair_note: str | None = None
        last = SlotResult(category="exhausted", message=MSG_FAILED)

        while calls < max_calls:
            remaining = phase_deadline - loop.time()
            if remaining < MIN_CALL_SECONDS:
                self._give_up(slot, last)
                return SlotResult(category="deadline", message=MSG_TIMEOUT)
            wait = slot.guard.try_acquire(est_tokens)
            if wait is not None:
                if not usage.called or wait > remaining - MIN_CALL_SECONDS:
                    # Nothing sent yet, or no time to wait. A retry that cannot be sent ends
                    # with the failure that caused it, not with "busy".
                    return (
                        self._give_up(slot, last)
                        if calls
                        else SlotResult(category="busy", message=MSG_BUSY, busy_wait=wait)
                    )
                await self.sleep(wait)
                if slot.guard.try_acquire(est_tokens) is not None:
                    return (
                        self._give_up(slot, last)
                        if calls
                        else SlotResult(category="busy", message=MSG_BUSY, busy_wait=wait)
                    )
                remaining = phase_deadline - loop.time()
            if usage.called:
                # The initial reservation covers the first call only; reserve each further one.
                extended = await to_thread.run_sync(
                    self.store.extend, reservation, slot.reserve_cost(prompt), self.limits
                )
                if not extended:
                    return SlotResult(
                        outcome=self._no_ai(contract, context, LIMIT_MESSAGES["spend_cap"])
                    )
            calls += 1
            usage.count_attempt(slot.name)
            per_call = min(self.settings.ai_request_timeout_seconds, remaining)
            request = ProviderRequest(
                system=prompt.system,
                user=prompt.user,
                schema_name=contract.schema_name,
                schema=prompt.schema,
                max_output_tokens=slot.max_output_tokens,
                timeout_seconds=per_call,
                repair_note=repair_note,
            )
            started = loop.time()
            try:
                result: ProviderResult = await asyncio.wait_for(
                    slot.provider.generate(request), per_call + 1
                )
            except ProviderError as exc:
                self._log_attempt(slot, calls, started, exc.kind, getattr(exc, "status", None))
                last = self._handle_error(slot, exc, contract)
                if last.outcome is not None or last.category in FINAL_FOR_PROVIDER:
                    return last
                if last.category == "rate_limited":
                    wait = last.busy_wait if last.busy_wait is not None else 2.0
                    if (
                        calls < max_calls
                        and wait <= MAX_RETRY_AFTER_SECONDS
                        and wait < phase_deadline - loop.time() - MIN_CALL_SECONDS
                    ):
                        await self.sleep(wait)
                        continue
                    slot.cool_down(wait)
                    return last
                continue  # transient: retry while calls remain
            except TimeoutError:
                self._log_attempt(slot, calls, started, "timeout", None)
                slot.breaker.record_failure()
                last = SlotResult(category="timeout", message=MSG_TIMEOUT)
                continue

            usage.add(
                result.input_tokens, result.output_tokens, result.reasoning_tokens, slot.prices
            )
            if result.refusal:
                self._log_attempt(slot, calls, started, "refusal", None)
                slot.breaker.record_success()
                served_by.append(slot.name)
                return SlotResult(outcome=self._refused(result.refusal))
            try:
                envelope = contract.envelope.model_validate_json(result.text or "", strict=True)
            except ValidationError as exc:
                self._log_attempt(slot, calls, started, "invalid_output", None)
                repair_note = (
                    "Your previous reply did not match the JSON schema:\n"
                    f"{_validation_summary(exc)}\n"
                    "Reply again with only a JSON object that matches the schema exactly."
                )
                last = SlotResult(category="invalid_output", message=MSG_FAILED)
                if calls >= max_calls:
                    slot.breaker.record_failure()
                continue

            self._log_attempt(slot, calls, started, "ok", None)
            slot.breaker.record_success()
            served_by.append(slot.name)
            data = envelope.model_dump()
            if data.get("refusal"):
                return SlotResult(outcome=self._refused(str(data["refusal"])))
            items: list[BaseModel] = list(getattr(envelope, "items", []))
            guarded = apply_guards(items, context)
            return SlotResult(
                outcome=SuggestOutcome(
                    status="ready",
                    items=guarded.items,
                    assumptions=[a for a in (scrub_text(x) for x in data["assumptions"]) if a],
                    warnings=[
                        *[w for w in (scrub_text(x) for x in data["warnings"]) if w],
                        *guarded.warnings,
                    ],
                )
            )

        return self._give_up(slot, last)

    def _give_up(self, slot: ProviderSlot, last: SlotResult) -> SlotResult:
        if last.category in ("timeout", "server_error"):
            # Exhausted on an outage: skip this provider for a while instead of paying the
            # timeout again on every request.
            slot.cool_down(self.settings.ai_failover_cooldown_seconds)
        return last

    def _handle_error(
        self, slot: ProviderSlot, exc: ProviderError, contract: Contract
    ) -> SlotResult:
        if isinstance(exc, ProviderAuthError):
            slot.disabled = True
            logger.error(
                "ai_provider_auth_failed: provider disabled until the key is fixed and the app "
                "restarts",
                extra={"alert": True, "provider": slot.name, "provider_status": exc.status},
            )
            return SlotResult(category="auth", message=MSG_UNAVAILABLE)
        if isinstance(exc, ProviderBillingError):
            slot.cool_down(self.settings.ai_failover_cooldown_seconds)
            logger.error(
                "ai_provider_billing: out of credits or spending limit; provider paused",
                extra={"alert": True, "provider": slot.name, "provider_status": exc.status},
            )
            return SlotResult(category="billing", message=MSG_UNAVAILABLE)
        if isinstance(exc, ProviderContentPolicyError):
            # Never retry elsewhere: another provider must not be used to get around a refusal.
            return SlotResult(outcome=self._refused(""), category="content_policy")
        if isinstance(exc, ProviderRateLimitedError):
            return SlotResult(category="rate_limited", message=MSG_BUSY, busy_wait=exc.retry_after)
        if isinstance(exc, ProviderBadRequestError):
            slot.breaker.record_failure()
            return SlotResult(category="bad_request", message=MSG_FAILED)
        slot.breaker.record_failure()
        timed_out = isinstance(exc, ProviderTimeoutError)
        return SlotResult(
            category="timeout" if timed_out else "server_error",
            message=MSG_TIMEOUT if timed_out else MSG_FAILED,
        )

    def _log_attempt(
        self, slot: ProviderSlot, attempt: int, started: float, category: str, status: int | None
    ) -> None:
        latency = round((asyncio.get_running_loop().time() - started) * 1000, 1)
        logger.info(
            "ai_attempt",
            extra={
                "provider": slot.name,
                "model": slot.model,
                "attempt": attempt,
                "category": category,
                "provider_status": status,
                "latency_ms": latency,
            },
        )

    def _refused(self, refusal: str) -> SuggestOutcome:
        text = scrub_text(refusal)[:300]
        return SuggestOutcome(
            status="failed", message=f"{MSG_REFUSAL} {text}".strip() if text else MSG_REFUSAL
        )
