"""Estimate tokens and cost per AI contract (no network).

Input tokens: the rendered prompt (system + contract prompt + <user_data> + JSON Schema) for
the sample context, at ~4 characters per token (typical) and ~3 (the conservative estimate the
server reserves). Output tokens: per-item size measured from the fake-provider fixtures times
the item counts the prompts ask for, capped at AI_MAX_OUTPUT_TOKENS.
Reasoning tokens (if the model reports them separately) are not included; verify with
`pytest -m live -s`, which prints real usage.

Run: uv run python -m scripts.estimate_costs
"""

from __future__ import annotations

import json
import math
from decimal import Decimal
from pathlib import Path

from app.ai.context import render
from app.ai.contracts import CONTRACTS
from app.ai.contracts.models import PlanContext
from app.ai.usage import Prices
from tests.ai.sample import context

RECORDED = Path(__file__).resolve().parents[1] / "tests" / "ai" / "recorded"
MAX_OUT = 2500
PRICES = Prices(Decimal("1.25"), Decimal("2.50"))
CAP = Decimal("2.00")
ENVELOPE_OVERHEAD = 40  # tokens for contract_version, assumptions, warnings, refusal

TYPICAL_ITEMS: dict[str, dict[str, int]] = {
    "plan.generate": {
        "budget_share": 7,
        "task": 14,
        "theme_idea": 3,
        "decor_idea": 4,
        "menu_item": 10,
        "vendor_category": 5,
    },
    "plan.revise": {
        "budget_share": 7,
        "task": 14,
        "theme_idea": 3,
        "decor_idea": 4,
        "menu_item": 10,
        "vendor_category": 5,
    },
    "budget.suggest": {"budget_share": 7},
    "timeline.suggest": {"task": 14},
    "theme.suggest": {"theme_idea": 3, "decor_idea": 5},
    "menu.suggest": {"menu_item": 12},
    "vendors.categories": {"vendor_category": 6},
    "budget.savings": {"saving_idea": 6},
    "schedule.draft": {"schedule_item": 10},
}


def item_tokens() -> dict[str, float]:
    sizes: dict[str, list[int]] = {}
    for path in RECORDED.glob("*.valid.json"):
        for item in json.loads(path.read_text(encoding="utf-8"))["items"]:
            sizes.setdefault(item["kind"], []).append(len(json.dumps(item)))
    return {k: sum(v) / len(v) / 4 for k, v in sizes.items()}


def main() -> None:
    per_item = item_tokens()
    ctx = PlanContext.model_validate(context())
    print(
        "| Contract | Input tokens (typical / reserved) | Output tokens (typical / max) "
        "| Cost typical | Cost worst case | Calls/day at $2 (typical / worst) |"
    )
    print("|---|---|---|---|---|---|")
    for name in CONTRACTS:
        prompt = render(CONTRACTS[name], ctx, "Make it simpler." if name == "plan.revise" else None)
        chars = len(prompt.system) + len(prompt.user) + len(json.dumps(prompt.schema))
        typical_in = math.ceil(chars / 4)
        reserved_in = prompt.estimated_input_tokens
        typical_out = min(
            MAX_OUT,
            ENVELOPE_OVERHEAD
            + math.ceil(sum(per_item[k] * n for k, n in TYPICAL_ITEMS[name].items())),
        )
        typical = PRICES.cost(typical_in, typical_out)
        worst = PRICES.cost(reserved_in, MAX_OUT)
        print(
            f"| {name} | {typical_in} / {reserved_in} | {typical_out} / {MAX_OUT} | "
            f"${typical} | ${worst} | {int(CAP / typical)} / {int(CAP / worst)} |"
        )


if __name__ == "__main__":
    main()
