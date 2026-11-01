"""Injectable clock so date-dependent code is deterministic in tests."""

from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


def now_utc() -> datetime:
    return datetime.now(UTC)


def today_in(timezone: str) -> date:
    return now_utc().astimezone(ZoneInfo(timezone)).date()
