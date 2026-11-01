"""Budget metrics: the single definition in ARCHITECTURE.md §4.2."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, Protocol

from app.domain.money import round_half_up_div

BudgetStatus = Literal["ok", "warning", "over"]

# Warning threshold as an exact fraction: committed / allocated >= 9 / 10.
EXPENSE_KINDS = ("planned", "quoted", "paid")
WARNING_NUMERATOR = 9
WARNING_DENOMINATOR = 10


class CategoryLike(Protocol):
    @property
    def id(self) -> str: ...
    @property
    def key(self) -> str: ...
    @property
    def label(self) -> str: ...
    @property
    def allocated_paise(self) -> int: ...


class ExpenseLike(Protocol):
    @property
    def category_id(self) -> str: ...
    @property
    def amount_paise(self) -> int: ...
    @property
    def kind(self) -> str: ...


def budget_status(allocated_paise: int, committed_paise: int) -> BudgetStatus:
    """over if committed > allocated; warning if committed >= exactly 90% of allocated.

    A zero allocation with any committed amount is over. Integer comparison only, so 89.9%
    is ok and 90.0% is warning. The web app uses the same integer rule (tests/parity).
    """
    if allocated_paise <= 0:
        return "over" if committed_paise > 0 else "ok"
    if committed_paise > allocated_paise:
        return "over"
    if committed_paise * WARNING_DENOMINATOR >= allocated_paise * WARNING_NUMERATOR:
        return "warning"
    return "ok"


def percent_committed(allocated_paise: int, committed_paise: int) -> int:
    if allocated_paise <= 0:
        return 0
    return min(100, round_half_up_div(committed_paise * 100, allocated_paise))


@dataclass(frozen=True)
class CategoryMetrics:
    category_id: str
    key: str
    label: str
    allocated_paise: int
    planned_paise: int
    quoted_paise: int
    paid_paise: int
    committed_paise: int
    remaining_paise: int
    status: BudgetStatus
    percent_committed: int


@dataclass(frozen=True)
class BudgetSummary:
    total_allocated_paise: int
    total_planned_paise: int
    total_quoted_paise: int
    total_paid_paise: int
    total_committed_paise: int
    total_remaining_paise: int
    overall_status: BudgetStatus
    percent_committed: int
    categories: list[CategoryMetrics]


def budget_summary(
    categories: Sequence[CategoryLike], expenses: Sequence[ExpenseLike]
) -> BudgetSummary:
    """committed = max(paid, quoted, planned) per category; totals sum per-category values.

    An expense belongs to a category when its category_id equals the category id or key
    (the web app accepts both).
    """
    # One pass over the expenses (O(categories + expenses)), not one per category.
    by_ref: dict[str, dict[str, int]] = {}
    for exp in expenses:
        if exp.kind in EXPENSE_KINDS:
            ref = by_ref.setdefault(exp.category_id, dict.fromkeys(EXPENSE_KINDS, 0))
            ref[exp.kind] += exp.amount_paise
    metrics: list[CategoryMetrics] = []
    for cat in categories:
        refs = {cat.id, cat.key}  # a set, so id == key is counted once
        sums = {k: sum(by_ref.get(r, {}).get(k, 0) for r in refs) for k in EXPENSE_KINDS}
        committed = max(sums["planned"], sums["quoted"], sums["paid"])
        metrics.append(
            CategoryMetrics(
                category_id=cat.id,
                key=cat.key,
                label=cat.label,
                allocated_paise=cat.allocated_paise,
                planned_paise=sums["planned"],
                quoted_paise=sums["quoted"],
                paid_paise=sums["paid"],
                committed_paise=committed,
                remaining_paise=cat.allocated_paise - committed,
                status=budget_status(cat.allocated_paise, committed),
                percent_committed=percent_committed(cat.allocated_paise, committed),
            )
        )
    allocated = sum(c.allocated_paise for c in categories)
    committed_total = sum(m.committed_paise for m in metrics)
    return BudgetSummary(
        total_allocated_paise=allocated,
        total_planned_paise=sum(m.planned_paise for m in metrics),
        total_quoted_paise=sum(m.quoted_paise for m in metrics),
        total_paid_paise=sum(m.paid_paise for m in metrics),
        total_committed_paise=committed_total,
        total_remaining_paise=allocated - committed_total,
        overall_status=budget_status(allocated, committed_total),
        percent_committed=percent_committed(allocated, committed_total),
        categories=metrics,
    )
