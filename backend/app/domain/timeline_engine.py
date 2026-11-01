"""Due dates from offsets, date-change preview and overdue checks (ARCHITECTURE.md §4.3)."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Protocol


class TaskLike(Protocol):
    @property
    def id(self) -> str: ...
    @property
    def title(self) -> str: ...
    @property
    def offset_days(self) -> int | None: ...
    @property
    def due_date(self) -> date | None: ...
    @property
    def date_mode(self) -> str: ...
    @property
    def status(self) -> str: ...
    @property
    def depends_on(self) -> Sequence[str]: ...


def due_date_from_offset(event_date: date, offset_days: int) -> date:
    """due = event_date - offset_days (calendar days; month ends and leap days included)."""
    return event_date - timedelta(days=offset_days)


def is_overdue(due: date | None, status: str, today: date) -> bool:
    return status != "done" and due is not None and due < today


@dataclass(frozen=True)
class ShiftedTask:
    id: str
    title: str
    old_due: date
    new_due: date
    offset_days: int | None
    date_mode: str
    becomes_overdue: bool


@dataclass(frozen=True)
class UnchangedTask:
    id: str
    title: str
    due_date: date | None


@dataclass(frozen=True)
class DatePreview:
    old_date: date
    new_date: date
    delta_days: int
    shifted: list[ShiftedTask]
    unchanged_fixed: list[UnchangedTask]
    now_overdue: list[str]


def preview_date_change(
    tasks: Sequence[TaskLike],
    old_date: date,
    new_date: date,
    today: date,
    shift_fixed_tasks: bool = False,
) -> DatePreview:
    """Preview of a date change; the same function serves preview and apply.

    Relative tasks get `new_date - offset_days` (missing offset counts as 0, like the web app).
    Fixed tasks keep their date unless `shift_fixed_tasks`, in which case they move by the same
    day delta. `now_overdue` lists open tasks whose new due date is before `today`.
    """
    delta = (new_date - old_date).days
    shifted: list[ShiftedTask] = []
    unchanged: list[UnchangedTask] = []
    for task in tasks:
        if task.date_mode == "fixed":
            if not shift_fixed_tasks or task.due_date is None:
                unchanged.append(UnchangedTask(task.id, task.title, task.due_date))
                continue
            old_due = task.due_date
            new_due = old_due + timedelta(days=delta)
            offset_out: int | None = None
        else:
            offset = task.offset_days or 0
            old_due = task.due_date or due_date_from_offset(old_date, offset)
            new_due = due_date_from_offset(new_date, offset)
            offset_out = offset
        shifted.append(
            ShiftedTask(
                id=task.id,
                title=task.title,
                old_due=old_due,
                new_due=new_due,
                offset_days=offset_out,
                date_mode=task.date_mode,
                becomes_overdue=task.status == "open" and new_due < today,
            )
        )
    return DatePreview(
        old_date=old_date,
        new_date=new_date,
        delta_days=delta,
        shifted=shifted,
        unchanged_fixed=unchanged,
        now_overdue=[s.id for s in shifted if s.becomes_overdue],
    )
