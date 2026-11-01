"""Day-of schedule checks: overlaps within a function and items outside the function window."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol


class ScheduleItemLike(Protocol):
    @property
    def id(self) -> str: ...
    @property
    def function_id(self) -> str: ...
    @property
    def start_time(self) -> str: ...
    @property
    def duration_min(self) -> int: ...


class FunctionLike(Protocol):
    @property
    def id(self) -> str: ...
    @property
    def start_time(self) -> str | None: ...
    @property
    def end_time(self) -> str | None: ...


def to_minutes(hhmm: str) -> int:
    hours, minutes = hhmm.split(":")[:2]
    return int(hours) * 60 + int(minutes)


@dataclass(frozen=True)
class Overlap:
    item_a_id: str
    item_b_id: str
    function_id: str


def detect_overlaps(items: Sequence[ScheduleItemLike]) -> list[Overlap]:
    """Every overlapping pair within the same function, in input order (start < other end)."""
    by_function: dict[str, list[ScheduleItemLike]] = {}
    for item in items:
        by_function.setdefault(item.function_id, []).append(item)
    overlaps: list[Overlap] = []
    for function_id, group in by_function.items():
        for i, a in enumerate(group):
            start_a = to_minutes(a.start_time)
            end_a = start_a + a.duration_min
            for b in group[i + 1 :]:
                start_b = to_minutes(b.start_time)
                end_b = start_b + b.duration_min
                if start_a < end_b and start_b < end_a:
                    overlaps.append(Overlap(a.id, b.id, function_id))
    return overlaps


def outside_window(
    items: Sequence[ScheduleItemLike], functions: Sequence[FunctionLike]
) -> list[str]:
    """Ids of items that start before or end after their function's start/end time."""
    windows = {f.id: f for f in functions}
    result: list[str] = []
    for item in items:
        fn = windows.get(item.function_id)
        if fn is None:
            continue
        start = to_minutes(item.start_time)
        end = start + item.duration_min
        if (fn.start_time and start < to_minutes(fn.start_time)) or (
            fn.end_time and end > to_minutes(fn.end_time)
        ):
            result.append(item.id)
    return result
