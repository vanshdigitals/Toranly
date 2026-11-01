"""Context-based planning decisions: task urgency and the Overview's "Next best actions".

Pure and deterministic (no I/O, no AI). It combines results the other engines already
computed (budget metrics, diet coverage, schedule checks) with the task list and the days
left, and explains every suggestion in one plain sentence. Runs in O(n) over tasks,
categories and schedule problems.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Literal, Protocol

from app.domain.budget_engine import CategoryMetrics
from app.domain.guests import DietCounts, DietCoverage
from app.domain.money import format_inr
from app.domain.schedule import Overlap

# A task due within this many days is "due soon".
DUE_SOON_DAYS = 7
# The Overview shows at most this many suggestions.
MAX_ACTIONS = 5
# Urgent tasks shown before budget, menu and schedule problems get a slot; more urgent
# tasks follow those, so one kind of problem never hides the others.
MAX_URGENT_FIRST = 3
# Budget categories whose tasks also depend on the menu covering every diet.
FOOD_CATEGORY_KEYS = frozenset({"catering", "food"})

DIET_LABELS: Mapping[str, str] = {
    "veg": "vegetarian",
    "nonVeg": "non-vegetarian",
    "jain": "Jain",
    "eggetarian": "eggetarian",
    "vegan": "vegan",
}

Urgency = Literal["urgent", "soon"]
ActionKind = Literal["task", "blocked_task", "budget_over", "budget_warning", "menu", "schedule"]
ActionTab = Literal["timeline", "budget", "ideas", "schedule"]


class InsightTask(Protocol):
    @property
    def id(self) -> str: ...
    @property
    def title(self) -> str: ...
    @property
    def status(self) -> str: ...
    @property
    def due_date(self) -> date | None: ...
    @property
    def offset_days(self) -> int | None: ...
    @property
    def date_mode(self) -> str: ...
    @property
    def is_milestone(self) -> bool: ...
    @property
    def category_key(self) -> str | None: ...
    @property
    def depends_on(self) -> Sequence[str]: ...


@dataclass(frozen=True)
class TaskUrgency:
    task_id: str
    level: Urgency
    reason: str


@dataclass(frozen=True)
class NextAction:
    kind: ActionKind
    title: str
    reason: str
    tab: ActionTab
    refs: list[str]


def format_day(day: date) -> str:
    """Indian-style short date, e.g. 14 Mar 2027."""
    return f"{day.day} {day:%b} {day.year}"


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def task_urgency(task: InsightTask, today: date, event_date: date | None) -> TaskUrgency | None:
    """Urgent when the task is late or the event is closer than its usual lead time.

    "Soon" when it is due within DUE_SOON_DAYS. Done tasks and tasks without a date are
    neither.
    """
    if task.status == "done":
        return None
    days_left = (event_date - today).days if event_date is not None else None
    lead = task.offset_days if task.date_mode == "relative" else None
    if days_left is not None and lead is not None and 0 <= days_left < lead:
        return TaskUrgency(
            task.id,
            "urgent",
            f"Usually done {_plural(lead, 'day')} before the event; only "
            f"{_plural(days_left, 'day')} left.",
        )
    if task.due_date is None:
        return None
    due_in = (task.due_date - today).days
    if due_in < 0:
        return TaskUrgency(
            task.id,
            "urgent",
            f"Was due on {format_day(task.due_date)} ({_plural(-due_in, 'day')} ago).",
        )
    if due_in <= DUE_SOON_DAYS:
        when = "today" if due_in == 0 else f"in {_plural(due_in, 'day')}"
        return TaskUrgency(task.id, "soon", f"Due {when} ({format_day(task.due_date)}).")
    return None


def task_urgencies(
    tasks: Sequence[InsightTask], today: date, event_date: date | None
) -> dict[str, TaskUrgency]:
    """Urgency for every open task that has one, keyed by task id."""
    result: dict[str, TaskUrgency] = {}
    for task in tasks:
        urgency = task_urgency(task, today, event_date)
        if urgency is not None:
            result[task.id] = urgency
    return result


def rebalance_hint(over: CategoryMetrics, categories: Sequence[CategoryMetrics]) -> str:
    """Which category still has the most room, so money can move to the one that is over."""
    roomiest = max(
        (c for c in categories if c.category_id != over.category_id and c.remaining_paise > 0),
        key=lambda c: c.remaining_paise,
        default=None,
    )
    overspend = format_inr(over.committed_paise - over.allocated_paise)
    if roomiest is None:
        return (
            f"Over by {overspend}, and no other category has room; raise the budget or cut costs."
        )
    return (
        f"Over by {overspend}. {roomiest.label} still has "
        f"{format_inr(roomiest.remaining_paise)} unspent; move some of it here."
    )


def _menu_gap_text(counts: DietCounts, coverage: DietCoverage) -> str:
    by_key = counts.by_key()
    parts = [f"{by_key[key]} {DIET_LABELS.get(key, key)}" for key in coverage.uncovered]
    listed = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
    return f"{listed} guests have no dish on the menu yet"


def _task_order(task: InsightTask, urgency: TaskUrgency) -> tuple[int, int, date]:
    level = 0 if urgency.level == "urgent" else 1
    return (level, 0 if task.is_milestone else 1, task.due_date or date.max)


def next_best_actions(
    tasks: Sequence[InsightTask],
    today: date,
    event_date: date | None,
    categories: Sequence[CategoryMetrics],
    diet_counts: DietCounts | None,
    coverage: DietCoverage | None,
    overlaps: Sequence[Overlap],
    outside_window_ids: Sequence[str],
    function_names: Mapping[str, str],
) -> list[NextAction]:
    """Up to MAX_ACTIONS suggestions, most important first, each with a one-line reason.

    Order: up to MAX_URGENT_FIRST urgent tasks (milestones first, then by due date; a task
    waiting on another points to the task it waits for), categories over budget with a
    rebalance hint, diet groups missing from the menu, schedule problems, the remaining
    urgent tasks, tasks due soon, categories near their limit.
    """
    by_id = {t.id: t for t in tasks}
    urgencies = task_urgencies(tasks, today, event_date)
    menu_gap = (
        _menu_gap_text(diet_counts, coverage)
        if coverage is not None and diet_counts is not None and coverage.uncovered
        else None
    )
    menu_hint_task: str | None = None
    seen_tasks: set[str] = set()
    urgent: list[NextAction] = []
    soon: list[NextAction] = []

    ranked = sorted(
        (by_id[task_id] for task_id in urgencies), key=lambda t: _task_order(t, urgencies[t.id])
    )
    for task in ranked:
        urgency = urgencies[task.id]
        blocker = next(
            (by_id[d] for d in task.depends_on if d in by_id and by_id[d].status != "done"), None
        )
        target = blocker or task
        if target.id in seen_tasks:
            continue
        seen_tasks.add(target.id)
        if blocker is not None:
            action = NextAction(
                "blocked_task",
                f"Finish “{blocker.title}” first",
                f"“{task.title}” waits for it. {urgency.reason}",
                "timeline",
                [blocker.id, task.id],
            )
        else:
            reason = urgency.reason
            if menu_gap and task.category_key in FOOD_CATEGORY_KEYS:
                reason = f"{reason.rstrip('.')}, and {menu_gap}."
                menu_hint_task = menu_hint_task or task.id
            action = NextAction("task", task.title, reason, "timeline", [task.id])
        (urgent if urgency.level == "urgent" else soon).append(action)

    over = [
        NextAction(
            "budget_over",
            f"Rebalance {c.label}",
            rebalance_hint(c, categories),
            "budget",
            [c.category_id],
        )
        for c in categories
        if c.status == "over"
    ]
    near = [
        NextAction(
            "budget_warning",
            f"Keep an eye on {c.label}",
            f"{c.percent_committed}% of its budget is already committed.",
            "budget",
            [c.category_id],
        )
        for c in categories
        if c.status == "warning"
    ]

    menu: list[NextAction] = []
    if menu_gap and coverage is not None:
        groups = ", ".join(DIET_LABELS.get(k, k) for k in coverage.uncovered)
        menu.append(
            NextAction("menu", f"Add {groups} dishes to the menu", f"{menu_gap}.", "ideas", [])
        )

    schedule: list[NextAction] = []
    if overlaps:
        names = sorted({function_names.get(o.function_id, "a function") for o in overlaps})
        schedule.append(
            NextAction(
                "schedule",
                "Fix overlapping schedule items",
                f"{_plural(len(overlaps), 'pair')} of items overlap in {', '.join(names)}.",
                "schedule",
                [i for o in overlaps for i in (o.item_a_id, o.item_b_id)],
            )
        )
    if outside_window_ids:
        schedule.append(
            NextAction(
                "schedule",
                "Move items into their function's hours",
                f"{_plural(len(outside_window_ids), 'item')} start or end outside the "
                "function's time.",
                "schedule",
                list(outside_window_ids),
            )
        )

    head, rest = urgent[:MAX_URGENT_FIRST], urgent[MAX_URGENT_FIRST:]
    ordered = [*head, *over, *menu, *schedule, *rest, *soon, *near]
    # The menu gap was already explained inside a food task that made the list.
    if menu_hint_task and any(a.refs[:1] == [menu_hint_task] for a in ordered[:MAX_ACTIONS]):
        ordered = [a for a in ordered if a.kind != "menu"]
    return ordered[:MAX_ACTIONS]
