"""Maps a parity fixture (camelCase JSON, web app field names) onto the Python engines.

web/src/domain/__tests__/parity.test.ts maps the same fixtures onto the TypeScript engines.
Both produce the same output shape, so one `expected` value checks both.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.domain.budget_engine import budget_status, budget_summary
from app.domain.dependency_graph import completion_gate, detect_cycle
from app.domain.guests import DietCounts, diet_coverage, validate_diet_counts
from app.domain.money import Share, split_largest_remainder
from app.domain.quote_compare import compare_quotes
from app.domain.schedule import detect_overlaps
from app.domain.templates import build_template
from app.domain.timeline_engine import due_date_from_offset, preview_date_change


@dataclass
class _Task:
    id: str
    title: str = ""
    offset_days: int | None = None
    due_date: date | None = None
    date_mode: str = "relative"
    status: str = "open"
    depends_on: list[str] = field(default_factory=list)


def _task(t: dict[str, Any]) -> _Task:
    return _Task(
        id=t["id"],
        title=t.get("title", ""),
        offset_days=t.get("offsetDays"),
        due_date=date.fromisoformat(t["dueDate"]) if t.get("dueDate") else None,
        date_mode=t.get("dateMode", "relative"),
        status=t.get("status", "open"),
        depends_on=list(t.get("dependsOn", [])),
    )


@dataclass
class _Obj:
    data: dict[str, Any]

    def __getattr__(self, name: str) -> Any:
        camel = name.split("_")[0] + "".join(p.title() for p in name.split("_")[1:])
        return self.data.get(camel)


def _diet(b: dict[str, int]) -> DietCounts:
    return DietCounts(
        b.get("veg", 0),
        b.get("nonVeg", 0),
        b.get("jain", 0),
        b.get("eggetarian", 0),
        b.get("vegan", 0),
    )


def run(fn: str, inp: dict[str, Any]) -> Any:
    if fn == "split":
        shares = [Share(s["key"], s["sharePercent"]) for s in inp["shares"]]
        return [
            {"key": a.key, "allocatedPaise": a.allocated_paise}
            for a in split_largest_remainder(inp["totalPaise"], shares)
        ]
    if fn == "budgetStatus":
        return budget_status(inp["allocatedPaise"], inp["committedPaise"])
    if fn == "budgetMetrics":
        s = budget_summary(
            [_Obj(c) for c in inp["categories"]],  # type: ignore[misc]
            [_Obj(e) for e in inp["expenses"]],  # type: ignore[misc]
        )
        return {
            "totalAllocatedPaise": s.total_allocated_paise,
            "totalPlannedPaise": s.total_planned_paise,
            "totalQuotedPaise": s.total_quoted_paise,
            "totalPaidPaise": s.total_paid_paise,
            "totalCommittedPaise": s.total_committed_paise,
            "totalRemainingPaise": s.total_remaining_paise,
            "overallStatus": s.overall_status,
            "percentCommitted": s.percent_committed,
            "categories": [
                {
                    "categoryId": m.category_id,
                    "key": m.key,
                    "label": m.label,
                    "allocatedPaise": m.allocated_paise,
                    "plannedPaise": m.planned_paise,
                    "quotedPaise": m.quoted_paise,
                    "paidPaise": m.paid_paise,
                    "committedPaise": m.committed_paise,
                    "remainingPaise": m.remaining_paise,
                    "status": m.status,
                    "percentCommitted": m.percent_committed,
                }
                for m in s.categories
            ],
        }
    if fn == "dueDate":
        return due_date_from_offset(
            date.fromisoformat(inp["eventDate"]), inp["offsetDays"]
        ).isoformat()
    if fn == "datePreview":
        p = preview_date_change(
            [_task(t) for t in inp["tasks"]],
            date.fromisoformat(inp["oldEventDate"]),
            date.fromisoformat(inp["newEventDate"]),
            date.fromisoformat(inp["today"]),
        )
        return {
            "deltaDays": p.delta_days,
            "shifted": [
                {
                    "id": s.id,
                    "title": s.title,
                    "oldDueDate": s.old_due.isoformat(),
                    "newDueDate": s.new_due.isoformat(),
                    "offsetDays": s.offset_days,
                    "becomesOverdue": s.becomes_overdue,
                }
                for s in p.shifted
            ],
            "fixedUnchanged": [
                {
                    "id": u.id,
                    "title": u.title,
                    "dueDate": u.due_date.isoformat() if u.due_date else None,
                }
                for u in p.unchanged_fixed
            ],
            "overdueCount": len(p.now_overdue),
        }
    if fn == "cycle":
        r = detect_cycle([_task(t) for t in inp["tasks"]])
        return {"hasCycle": r.has_cycle, "cycleTaskIds": r.cycle_task_ids}
    if fn == "gate":
        tasks = [_task(t) for t in inp["tasks"]]
        target = next(t for t in tasks if t.id == inp["taskId"])
        g = completion_gate(target, tasks)
        return {"canComplete": g.can_complete, "blockingTaskIds": g.blocking_task_ids}
    if fn == "quotes":
        rows = compare_quotes([_Obj(q) for q in inp["quotes"]], inp["guestCount"])  # type: ignore[misc]
        return [
            {
                "id": r.id,
                "totalPaise": r.total_paise,
                "perGuestPaise": r.per_guest_paise,
                "isCheapest": r.is_cheapest,
            }
            for r in rows
        ]
    if fn == "dietCounts":
        v = validate_diet_counts(inp["expectedTotal"], _diet(inp["breakdown"]))
        return {
            "valid": v.valid,
            "sum": v.sum,
            "expectedTotal": v.expected_total,
            "difference": v.difference,
        }
    if fn == "dietCoverage":
        c = diet_coverage(_diet(inp["breakdown"]), [_Obj(i) for i in inp["ideas"]])  # type: ignore[misc]
        return {"covered": c.covered, "uncovered": c.uncovered, "fullyCovered": c.fully_covered}
    if fn == "scheduleOverlaps":
        return [
            {"itemAId": o.item_a_id, "itemBId": o.item_b_id, "functionId": o.function_id}
            for o in detect_overlaps([_Obj(i) for i in inp["items"]])  # type: ignore[misc]
        ]
    if fn == "template":
        r = build_template(
            inp["type"], inp["budgetTotalPaise"], date.fromisoformat(inp["eventDate"])
        )
        return {
            "categories": [
                {
                    "key": c.key,
                    "label": c.label,
                    "allocatedPaise": c.allocated_paise,
                    "position": c.position,
                }
                for c in r.categories
            ],
            "tasks": [
                {
                    "title": t.title,
                    "categoryKey": t.category_key,
                    "offsetDays": t.offset_days,
                    "dueDate": t.due_date.isoformat() if t.due_date else None,
                    "isMilestone": t.is_milestone,
                    "dependsOnPositions": list(t.depends_on_positions),
                }
                for t in r.tasks
            ],
        }
    raise ValueError(f"unknown parity function {fn}")
