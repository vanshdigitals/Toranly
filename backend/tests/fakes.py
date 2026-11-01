"""Test doubles: a scripted provider and an in-memory usage store with the same semantics."""

from __future__ import annotations

import asyncio
import json
import threading
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from app.ai.provider import ProviderRequest, ProviderResult
from app.core.ratelimit import (
    AiLimits,
    LimitExceededError,
    Reservation,
    UsageSnapshot,
    seconds_until_next_day,
    seconds_until_next_minute,
)

RECORDED = Path(__file__).parent / "ai" / "recorded"


def recorded(name: str) -> str:
    return (RECORDED / name).read_text(encoding="utf-8")


def ok(
    text: str | dict[str, Any], input_tokens: int = 900, output_tokens: int = 600
) -> ProviderResult:
    body = text if isinstance(text, str) else json.dumps(text)
    return ProviderResult(body, None, input_tokens, output_tokens, "grok-4.3")


@dataclass
class FakeProvider:
    """Returns (or raises) the scripted steps in order; records every request."""

    steps: list[ProviderResult | Exception] = field(default_factory=list)
    delay: float = 0.0
    requests: list[ProviderRequest] = field(default_factory=list)

    async def generate(self, request: ProviderRequest) -> ProviderResult:
        self.requests.append(request)
        if self.delay:
            await asyncio.sleep(self.delay)
        if not self.steps:
            raise AssertionError("FakeProvider called more times than scripted")
        step = self.steps.pop(0)
        if isinstance(step, Exception):
            raise step
        return step


class MemoryUsageStore:
    def __init__(self) -> None:
        self.device: dict[tuple[str, date, int], list[int]] = {}
        self.ip: dict[tuple[str, date], int] = {}
        self.global_: dict[date, list[Any]] = {}
        self.lock = threading.Lock()
        self.released = 0
        self.finalized: list[tuple[int, int, Decimal]] = []

    def reserve(
        self, device_hash: str, ip_hash: str, now: datetime, cost: Decimal, limits: AiLimits
    ) -> Reservation:
        day, minute = now.date(), now.hour * 60 + now.minute
        with self.lock:
            minute_count = self.device.get((device_hash, day, minute), [0, 0, 0])[0]
            day_count = sum(
                v[0] for k, v in self.device.items() if k[0] == device_hash and k[1] == day
            )
            if minute_count >= limits.per_device_minute:
                raise LimitExceededError("device_minute", seconds_until_next_minute(now))
            if day_count >= limits.per_device_day:
                raise LimitExceededError("device_day", seconds_until_next_day(now))
            if self.ip.get((ip_hash, day), 0) >= limits.per_ip_day:
                raise LimitExceededError("ip_day", seconds_until_next_day(now))
            g = self.global_.setdefault(day, [0, 0, 0, Decimal(0)])
            if g[0] >= limits.global_day:
                raise LimitExceededError("global_day", seconds_until_next_day(now))
            if g[3] + cost > limits.spend_cap_usd:
                raise LimitExceededError("spend_cap", seconds_until_next_day(now))
            self.ip[(ip_hash, day)] = self.ip.get((ip_hash, day), 0) + 1
            g[0] += 1
            g[3] += cost
            self.device.setdefault((device_hash, day, minute), [0, 0, 0])[0] += 1
        return Reservation(device_hash, ip_hash, day, minute, cost)

    def extend(self, reservation: Reservation, extra_cost: Decimal, limits: AiLimits) -> bool:
        with self.lock:
            g = self.global_[reservation.day]
            if g[3] + extra_cost > limits.spend_cap_usd:
                return False
            g[3] += extra_cost
        reservation.reserved_cost += extra_cost
        return True

    def release(self, reservation: Reservation) -> None:
        with self.lock:
            self.device[(reservation.device_hash, reservation.day, reservation.minute_bucket)][
                0
            ] -= 1
            self.ip[(reservation.ip_hash, reservation.day)] -= 1
            g = self.global_[reservation.day]
            g[0] -= 1
            g[3] -= reservation.reserved_cost
            self.released += 1

    def finalize(
        self, reservation: Reservation, input_tokens: int, output_tokens: int, actual_cost: Decimal
    ) -> None:
        with self.lock:
            g = self.global_[reservation.day]
            g[1] += input_tokens
            g[2] += output_tokens
            g[3] += actual_cost - reservation.reserved_cost
            self.finalized.append((input_tokens, output_tokens, actual_cost))
        reservation.reserved_cost = actual_cost

    def snapshot(self, device_hash: str, ip_hash: str, now: datetime) -> UsageSnapshot:
        day, minute = now.date(), now.hour * 60 + now.minute
        g = self.global_.get(day, [0, 0, 0, Decimal(0)])
        return UsageSnapshot(
            device_minute=self.device.get((device_hash, day, minute), [0])[0],
            device_day=sum(
                v[0] for k, v in self.device.items() if k[0] == device_hash and k[1] == day
            ),
            ip_day=self.ip.get((ip_hash, day), 0),
            global_count=g[0],
            global_cost_usd=g[3],
        )

    def cleanup(self, today: date, keep_days: int = 30) -> int:
        cutoff = today - timedelta(days=keep_days)
        before = len(self.device) + len(self.ip) + len(self.global_)
        self.device = {k: v for k, v in self.device.items() if k[1] >= cutoff}
        self.ip = {k: v for k, v in self.ip.items() if k[1] >= cutoff}
        self.global_ = {k: v for k, v in self.global_.items() if k >= cutoff}
        return before - (len(self.device) + len(self.ip) + len(self.global_))

    def global_cost(self, day: date) -> Decimal:
        return Decimal(self.global_.get(day, [0, 0, 0, Decimal(0)])[3])
