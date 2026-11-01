"""Builds what is sent to xAI from a validated PlanContext (data minimisation, NFR-10).

The browser sends only PlanContext fields; the model forbids anything else, so notes,
names, contacts, vendor names and exact dates cannot be included. Free-text fields are
scrubbed again here, and all user text is wrapped in one <user_data> block.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

from app.ai.contracts import Contract, xai_schema
from app.ai.contracts.models import PlanContext
from app.ai.guards import scrub_strings, scrub_text

PROMPT_DIR = Path(__file__).parent / "prompts"
PROMPT_VERSION = "v1"
# Conservative estimate for budgeting before the call: about 3 characters per token
# (English JSON is usually closer to 4). Actual usage from xAI replaces it afterwards.
CHARS_PER_TOKEN_ESTIMATE = 3


@cache
def load_prompt(name: str) -> str:
    return (PROMPT_DIR / f"{name}.{PROMPT_VERSION}.txt").read_text(encoding="utf-8").strip()


def sanitized_context(context: PlanContext, feedback: str | None) -> dict[str, Any]:
    data: dict[str, Any] = scrub_strings(context.model_dump(mode="json"))
    if feedback:
        data["feedback"] = scrub_text(feedback)[:500]
    return data


def render_user_block(contract: Contract, context: PlanContext, feedback: str | None) -> str:
    payload = json.dumps(sanitized_context(context, feedback), ensure_ascii=False, sort_keys=True)
    return f"{load_prompt(contract.name)}\n\n<user_data>\n{payload}\n</user_data>"


@dataclass(frozen=True)
class RenderedPrompt:
    system: str
    user: str
    schema: dict[str, Any]

    @property
    def estimated_input_tokens(self) -> int:
        chars = len(self.system) + len(self.user) + len(json.dumps(self.schema))
        return math.ceil(chars / CHARS_PER_TOKEN_ESTIMATE)


def render(contract: Contract, context: PlanContext, feedback: str | None) -> RenderedPrompt:
    return RenderedPrompt(
        system=load_prompt("system"),
        user=render_user_block(contract, context, feedback),
        schema=xai_schema(contract),
    )
