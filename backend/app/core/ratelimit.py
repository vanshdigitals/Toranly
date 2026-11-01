"""Rate limiting.

- `SlidingWindowLimiter`: small in-memory limiter for general API traffic (per IP per minute).
  Resets on restart and is per process; acceptable for the stateless reference endpoints.
- `TokenBucket`: in-memory provider guard for xAI requests/tokens per minute.
- `PostgresUsageStore`: AI usage counters shared by all workers, updated with atomic upserts.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Literal, Protocol

from sqlalchemy import Engine, delete, func, select, text, update
from sqlalchemy.dialects.postgresql import insert

from app.db.models import AiGlobalUsage, AiIpUsage, AiUsage

LimitLayer = Literal["device_minute", "device_day", "ip_day", "global_day", "spend_cap"]
RETENTION_DAYS = 30


def seconds_until_next_minute(now: datetime) -> int:
    return max(1, 60 - now.second)


def seconds_until_next_day(now: datetime) -> int:
    tomorrow = datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), UTC)
    return max(1, int((tomorrow - now).total_seconds()))


def next_reset(now: datetime) -> datetime:
    return datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), UTC)


# --- In-memory limiters ----------------------------------------------------------------------


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float = 60.0, max_keys: int = 50_000) -> None:
        self.limit = limit
        self.window = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, now: float | None = None) -> int | None:
        """Record a hit. Returns None when allowed, else seconds to wait."""
        now = time.monotonic() if now is None else now
        with self._lock:
            if len(self._hits) > self.max_keys:
                self._prune(now)
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(1, int(hits[0] + self.window - now) + 1)
            hits.append(now)
            return None

    def _prune(self, now: float) -> None:
        stale = [k for k, v in self._hits.items() if not v or v[-1] <= now - self.window]
        for key in stale:
            del self._hits[key]


@dataclass
class TokenBucket:
    """Requests-per-minute and tokens-per-minute buckets, refilled continuously."""

    requests_per_minute: float
    tokens_per_minute: float
    request_capacity: float
    clock: Callable[[], float] = time.monotonic

    def __post_init__(self) -> None:
        self._requests = self.request_capacity
        self._tokens = self.tokens_per_minute
        self._last = self._now()
        self._lock = threading.Lock()

    def _now(self) -> float:
        return float(self.clock())

    def _refill(self) -> None:
        now = self._now()
        elapsed = max(0.0, now - self._last)
        self._last = now
        self._requests = min(
            self.request_capacity, self._requests + elapsed * self.requests_per_minute / 60
        )
        self._tokens = min(
            self.tokens_per_minute, self._tokens + elapsed * self.tokens_per_minute / 60
        )

    def try_acquire(self, tokens: int) -> float | None:
        """Take one request and `tokens` tokens. Returns None on success, else seconds to wait."""
        tokens = min(tokens, int(self.tokens_per_minute))
        with self._lock:
            self._refill()
            if self._requests >= 1 and self._tokens >= tokens:
                self._requests -= 1
                self._tokens -= tokens
                return None
            wait_req = (
                0.0
                if self._requests >= 1
                else (1 - self._requests) * 60 / max(self.requests_per_minute, 1e-9)
            )
            wait_tok = (
                0.0
                if self._tokens >= tokens
                else (tokens - self._tokens) * 60 / max(self.tokens_per_minute, 1e-9)
            )
            return max(wait_req, wait_tok, 1.0)

    def refund_tokens(self, tokens: int) -> None:
        with self._lock:
            self._tokens = min(self.tokens_per_minute, self._tokens + max(0, tokens))


# --- Postgres-backed AI usage ----------------------------------------------------------------


@dataclass(frozen=True)
class AiLimits:
    per_device_minute: int
    per_device_day: int
    per_ip_day: int
    global_day: int
    spend_cap_usd: Decimal


@dataclass
class Reservation:
    device_hash: str
    ip_hash: str
    day: date
    minute_bucket: int
    reserved_cost: Decimal


@dataclass(frozen=True)
class UsageSnapshot:
    device_minute: int
    device_day: int
    ip_day: int
    global_count: int
    global_cost_usd: Decimal


class LimitExceededError(Exception):
    def __init__(self, layer: LimitLayer, retry_after: int) -> None:
        super().__init__(layer)
        self.layer = layer
        self.retry_after = retry_after


class UsageStore(Protocol):
    def reserve(
        self, device_hash: str, ip_hash: str, now: datetime, cost: Decimal, limits: AiLimits
    ) -> Reservation: ...

    def extend(self, reservation: Reservation, extra_cost: Decimal, limits: AiLimits) -> bool: ...

    def release(self, reservation: Reservation) -> None: ...

    def finalize(
        self,
        reservation: Reservation,
        input_tokens: int,
        output_tokens: int,
        actual_cost: Decimal,
    ) -> None: ...

    def snapshot(self, device_hash: str, ip_hash: str, now: datetime) -> UsageSnapshot: ...

    def cleanup(self, today: date, keep_days: int = RETENTION_DAYS) -> int: ...


class PostgresUsageStore:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def reserve(
        self, device_hash: str, ip_hash: str, now: datetime, cost: Decimal, limits: AiLimits
    ) -> Reservation:
        """Check layers 1-4 in order and count the request, all in one transaction.

        A per-device advisory lock serialises the device checks across workers; the IP and
        global rows use conditional upserts (`ON CONFLICT ... DO UPDATE ... WHERE`), so the
        increment only happens while the row is under its limit. Any failure rolls back
        every increment made so far.
        """
        day = now.date()
        minute = now.hour * 60 + now.minute
        with self.engine.begin() as conn:
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
                {"k": f"tdv:{device_hash}"},
            )
            minute_count, day_count = conn.execute(
                select(
                    func.coalesce(
                        func.sum(AiUsage.count).filter(AiUsage.minute_bucket == minute), 0
                    ),
                    func.coalesce(func.sum(AiUsage.count), 0),
                ).where(AiUsage.device_hash == device_hash, AiUsage.day == day)
            ).one()
            if minute_count >= limits.per_device_minute:
                raise LimitExceededError("device_minute", seconds_until_next_minute(now))
            if day_count >= limits.per_device_day:
                raise LimitExceededError("device_day", seconds_until_next_day(now))

            ip_stmt = insert(AiIpUsage).values(ip_hash=ip_hash, day=day, count=1)
            ip_row = conn.execute(
                ip_stmt.on_conflict_do_update(
                    index_elements=[AiIpUsage.ip_hash, AiIpUsage.day],
                    set_={"count": AiIpUsage.count + 1},
                    where=AiIpUsage.count < limits.per_ip_day,
                ).returning(AiIpUsage.count)
            ).first()
            if ip_row is None:
                raise LimitExceededError("ip_day", seconds_until_next_day(now))

            if cost > limits.spend_cap_usd:
                raise LimitExceededError("spend_cap", seconds_until_next_day(now))
            g_stmt = insert(AiGlobalUsage).values(
                day=day, count=1, input_tokens=0, output_tokens=0, est_cost_usd=cost
            )
            g_row = conn.execute(
                g_stmt.on_conflict_do_update(
                    index_elements=[AiGlobalUsage.day],
                    set_={
                        "count": AiGlobalUsage.count + 1,
                        "est_cost_usd": AiGlobalUsage.est_cost_usd + cost,
                    },
                    where=(AiGlobalUsage.count < limits.global_day)
                    & (AiGlobalUsage.est_cost_usd + cost <= limits.spend_cap_usd),
                ).returning(AiGlobalUsage.count)
            ).first()
            if g_row is None:
                current = conn.execute(
                    select(AiGlobalUsage.count).where(AiGlobalUsage.day == day)
                ).scalar_one()
                layer: LimitLayer = "global_day" if current >= limits.global_day else "spend_cap"
                raise LimitExceededError(layer, seconds_until_next_day(now))

            d_stmt = insert(AiUsage).values(
                device_hash=device_hash,
                day=day,
                minute_bucket=minute,
                count=1,
                input_tokens=0,
                output_tokens=0,
            )
            conn.execute(
                d_stmt.on_conflict_do_update(
                    index_elements=[AiUsage.device_hash, AiUsage.day, AiUsage.minute_bucket],
                    set_={"count": AiUsage.count + 1},
                )
            )
        return Reservation(device_hash, ip_hash, day, minute, cost)

    def extend(self, reservation: Reservation, extra_cost: Decimal, limits: AiLimits) -> bool:
        """Reserve more spend for a retry. False when it would cross the daily spend cap."""
        with self.engine.begin() as conn:
            row = conn.execute(
                update(AiGlobalUsage)
                .where(
                    AiGlobalUsage.day == reservation.day,
                    AiGlobalUsage.est_cost_usd + extra_cost <= limits.spend_cap_usd,
                )
                .values(est_cost_usd=AiGlobalUsage.est_cost_usd + extra_cost)
                .returning(AiGlobalUsage.day)
            ).first()
        if row is None:
            return False
        reservation.reserved_cost += extra_cost
        return True

    def release(self, reservation: Reservation) -> None:
        """Undo a reservation when xAI was never called (for example the guard said busy)."""
        with self.engine.begin() as conn:
            conn.execute(
                update(AiUsage)
                .where(
                    AiUsage.device_hash == reservation.device_hash,
                    AiUsage.day == reservation.day,
                    AiUsage.minute_bucket == reservation.minute_bucket,
                    AiUsage.count > 0,
                )
                .values(count=AiUsage.count - 1)
            )
            conn.execute(
                update(AiIpUsage)
                .where(
                    AiIpUsage.ip_hash == reservation.ip_hash,
                    AiIpUsage.day == reservation.day,
                    AiIpUsage.count > 0,
                )
                .values(count=AiIpUsage.count - 1)
            )
            conn.execute(
                update(AiGlobalUsage)
                .where(AiGlobalUsage.day == reservation.day, AiGlobalUsage.count > 0)
                .values(
                    count=AiGlobalUsage.count - 1,
                    est_cost_usd=func.greatest(
                        AiGlobalUsage.est_cost_usd - reservation.reserved_cost, 0
                    ),
                )
            )
        reservation.reserved_cost = Decimal(0)

    def finalize(
        self,
        reservation: Reservation,
        input_tokens: int,
        output_tokens: int,
        actual_cost: Decimal,
    ) -> None:
        """Replace the worst-case reservation with the cost computed from xAI's usage."""
        correction = actual_cost - reservation.reserved_cost
        with self.engine.begin() as conn:
            conn.execute(
                update(AiGlobalUsage)
                .where(AiGlobalUsage.day == reservation.day)
                .values(
                    input_tokens=AiGlobalUsage.input_tokens + input_tokens,
                    output_tokens=AiGlobalUsage.output_tokens + output_tokens,
                    est_cost_usd=func.greatest(AiGlobalUsage.est_cost_usd + correction, 0),
                )
            )
            conn.execute(
                update(AiUsage)
                .where(
                    AiUsage.device_hash == reservation.device_hash,
                    AiUsage.day == reservation.day,
                    AiUsage.minute_bucket == reservation.minute_bucket,
                )
                .values(
                    input_tokens=AiUsage.input_tokens + input_tokens,
                    output_tokens=AiUsage.output_tokens + output_tokens,
                )
            )
        reservation.reserved_cost = actual_cost

    def snapshot(self, device_hash: str, ip_hash: str, now: datetime) -> UsageSnapshot:
        day = now.date()
        minute = now.hour * 60 + now.minute
        with self.engine.connect() as conn:
            device_minute, device_day = conn.execute(
                select(
                    func.coalesce(
                        func.sum(AiUsage.count).filter(AiUsage.minute_bucket == minute), 0
                    ),
                    func.coalesce(func.sum(AiUsage.count), 0),
                ).where(AiUsage.device_hash == device_hash, AiUsage.day == day)
            ).one()
            ip_day = conn.execute(
                select(AiIpUsage.count).where(AiIpUsage.ip_hash == ip_hash, AiIpUsage.day == day)
            ).scalar_one_or_none()
            g = conn.execute(
                select(AiGlobalUsage.count, AiGlobalUsage.est_cost_usd).where(
                    AiGlobalUsage.day == day
                )
            ).first()
        return UsageSnapshot(
            device_minute=int(device_minute),
            device_day=int(device_day),
            ip_day=int(ip_day or 0),
            global_count=int(g[0]) if g else 0,
            global_cost_usd=Decimal(g[1]) if g else Decimal(0),
        )

    def cleanup(self, today: date, keep_days: int = RETENTION_DAYS) -> int:
        """Delete usage rows older than `keep_days`. Returns the number of rows removed."""
        cutoff = today - timedelta(days=keep_days)
        total = 0
        with self.engine.begin() as conn:
            for model in (AiUsage, AiIpUsage, AiGlobalUsage):
                result = conn.execute(delete(model).where(model.day < cutoff))
                total += result.rowcount or 0
        return total
