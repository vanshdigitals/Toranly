from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.domain.budget_engine import budget_status, budget_summary, percent_committed
from app.domain.dependency_graph import completion_gate, detect_cycle, find_cycle_in_titles
from app.domain.guests import DietCounts, diet_coverage, validate_diet_counts
from app.domain.money import (
    Share,
    rescale_to_basis_points,
    round_half_up_div,
    split_largest_remainder,
)
from app.domain.quote_compare import compare_quotes
from app.domain.schedule import detect_overlaps, outside_window
from app.domain.templates import EVENT_TYPES, TEMPLATES, build_template
from app.domain.timeline_engine import due_date_from_offset, is_overdue, preview_date_change


@dataclass
class T:
    id: str
    title: str = "t"
    offset_days: int | None = None
    due_date: date | None = None
    date_mode: str = "relative"
    status: str = "open"
    depends_on: list[str] = field(default_factory=list)


@dataclass
class Cat:
    id: str
    key: str
    allocated_paise: int
    label: str = "L"


@dataclass
class Exp:
    category_id: str
    amount_paise: int
    kind: str


@dataclass
class Q:
    id: str
    amount_paise: int
    unit: str = "total"
    units: int | None = None
    vendor_id: str = "v"
    inclusions: list[str] = field(default_factory=list)
    valid_until: date | None = None


@dataclass
class Idea:
    kind: str
    diet_tags: list[str]


@dataclass
class S:
    id: str
    function_id: str
    start_time: str
    duration_min: int


@dataclass
class Fn:
    id: str
    start_time: str | None
    end_time: str | None


# --- money ------------------------------------------------------------------------------------


def test_split_sums_exactly_for_thirds() -> None:
    shares = [Share("a", "33.33"), Share("b", "33.33"), Share("c", "33.34")]
    result = split_largest_remainder(100001, shares)
    assert sum(a.allocated_paise for a in result) == 100001
    assert [a.allocated_paise for a in result] == [33330, 33330, 33341]


def test_split_ties_go_to_earlier_position() -> None:
    result = split_largest_remainder(2, [Share("a", 50), Share("b", 25), Share("c", 25)])
    assert [a.allocated_paise for a in result] == [1, 1, 0]


def test_split_zero_and_negative_budget() -> None:
    assert [a.allocated_paise for a in split_largest_remainder(0, [Share("a", 100)])] == [0]
    assert [a.allocated_paise for a in split_largest_remainder(-5, [Share("a", 100)])] == [0]
    assert split_largest_remainder(500, []) == []


@given(
    total=st.integers(min_value=1, max_value=10**12),
    weights=st.lists(st.integers(min_value=0, max_value=10_000), min_size=1, max_size=12),
)
def test_split_property_sum_equals_total(total: int, weights: list[int]) -> None:
    if sum(weights) == 0:
        weights = [1, *weights[1:]]
    bps = rescale_to_basis_points([Decimal(w) for w in weights])
    assert sum(bps) == 10000
    shares = [Share(str(i), Decimal(bp) / 100) for i, bp in enumerate(bps)]
    result = split_largest_remainder(total, shares)
    assert sum(a.allocated_paise for a in result) == total
    assert all(a.allocated_paise >= 0 for a in result)


def test_round_half_up_matches_math_round() -> None:
    assert round_half_up_div(5, 2) == 3  # 2.5 -> 3
    assert round_half_up_div(-5, 2) == -2  # Math.round(-2.5) = -2
    assert round_half_up_div(-13, 5) == -3  # Math.round(-2.6) = -3
    assert round_half_up_div(7, 3) == 2


# --- budget -----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("committed", "expected"),
    [(89_900, "ok"), (90_000, "warning"), (100_000, "warning"), (100_100, "over")],
)
def test_budget_thresholds(committed: int, expected: str) -> None:
    # 89.9%, 90%, 100%, 100.1% of 1,000.00 rupees
    assert budget_status(100_000, committed) == expected


def test_budget_threshold_is_exact_not_rounded() -> None:
    # 90% of 999 is 899.1: 899 is below it (the web app rounds 899.1 down and says warning).
    assert budget_status(999, 899) == "ok"
    assert budget_status(999, 900) == "warning"


def test_budget_zero_allocation() -> None:
    assert budget_status(0, 0) == "ok"
    assert budget_status(0, 1) == "over"
    assert percent_committed(0, 5) == 0


def test_budget_summary_committed_is_max_of_kinds() -> None:
    cats = [Cat("c1", "food", 2_625_000), Cat("c2", "venue", 1_000_000)]
    exps = [
        Exp("c1", 2_800_000, "quoted"),
        Exp("c1", 500_000, "paid"),
        Exp("c1", 100_000, "planned"),
        Exp("venue", 950_000, "planned"),  # matched by key
    ]
    s = budget_summary(cats, exps)
    food, venue = s.categories
    assert food.committed_paise == 2_800_000
    assert food.remaining_paise == -175_000
    assert food.status == "over"
    assert venue.committed_paise == 950_000 and venue.status == "warning"
    assert s.total_committed_paise == 3_750_000
    assert s.total_allocated_paise == 3_625_000
    assert s.overall_status == "over"
    assert food.percent_committed == 100


# --- dates ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("event", "offset", "due"),
    [
        (date(2027, 3, 1), 1, date(2027, 2, 28)),
        (date(2028, 3, 1), 1, date(2028, 2, 29)),  # leap year
        (date(2028, 2, 29), 365, date(2027, 3, 1)),
        (date(2027, 1, 31), 31, date(2026, 12, 31)),  # across year and month end
        (date(2026, 11, 30), 0, date(2026, 11, 30)),
    ],
)
def test_due_dates_across_month_ends_and_leap_years(event: date, offset: int, due: date) -> None:
    assert due_date_from_offset(event, offset) == due


def test_overdue() -> None:
    today = date(2026, 10, 28)
    assert is_overdue(date(2026, 10, 27), "open", today)
    assert not is_overdue(date(2026, 10, 28), "open", today)
    assert not is_overdue(date(2026, 10, 1), "done", today)
    assert not is_overdue(None, "open", today)


def test_date_preview_relative_fixed_and_overdue() -> None:
    tasks = [
        T("a", offset_days=10, due_date=date(2027, 2, 4)),
        T("b", date_mode="fixed", due_date=date(2026, 12, 1)),
        T("c", offset_days=120),
        T("d", offset_days=120, status="done"),
    ]
    p = preview_date_change(tasks, date(2027, 2, 14), date(2027, 1, 14), date(2026, 10, 28))
    assert p.delta_days == -31
    assert [(s.id, s.new_due) for s in p.shifted] == [
        ("a", date(2027, 1, 4)),
        ("c", date(2026, 9, 16)),
        ("d", date(2026, 9, 16)),
    ]
    assert [u.id for u in p.unchanged_fixed] == ["b"]
    assert p.now_overdue == ["c"]


def test_date_preview_shift_fixed_tasks() -> None:
    tasks = [T("b", date_mode="fixed", due_date=date(2026, 12, 1))]
    p = preview_date_change(
        tasks, date(2027, 2, 14), date(2027, 3, 1), date(2026, 10, 28), shift_fixed_tasks=True
    )
    assert p.shifted[0].new_due == date(2026, 12, 16)
    assert p.shifted[0].offset_days is None
    assert p.unchanged_fixed == []


# --- dependencies -----------------------------------------------------------------------------


def test_cycle_detection() -> None:
    assert not detect_cycle([T("a"), T("b", depends_on=["a"])]).has_cycle
    result = detect_cycle(
        [T("a", depends_on=["b"]), T("b", depends_on=["a"]), T("c", depends_on=["a"])]
    )
    assert result.has_cycle
    assert result.cycle_task_ids == ["a", "b", "c"]  # c is blocked behind the cycle
    assert not detect_cycle([T("a", depends_on=["missing"])]).has_cycle
    assert detect_cycle([T("a", depends_on=["a"])]).has_cycle


def test_completion_gate() -> None:
    tasks = [T("a"), T("b", status="done"), T("c", depends_on=["a", "b"])]
    gate = completion_gate(tasks[2], tasks)
    assert not gate.can_complete and gate.blocking_task_ids == ["a"]
    assert completion_gate(tasks[0], tasks).can_complete


def test_title_cycles() -> None:
    assert find_cycle_in_titles({"x": ["y"], "y": ["x"], "z": []}) == {"x", "y"}


# --- quotes, guests, schedule ----------------------------------------------------------------


def test_quotes_normalisation_and_cheapest() -> None:
    rows = compare_quotes(
        [
            Q("q1", 2_700_000),
            Q("q2", 40_000, "per_plate", 60),
            Q("q3", 50_000, "per_guest"),  # missing units: falls back to guests, flagged
            Q("q4", 100, valid_until=date(2026, 1, 1)),
        ],
        60,
        today=date(2026, 10, 28),
    )
    assert [r.total_paise for r in rows] == [2_700_000, 2_400_000, 3_000_000, 100]
    assert [r.per_guest_paise for r in rows] == [45_000, 40_000, 50_000, 2]
    assert [r.missing_units for r in rows] == [False, False, True, False]
    assert [r.is_cheapest for r in rows] == [False, False, False, True]
    assert rows[3].expired


def test_per_guest_rounds_half_up() -> None:
    (row,) = compare_quotes([Q("q", 5)], 2)
    assert row.per_guest_paise == 3  # 2.5 -> 3, like Math.round


def test_diet_totals() -> None:
    assert validate_diet_counts(60, DietCounts(40, 12, 8)).valid
    over = validate_diet_counts(50, DietCounts(40, 12, 8))
    assert not over.valid and over.difference == 10
    assert validate_diet_counts(70, DietCounts(40, 12, 8)).difference == -10


def test_diet_coverage() -> None:
    counts = DietCounts(veg=10, non_veg=5, jain=2)
    cov = diet_coverage(counts, [Idea("menu", ["Veg"]), Idea("theme", ["jain"])])
    assert cov.covered == ["veg"] and cov.uncovered == ["nonVeg", "jain"]
    assert diet_coverage(counts, [Idea("menu", ["veg", "non_veg", "jain"])]).fully_covered


def test_schedule_overlaps_and_window() -> None:
    items = [
        S("a", "f1", "10:00", 60),
        S("b", "f1", "10:59", 10),
        S("c", "f1", "11:00", 30),  # touches a's end: no overlap with a
        S("d", "f2", "10:00", 60),
    ]
    assert [(o.item_a_id, o.item_b_id) for o in detect_overlaps(items)] == [("a", "b"), ("b", "c")]
    assert outside_window(items, [Fn("f1", "10:30", "11:20"), Fn("f2", None, None)]) == ["a", "c"]


# --- templates --------------------------------------------------------------------------------


@pytest.mark.parametrize("event_type", EVENT_TYPES)
def test_templates_split_to_budget_and_have_valid_deps(event_type: str) -> None:
    tpl = TEMPLATES[event_type]  # type: ignore[index]
    assert sum(s.share_percent for s in tpl.shares) == 100
    result = build_template(event_type, 7_500_001, date(2027, 2, 14))  # type: ignore[arg-type]
    assert sum(c.allocated_paise for c in result.categories) == 7_500_001
    positions = {t.position for t in result.tasks}
    for task in result.tasks:
        assert set(task.depends_on_positions) <= positions
        assert task.due_date == due_date_from_offset(date(2027, 2, 14), task.offset_days)


def test_template_without_budget_or_date() -> None:
    result = build_template("birthday", None, None)
    assert all(c.allocated_paise == 0 for c in result.categories)
    assert all(t.due_date is None for t in result.tasks)
