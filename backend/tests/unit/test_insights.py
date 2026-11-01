"""Task urgency, budget rebalance hints and Next best actions (app/domain/insights.py)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

import pytest

from app.domain.budget_engine import CategoryMetrics
from app.domain.guests import DietCounts, DietCoverage
from app.domain.insights import (
    MAX_ACTIONS,
    MAX_URGENT_FIRST,
    next_best_actions,
    rebalance_hint,
    task_urgency,
)
from app.domain.money import format_inr
from app.domain.schedule import Overlap

TODAY = date(2026, 11, 1)
EVENT = date(2026, 11, 21)  # 20 days away


@dataclass
class Task:
    id: str
    title: str = "Task"
    status: str = "open"
    due_date: date | None = None
    offset_days: int | None = None
    date_mode: str = "relative"
    is_milestone: bool = False
    category_key: str | None = None
    depends_on: list[str] = field(default_factory=list)


def due_in(days: int) -> date:
    return TODAY + timedelta(days=days)


def category(
    cid: str, label: str, allocated: int, committed: int, status: str = "ok"
) -> CategoryMetrics:
    return CategoryMetrics(
        category_id=cid,
        key=cid,
        label=label,
        allocated_paise=allocated,
        planned_paise=committed,
        quoted_paise=0,
        paid_paise=0,
        committed_paise=committed,
        remaining_paise=allocated - committed,
        status=status,  # type: ignore[arg-type]
        percent_committed=min(100, committed * 100 // allocated) if allocated else 0,
    )


def actions(tasks: list[Task], **kw: object) -> list:  # type: ignore[type-arg]
    args: dict[str, object] = {
        "tasks": tasks,
        "today": TODAY,
        "event_date": EVENT,
        "categories": [],
        "diet_counts": None,
        "coverage": None,
        "overlaps": [],
        "outside_window_ids": [],
        "function_names": {},
    }
    args.update(kw)
    return next_best_actions(**args)  # type: ignore[arg-type]


# --- format_inr -------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("paise", "text"),
    [
        (0, "₹0"),
        (99, "₹1"),
        (125_000_000, "₹12,50,000"),
        (12_345_678_900, "₹12,34,56,789"),
        (-5_000, "-₹50"),
    ],
)
def test_format_inr_uses_indian_grouping(paise: int, text: str) -> None:
    assert format_inr(paise) == text


# --- task_urgency -----------------------------------------------------------------------


def test_urgent_when_lead_time_exceeds_days_left() -> None:
    u = task_urgency(Task("t", offset_days=30, due_date=due_in(-10)), TODAY, EVENT)
    assert u is not None and u.level == "urgent"
    assert u.reason == "Usually done 30 days before the event; only 20 days left."


def test_fixed_task_past_due_is_urgent_with_the_date() -> None:
    u = task_urgency(Task("t", date_mode="fixed", due_date=due_in(-3)), TODAY, EVENT)
    assert u is not None and u.level == "urgent"
    assert u.reason == "Was due on 29 Oct 2026 (3 days ago)."


@pytest.mark.parametrize(("days", "when"), [(0, "today"), (1, "in 1 day"), (7, "in 7 days")])
def test_due_within_a_week_is_soon(days: int, when: str) -> None:
    u = task_urgency(Task("t", offset_days=1, due_date=due_in(days)), TODAY, EVENT)
    assert u is not None and u.level == "soon"
    assert u.reason.startswith(f"Due {when} (")


@pytest.mark.parametrize(
    "task",
    [
        Task("done", status="done", due_date=due_in(-5)),
        Task("far", offset_days=5, due_date=due_in(8)),
        Task("undated"),
    ],
)
def test_no_urgency(task: Task) -> None:
    assert task_urgency(task, TODAY, EVENT) is None


# --- rebalance_hint ---------------------------------------------------------------------


def test_rebalance_names_the_category_with_most_room() -> None:
    over = category("decor", "Decor", 100_000_00, 150_000_00, "over")
    cats = [
        over,
        category("venue", "Venue", 500_000_00, 100_000_00),
        category("music", "Music", 50_000_00, 0),
    ]
    assert rebalance_hint(over, cats) == (
        "Over by ₹50,000. Venue still has ₹4,00,000 unspent; move some of it here."
    )


def test_rebalance_without_room_says_so() -> None:
    over = category("decor", "Decor", 100, 200, "over")
    assert "no other category has room" in rebalance_hint(over, [over])


# --- next_best_actions ------------------------------------------------------------------


def test_urgent_milestone_comes_before_an_earlier_plain_task() -> None:
    result = actions(
        [
            Task("plain", "Send invites", date_mode="fixed", due_date=due_in(-5)),
            Task("mile", "Book venue", date_mode="fixed", due_date=due_in(-1), is_milestone=True),
        ]
    )
    assert [a.title for a in result[:2]] == ["Book venue", "Send invites"]


def test_waiting_task_points_to_the_task_it_waits_for() -> None:
    first = Task("visit", "Visit venues", due_date=due_in(10), offset_days=10)
    waiting = Task("book", "Book venue", due_date=due_in(-2), depends_on=["visit"])
    [action] = actions([first, waiting])
    assert action.kind == "blocked_task"
    assert action.title == "Finish “Visit venues” first"
    assert action.refs == ["visit", "book"]


def test_food_task_explains_the_menu_gap_and_no_duplicate_menu_action() -> None:
    caterer = Task("cat", "Book the caterer", due_date=due_in(5), category_key="catering")
    counts = DietCounts(veg=100, jain=12)
    coverage = DietCoverage(covered=["veg"], uncovered=["jain"], fully_covered=False)
    result = actions([caterer], diet_counts=counts, coverage=coverage)
    assert [a.kind for a in result] == ["task"]
    assert result[0].reason == (
        "Due in 5 days (6 Nov 2026), and 12 Jain guests have no dish on the menu yet."
    )


def test_menu_gap_gets_its_own_action_without_a_food_task() -> None:
    counts = DietCounts(veg=80, vegan=4)
    coverage = DietCoverage(covered=["veg"], uncovered=["vegan"], fully_covered=False)
    [action] = actions([], diet_counts=counts, coverage=coverage)
    assert action.kind == "menu" and action.tab == "ideas"
    assert action.reason == "4 vegan guests have no dish on the menu yet."


def test_budget_schedule_and_order_of_kinds() -> None:
    result = actions(
        [Task("soon", "Order sweets", due_date=due_in(3), offset_days=3)],
        categories=[
            category("decor", "Decor", 100, 150, "over"),
            category("venue", "Venue", 1000, 920, "warning"),
        ],
        overlaps=[Overlap("a", "b", "fn1")],
        function_names={"fn1": "Sangeet"},
    )
    assert [a.kind for a in result] == ["budget_over", "schedule", "task", "budget_warning"]
    assert result[1].reason == "1 pair of items overlap in Sangeet."
    assert result[3].reason == "92% of its budget is already committed."


def test_at_most_five_actions_and_deterministic() -> None:
    tasks = [Task(f"t{i}", f"Task {i}", date_mode="fixed", due_date=due_in(-i)) for i in range(9)]
    first = actions(tasks)
    assert len(first) == MAX_ACTIONS
    assert first == actions(list(reversed(tasks)))


def test_nothing_to_do_means_no_actions() -> None:
    assert actions([Task("t", status="done", due_date=due_in(-1))]) == []


def test_many_urgent_tasks_do_not_hide_an_over_budget_category() -> None:
    tasks = [Task(f"t{i}", f"Task {i}", date_mode="fixed", due_date=due_in(-i)) for i in range(6)]
    result = actions(tasks, categories=[category("decor", "Decor", 100, 150, "over")])
    kinds = [a.kind for a in result]
    assert kinds[:MAX_URGENT_FIRST] == ["task"] * MAX_URGENT_FIRST
    assert kinds[MAX_URGENT_FIRST] == "budget_over"


def test_menu_gap_lists_groups_naturally() -> None:
    counts = DietCounts(veg=150, non_veg=18, jain=12)
    coverage = DietCoverage(covered=[], uncovered=["veg", "nonVeg", "jain"], fully_covered=False)
    [action] = actions([], diet_counts=counts, coverage=coverage)
    assert action.reason == (
        "150 vegetarian, 18 non-vegetarian and 12 Jain guests have no dish on the menu yet."
    )
