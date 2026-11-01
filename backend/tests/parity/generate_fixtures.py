"""Writes tests/parity/fixtures/*.json from the case list below.

Expected values are computed by the Python engines (themselves pinned by the hand-computed
unit tests in tests/unit). `tsDivergence` marks cases where the TypeScript engine is known to
disagree; the Vitest parity test expects those to fail and the report lists them.

Run: uv run python -m tests.parity.generate_fixtures
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.domain.templates import EVENT_TYPES
from tests.parity.adapters import run

OUT = Path(__file__).parent / "fixtures"

TASKS = [
    {
        "id": "a",
        "title": "Book venue",
        "offsetDays": 10,
        "dueDate": "2027-02-04",
        "dateMode": "relative",
        "status": "open",
        "dependsOn": [],
    },
    {
        "id": "b",
        "title": "Print banner",
        "dueDate": "2026-12-01",
        "dateMode": "fixed",
        "status": "open",
        "dependsOn": [],
    },
    {
        "id": "c",
        "title": "Shortlist caterers",
        "offsetDays": 120,
        "dateMode": "relative",
        "status": "open",
        "dependsOn": ["a"],
    },
    {
        "id": "d",
        "title": "Pay deposit",
        "offsetDays": 120,
        "dateMode": "relative",
        "status": "done",
        "dependsOn": [],
    },
]

CASES: dict[str, list[dict[str, Any]]] = {
    "money": [
        {
            "name": "split thirds of 1000.01",
            "fn": "split",
            "input": {
                "totalPaise": 100001,
                "shares": [
                    {"key": "a", "sharePercent": 33.33},
                    {"key": "b", "sharePercent": 33.33},
                    {"key": "c", "sharePercent": 33.34},
                ],
            },
        },
        {
            "name": "split ties go to earlier position",
            "fn": "split",
            "input": {
                "totalPaise": 2,
                "shares": [
                    {"key": "a", "sharePercent": 50},
                    {"key": "b", "sharePercent": 25},
                    {"key": "c", "sharePercent": 25},
                ],
            },
        },
        {
            "name": "split zero total",
            "fn": "split",
            "input": {
                "totalPaise": 0,
                "shares": [{"key": "a", "sharePercent": 60}, {"key": "b", "sharePercent": 40}],
            },
        },
        {
            "name": "split 15 lakh wedding shares",
            "fn": "split",
            "input": {
                "totalPaise": 150000001,
                "shares": [
                    {"key": "venue", "sharePercent": 28},
                    {"key": "catering", "sharePercent": 30},
                    {"key": "decor", "sharePercent": 14},
                    {"key": "attire", "sharePercent": 10},
                    {"key": "photo", "sharePercent": 8},
                    {"key": "entertainment", "sharePercent": 4},
                    {"key": "invitations", "sharePercent": 3},
                    {"key": "contingency", "sharePercent": 3},
                ],
            },
        },
    ],
    "budget": [
        *[
            {
                "name": f"status {c} of 100000",
                "fn": "budgetStatus",
                "input": {"allocatedPaise": 100000, "committedPaise": c},
            }
            for c in (89900, 90000, 100000, 100100)
        ],
        {
            "name": "status zero allocation, zero committed",
            "fn": "budgetStatus",
            "input": {"allocatedPaise": 0, "committedPaise": 0},
        },
        {
            "name": "status zero allocation, committed",
            "fn": "budgetStatus",
            "input": {"allocatedPaise": 0, "committedPaise": 1},
        },
        {
            "name": "status 899 of 999 (exact 90% rule)",
            "fn": "budgetStatus",
            "input": {"allocatedPaise": 999, "committedPaise": 899},
        },
        {
            "name": "status 896 of 995",
            "fn": "budgetStatus",
            "input": {"allocatedPaise": 995, "committedPaise": 896},
        },
        {
            "name": "metrics committed is max of kinds",
            "fn": "budgetMetrics",
            "input": {
                "categories": [
                    {"id": "c1", "key": "food", "label": "Food", "allocatedPaise": 2625000},
                    {"id": "c2", "key": "venue", "label": "Venue", "allocatedPaise": 1000000},
                    {"id": "c3", "key": "decor", "label": "Decor", "allocatedPaise": 0},
                ],
                "expenses": [
                    {"categoryId": "c1", "amountPaise": 2800000, "kind": "quoted"},
                    {"categoryId": "c1", "amountPaise": 500000, "kind": "paid"},
                    {"categoryId": "c1", "amountPaise": 100000, "kind": "planned"},
                    {"categoryId": "venue", "amountPaise": 950000, "kind": "planned"},
                ],
            },
        },
    ],
    "timeline": [
        *[
            {
                "name": f"due {e} minus {o}",
                "fn": "dueDate",
                "input": {"eventDate": e, "offsetDays": o},
            }
            for e, o in (
                ("2027-03-01", 1),
                ("2028-03-01", 1),
                ("2028-02-29", 365),
                ("2027-01-31", 31),
                ("2026-11-30", 0),
                ("2027-02-14", 120),
            )
        ],
        {
            "name": "date preview, fixed tasks unchanged",
            "fn": "datePreview",
            "input": {
                "tasks": TASKS,
                "oldEventDate": "2027-02-14",
                "newEventDate": "2027-01-14",
                "today": "2026-10-28",
            },
        },
        {
            "name": "date preview, later date",
            "fn": "datePreview",
            "input": {
                "tasks": TASKS,
                "oldEventDate": "2027-02-14",
                "newEventDate": "2027-03-01",
                "today": "2026-10-28",
            },
        },
        {
            "name": "no cycle",
            "fn": "cycle",
            "input": {"tasks": [{"id": "a", "dependsOn": []}, {"id": "b", "dependsOn": ["a"]}]},
        },
        {
            "name": "cycle with blocked task",
            "fn": "cycle",
            "input": {
                "tasks": [
                    {"id": "a", "dependsOn": ["b"]},
                    {"id": "b", "dependsOn": ["a"]},
                    {"id": "c", "dependsOn": ["a"]},
                    {"id": "d", "dependsOn": []},
                ]
            },
        },
        {
            "name": "self dependency",
            "fn": "cycle",
            "input": {"tasks": [{"id": "a", "dependsOn": ["a"]}]},
        },
        {
            "name": "unknown dependency ignored",
            "fn": "cycle",
            "input": {"tasks": [{"id": "a", "dependsOn": ["zzz"]}]},
        },
        {
            "name": "gate blocked by open prerequisite",
            "fn": "gate",
            "input": {
                "taskId": "c",
                "tasks": [
                    {"id": "a", "status": "open", "dependsOn": []},
                    {"id": "b", "status": "done", "dependsOn": []},
                    {"id": "c", "status": "open", "dependsOn": ["a", "b"]},
                ],
            },
        },
    ],
    "quotes": [
        {
            "name": "normalise total, per plate, missing units, rounding",
            "fn": "quotes",
            "input": {
                "guestCount": 60,
                "quotes": [
                    {
                        "id": "q1",
                        "vendorId": "v1",
                        "amountPaise": 2700000,
                        "unit": "total",
                        "inclusions": [],
                    },
                    {
                        "id": "q2",
                        "vendorId": "v2",
                        "amountPaise": 40000,
                        "unit": "per_plate",
                        "units": 60,
                        "inclusions": [],
                    },
                    {
                        "id": "q3",
                        "vendorId": "v3",
                        "amountPaise": 50000,
                        "unit": "per_guest",
                        "inclusions": [],
                    },
                    {
                        "id": "q4",
                        "vendorId": "v4",
                        "amountPaise": 2400000,
                        "unit": "total",
                        "inclusions": [],
                    },
                ],
            },
        },
        {
            "name": "per guest rounds half up",
            "fn": "quotes",
            "input": {
                "guestCount": 2,
                "quotes": [
                    {
                        "id": "q",
                        "vendorId": "v",
                        "amountPaise": 5,
                        "unit": "total",
                        "inclusions": [],
                    }
                ],
            },
        },
    ],
    "guests": [
        {
            "name": "diet counts match",
            "fn": "dietCounts",
            "input": {
                "expectedTotal": 60,
                "breakdown": {"veg": 40, "nonVeg": 12, "jain": 8, "eggetarian": 0, "vegan": 0},
            },
        },
        {
            "name": "diet counts exceed",
            "fn": "dietCounts",
            "input": {
                "expectedTotal": 50,
                "breakdown": {"veg": 40, "nonVeg": 12, "jain": 8, "eggetarian": 0, "vegan": 0},
            },
        },
        {
            "name": "coverage by menu tags",
            "fn": "dietCoverage",
            "input": {
                "breakdown": {"veg": 10, "nonVeg": 5, "jain": 2, "eggetarian": 0, "vegan": 1},
                "ideas": [
                    {"kind": "menu", "dietTags": ["Veg", "non-veg"]},
                    {"kind": "theme", "dietTags": ["jain"]},
                ],
            },
        },
        {
            "name": "coverage with AI tag non_veg",
            "fn": "dietCoverage",
            "input": {
                "breakdown": {"veg": 10, "nonVeg": 5, "jain": 0, "eggetarian": 0, "vegan": 0},
                "ideas": [{"kind": "menu", "dietTags": ["veg", "non_veg"]}],
            },
        },
    ],
    "schedule": [
        {
            "name": "overlaps within a function",
            "fn": "scheduleOverlaps",
            "input": {
                "items": [
                    {"id": "a", "functionId": "f1", "startTime": "10:00", "durationMin": 60},
                    {"id": "b", "functionId": "f1", "startTime": "10:59", "durationMin": 10},
                    {"id": "c", "functionId": "f1", "startTime": "11:00", "durationMin": 30},
                    {"id": "d", "functionId": "f2", "startTime": "10:00", "durationMin": 60},
                ]
            },
        },
    ],
    "templates": [
        {
            "name": f"template {t}",
            "fn": "template",
            "input": {"type": t, "budgetTotalPaise": 7500001, "eventDate": "2027-02-14"},
        }
        for t in EVENT_TYPES
    ],
}


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for group, cases in CASES.items():
        out = []
        for case in cases:
            out.append(
                {
                    "name": case["name"],
                    "fn": case["fn"],
                    "input": case["input"],
                    "expected": run(case["fn"], case["input"]),
                    "tsDivergence": case.get("tsDivergence"),
                }
            )
        path = OUT / f"{group}.json"
        path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {path.name}: {len(out)} cases")


if __name__ == "__main__":
    main()
