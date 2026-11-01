from __future__ import annotations

from typing import Any


def context(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "event_type": "birthday",
        "month": "2027-02",
        "days_until_event": 60,
        "city": "Noida",
        "guest_band": "26-75",
        "budget_total_inr": 75000,
        "diet_counts": {"veg": 40, "non_veg": 12, "jain": 8},
        "functions": ["Birthday Celebration & Party"],
        "preferences": {
            "theme_words": ["garden"],
            "diet_focus": ["veg", "jain"],
            "customs": [],
            "avoid_colours": ["black"],
        },
        "existing_category_keys": ["venue", "catering"],
        "existing_task_titles": ["Confirm final headcount with catering"],
        "rejected_reasons": [],
    }
    data.update(overrides)
    return data


def suggest_body(contract: str = "timeline.suggest", **extra: Any) -> dict[str, Any]:
    body: dict[str, Any] = {"contract": contract, "context": context()}
    body.update(extra)
    return body
