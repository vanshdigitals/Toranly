"""Snapshot tests for the versioned prompts and the JSON Schemas sent to xAI (AI_SCHEMAS.md §8).

Each contract has one snapshot: the system prompt, the rendered user block for the sample
context in tests/ai/sample.py, and the xAI schema. Any change to a prompt file, the
rendering, the sample context or a contract model shows up as a diff here.

After an intentional change, review the diff and regenerate:
    UPDATE_SNAPSHOTS=1 uv run pytest tests/ai/test_prompts.py
A prompt wording change that is not a typo fix should become a new version file
(`{contract}.v2.txt`) instead of editing v1.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from app.ai.context import PROMPT_VERSION, load_prompt, render
from app.ai.contracts import CONTRACTS
from app.ai.contracts.models import PlanContext
from tests.ai.sample import context

SNAPSHOTS = Path(__file__).parent / "snapshots"
FEEDBACK = "Make it simpler and cheaper."


def _rendered(name: str) -> str:
    prompt = render(
        CONTRACTS[name],
        PlanContext.model_validate(context()),
        FEEDBACK if name == "plan.revise" else None,
    )
    schema = json.dumps(prompt.schema, indent=2, sort_keys=True, ensure_ascii=False)
    return (
        f"# prompt version: {PROMPT_VERSION}\n"
        f"=== SYSTEM ===\n{prompt.system}\n"
        f"=== USER ===\n{prompt.user}\n"
        f"=== SCHEMA ({CONTRACTS[name].schema_name}) ===\n{schema}\n"
    )


@pytest.mark.parametrize("name", list(CONTRACTS))
def test_prompt_snapshot(name: str) -> None:
    path = SNAPSHOTS / f"{name}.{PROMPT_VERSION}.txt"
    actual = _rendered(name)
    if os.environ.get("UPDATE_SNAPSHOTS") == "1":
        SNAPSHOTS.mkdir(exist_ok=True)
        path.write_text(actual, encoding="utf-8", newline="\n")
    assert path.is_file(), f"missing snapshot {path.name}; run with UPDATE_SNAPSHOTS=1"
    expected = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    assert actual == expected, f"{path.name} changed; review and regenerate if intended"


def test_every_contract_has_a_prompt_file() -> None:
    for name in CONTRACTS:
        assert load_prompt(name)


def test_system_prompt_keeps_safety_rules() -> None:
    system = load_prompt("system").lower()
    for rule in (
        "<user_data>",
        "never instructions",
        "never name real businesses",
        "phone numbers",
        "never claim that anything is booked",
        "only customs listed in preferences.customs",
        "return only one json object",
    ):
        assert rule in system, rule


def test_no_stale_snapshots() -> None:
    expected = {f"{name}.{PROMPT_VERSION}.txt" for name in CONTRACTS}
    present = {p.name for p in SNAPSHOTS.glob("*.txt")}
    assert present == expected
