"""Output filters and consistency checks (AI_SAFETY.md §4, AI_SCHEMAS.md §5).

Applied after strict JSON Schema + Pydantic validation and before anything is returned.
The same scrubbing is applied to user-supplied context text before it is sent to xAI.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from pydantic import BaseModel

from app.ai.contracts.models import (
    BudgetShare,
    DecorIdea,
    MenuItem,
    PlanContext,
    SavingIdea,
    ScheduleItem,
    TaskItem,
)
from app.domain.dependency_graph import find_cycle_in_titles
from app.domain.money import rescale_to_basis_points
from app.domain.schedule import to_minutes

_URL = re.compile(
    r"(?i)\b(?:https?://|ftp://|www\.)\S+"
    r"|\b[a-z0-9][a-z0-9-]{0,62}\.(?:com|in|net|org|co|io|app|info|biz|shop|store|online|site)"
    r"(?:\.[a-z]{2})?(?:/\S*)?\b"
)
_EMAIL = re.compile(r"(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b")
_PHONES = [
    # International with a plus sign: +91 98765 43210, +1 (415) 555-0100, +44 20 7946 0958
    re.compile(r"\+\d{1,3}[\s.-]?\(?\d{1,5}\)?(?:[\s.-]?\d{2,5}){1,4}"),
    # Indian mobile, optional 0 prefix: 9876543210, 98765 43210, 098765-43210
    re.compile(r"(?<!\d)0?[6-9]\d{4}[\s-]?\d{5}(?!\d)"),
    # Indian landline with STD code: 011-23456789, 080 2345 6789
    re.compile(r"(?<!\d)0\d{2,4}[\s-]\d{3,4}[\s-]?\d{3,4}(?!\d)"),
    # North American style: (415) 555-0100, 415-555-0100
    re.compile(r"(?<!\d)\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)"),
    # Toll free: 1800-123-4567, 1800 123 4567
    re.compile(r"(?<!\d)1[89]00[\s-]?\d{3}[\s-]?\d{4}(?!\d)"),
]
_BOOKING_CLAIMS = re.compile(
    r"(?i)\b(?:"
    r"(?:is|are|was|were|has been|have been|already|now)\s+(?:booked|reserved|confirmed)"
    r"|booked\s+for\s+you|we(?:'ve| have)?\s+(?:booked|reserved)"
    r"|confirmed\s+availability|availability\s+(?:is\s+)?confirmed"
    r"|guaranteed\s+(?:price|rate|availability|slot|booking)"
    r"|prices?\s+(?:is\s+|are\s+)?guaranteed"
    r")\b"
)
# Customs the model must not introduce unless the user listed them (preferences.customs)
# or they appear in the event's own function names. Lower case, matched as whole words.
KNOWN_CUSTOMS: tuple[str, ...] = (
    "haldi",
    "mehendi",
    "mehndi",
    "sangeet",
    "baraat",
    "pheras",
    "mandap",
    "kanyadaan",
    "vidaai",
    "nikah",
    "walima",
    "mehr",
    "roka",
    "sagai",
    "tilak",
    "chunni",
    "anand karaj",
    "griha pravesh",
    "mundan",
    "namkaran",
    "annaprashan",
    "janeu",
    "upanayana",
    "godh bharai",
    "karva chauth",
    "puja",
    "pooja",
    "havan",
    "kirtan",
    "langar",
    "aarti",
    "prasad",
    "prasadam",
    "satyanarayan",
)
# Newline and tab stay; so do ZWNJ/ZWJ, which Indic scripts need. Other control, format
# (including bidi overrides), private-use and surrogate characters are removed.
_KEEP_FORMAT = frozenset({"\n", "\t", "‌", "‍"})


def _keep_char(ch: str) -> bool:
    return ch in _KEEP_FORMAT or not unicodedata.category(ch).startswith("C")


def scrub_text(value: str) -> str:
    """Remove control characters, angle brackets, URLs, emails and phone numbers."""
    value = "".join(ch for ch in value if _keep_char(ch))
    value = value.replace("<", " ").replace(">", " ")
    value = _EMAIL.sub(" ", value)
    value = _URL.sub(" ", value)
    for pattern in _PHONES:
        value = pattern.sub(" ", value)
    return re.sub(r"[ \t]{2,}", " ", value).strip()


def scrub_strings(value: Any) -> Any:
    """Recursively scrub every string in a JSON-like structure."""
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, list):
        return [scrub_strings(v) for v in value]
    if isinstance(value, dict):
        return {k: scrub_strings(v) for k, v in value.items()}
    return value


def _texts(item: BaseModel) -> Iterable[str]:
    for value in item.model_dump().values():
        if isinstance(value, str):
            yield value
        elif isinstance(value, list):
            yield from (v for v in value if isinstance(v, str))


def _mentions(text: str, term: str) -> bool:
    return re.search(rf"(?i)(?<![a-z]){re.escape(term)}(?![a-z])", text) is not None


@dataclass
class GuardResult:
    items: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    dropped: int = 0


def apply_guards(items: list[BaseModel], context: PlanContext) -> GuardResult:
    """Scrub, filter and sanity-check validated items. Returns JSON-ready item dicts."""
    result = GuardResult()
    allowed_customs = {c.lower().strip() for c in context.preferences.customs}
    functions_text = " ".join(context.functions).lower()
    allowed_customs |= {c for c in KNOWN_CUSTOMS if _mentions(functions_text, c)}
    budget_limit = context.budget_total_inr

    kept: list[BaseModel] = []
    for item in items:
        cleaned = _scrub_item(item)
        if cleaned is None:
            result.dropped += 1
            continue
        joined = " ".join(_texts(cleaned))
        if _BOOKING_CLAIMS.search(joined):
            result.dropped += 1
            continue
        if any(_mentions(joined, c) and c not in allowed_customs for c in KNOWN_CUSTOMS):
            result.dropped += 1
            continue
        kept.append(cleaned)

    kept = _check_budget_shares(kept, result)
    kept = _check_tasks(kept, context, result)
    kept = _check_estimates(kept, budget_limit, result)
    kept = _check_schedule(kept, context, result)
    _check_menu(kept, context, result)

    result.items = [item.model_dump(mode="json") for item in kept]
    if result.dropped:
        result.warnings.append(f"{result.dropped} suggestion(s) were removed by safety checks.")
    return result


def _scrub_item(item: BaseModel) -> BaseModel | None:
    data = scrub_strings(item.model_dump())
    try:
        return type(item).model_validate(data)
    except ValueError:
        # Scrubbing emptied a required field below its minimum length; drop the item.
        return None


def _check_budget_shares(items: list[BaseModel], result: GuardResult) -> list[BaseModel]:
    shares: list[BudgetShare] = []
    seen: set[str] = set()
    others: list[BaseModel] = []
    for item in items:
        if isinstance(item, BudgetShare):
            if item.category_key in seen:
                result.dropped += 1
                continue
            seen.add(item.category_key)
            shares.append(item)
        else:
            others.append(item)
    if not shares:
        return others
    total = sum((Decimal(str(s.share_pct)) for s in shares), Decimal(0))
    if not Decimal(95) <= total <= Decimal(105):
        result.warnings.append("budget_shares_inconsistent")
        result.dropped += len(shares)
        return others
    basis_points = rescale_to_basis_points([Decimal(str(s.share_pct)) for s in shares])
    rescaled = [
        s.model_copy(update={"share_pct": bp / 100})
        for s, bp in zip(shares, basis_points, strict=True)
    ]
    return [*rescaled, *others]


def _check_tasks(
    items: list[BaseModel], context: PlanContext, result: GuardResult
) -> list[BaseModel]:
    existing = {t.strip().lower() for t in context.existing_task_titles}
    titles_seen: set[str] = set()
    tasks: list[TaskItem] = []
    others: list[BaseModel] = []
    for item in items:
        if not isinstance(item, TaskItem):
            others.append(item)
            continue
        key = item.title.strip().lower()
        if key in existing or key in titles_seen:
            result.dropped += 1
            continue
        if item.offset_days > context.days_until_event + 730:
            result.dropped += 1
            continue
        titles_seen.add(key)
        tasks.append(item)

    known = titles_seen | existing
    resolved: list[TaskItem] = []
    for task in tasks:
        deps = [d for d in task.depends_on_titles if d.strip().lower() in known]
        resolved.append(task.model_copy(update={"depends_on_titles": deps}))

    edges = {
        t.title.strip().lower(): [d.strip().lower() for d in t.depends_on_titles] for t in resolved
    }
    in_cycle = find_cycle_in_titles(edges)
    final: list[TaskItem] = []
    for task in resolved:
        if task.title.strip().lower() in in_cycle:
            task = task.model_copy(update={"depends_on_titles": []})
        if task.offset_days > context.days_until_event:
            result.warnings.append(f"past_due: {task.title}")
        final.append(task)
    if in_cycle:
        result.warnings.append("Some task dependencies formed a loop and were removed.")
    return [*others, *final]


def _check_estimates(
    items: list[BaseModel], budget_limit: int, result: GuardResult
) -> list[BaseModel]:
    out: list[BaseModel] = []
    for item in items:
        if isinstance(item, DecorIdea):
            lo, hi = item.estimate_inr_min, item.estimate_inr_max
            if lo is not None and hi is not None and lo > hi:
                lo, hi = hi, lo
                item = item.model_copy(update={"estimate_inr_min": lo, "estimate_inr_max": hi})
            if budget_limit > 0 and any(v is not None and v > budget_limit for v in (lo, hi)):
                result.dropped += 1
                continue
        elif isinstance(item, SavingIdea):
            lo, hi = item.estimate_saving_inr_min, item.estimate_saving_inr_max
            if lo > hi:
                lo, hi = hi, lo
                item = item.model_copy(
                    update={"estimate_saving_inr_min": lo, "estimate_saving_inr_max": hi}
                )
            if budget_limit > 0 and hi > budget_limit:
                result.dropped += 1
                continue
        out.append(item)
    return out


def _check_schedule(
    items: list[BaseModel], context: PlanContext, result: GuardResult
) -> list[BaseModel]:
    functions = {f.strip().lower(): f for f in context.functions}
    out: list[BaseModel] = []
    placed: dict[str, list[tuple[int, int, str]]] = {}
    for item in items:
        if isinstance(item, ScheduleItem):
            name = item.function_name.strip().lower()
            if name not in functions:
                result.dropped += 1
                continue
            start = to_minutes(item.start_time)
            end = start + item.duration_min
            for other_start, other_end, other_title in placed.get(name, []):
                if start < other_end and other_start < end:
                    result.warnings.append(f"overlap: {item.title} / {other_title}")
            placed.setdefault(name, []).append((start, end, item.title))
        out.append(item)
    return out


def _check_menu(items: list[BaseModel], context: PlanContext, result: GuardResult) -> None:
    menu = [i for i in items if isinstance(i, MenuItem)]
    if not menu:
        return
    tagged = {tag for dish in menu for tag in dish.diet_tags}
    for group, count in context.diet_counts.items():
        if count > 0 and group not in tagged:
            result.warnings.append(f"diet_not_covered: {group.value}")


__all__ = ["KNOWN_CUSTOMS", "GuardResult", "apply_guards", "scrub_strings", "scrub_text"]
