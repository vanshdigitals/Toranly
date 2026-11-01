"""Groq adapter (fallback provider) using the OpenAI Python SDK with GROQ_BASE_URL.

Groq exposes an OpenAI-compatible Chat Completions API. Structured outputs with
`response_format: {"type": "json_schema", "json_schema": {..., "strict": true}}` are documented
for openai/gpt-oss-20b and openai/gpt-oss-120b (console.groq.com/docs/structured-outputs,
checked 2026-10-29). Streaming and tools are not used.

Schema: Groq documents only a subset of JSON Schema for strict mode (types, enum, anyOf,
$ref/$defs, required, additionalProperties false; minimum/maximum appear in its examples).
`groq_schema()` therefore sends a copy without the undocumented keywords (pattern, lengths,
item counts; lengths and counts are restated in `description`) and with `const` turned into a
one-value `enum`. This only changes the hint sent
to Groq: every response is still validated against the full Pydantic contract and passes the
same guards as xAI output, so nothing is accepted that the xAI path would reject.

Not sent: `store` (not documented by Groq), `logprobs`/`n` (rejected by Groq). Reasoning is
kept low and excluded from the response.
"""

from __future__ import annotations

from typing import Any

import openai
from openai import AsyncOpenAI

from app.ai.openai_errors import map_error
from app.ai.provider import ProviderRequest, ProviderResult
from app.ai.xai_client import messages

GROQ_SCHEMA_KEYWORDS = frozenset(
    {
        "type",
        "properties",
        "required",
        "additionalProperties",
        "items",
        "enum",
        "anyOf",
        "$ref",
        "$defs",
        "minimum",
        "maximum",
        "description",
    }
)


def _limits_hint(node: dict[str, Any]) -> str:
    """Dropped length and item-count limits, restated in words for the description."""
    parts = []
    if "maxLength" in node:
        parts.append(f"At most {node['maxLength']} characters.")
    lo, hi = node.get("minItems"), node.get("maxItems")
    if lo is not None and hi is not None:
        parts.append(f"{lo} to {hi} items.")
    elif hi is not None:
        parts.append(f"At most {hi} items.")
    elif lo is not None:
        parts.append(f"At least {lo} items.")
    return " ".join(parts)


def groq_schema(node: Any) -> Any:
    """Copy of an xAI-subset schema limited to the keywords Groq documents for strict mode.

    Length and item-count limits Groq does not enforce are kept as description text, so the
    model still sees them (live run 2026-10-29: a 40-character label came back longer).
    """
    if isinstance(node, dict):
        out: dict[str, Any] = {}
        for key, value in node.items():
            if key in ("properties", "$defs"):
                out[key] = {name: groq_schema(sub) for name, sub in value.items()}
            elif key == "const":
                out["enum"] = [value]
            elif key in GROQ_SCHEMA_KEYWORDS:
                out[key] = groq_schema(value)
        hint = _limits_hint(node)
        if hint:
            out["description"] = f"{out['description']} {hint}" if "description" in out else hint
        return out
    if isinstance(node, list):
        return [groq_schema(v) for v in node]
    return node


class GroqProvider:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        http_client: Any = None,  # tests pass a mocked HTTP client
    ) -> None:
        self._client = AsyncOpenAI(
            api_key=api_key, base_url=base_url, max_retries=0, http_client=http_client
        )
        self._model = model

    async def generate(self, request: ProviderRequest) -> ProviderResult:
        try:
            completion = await self._client.chat.completions.create(  # type: ignore[call-overload]
                model=self._model,
                messages=messages(request),
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": request.schema_name,
                        "schema": groq_schema(request.schema),
                        "strict": True,
                    },
                },
                max_completion_tokens=request.max_output_tokens,
                reasoning_effort="low",
                extra_body={"include_reasoning": False},
                timeout=request.timeout_seconds,
            )
        except openai.OpenAIError as exc:
            raise map_error(exc) from None
        choice = completion.choices[0] if completion.choices else None
        message = choice.message if choice else None
        usage = completion.usage
        details = getattr(usage, "completion_tokens_details", None) if usage else None
        return ProviderResult(
            text=(message.content if message else None) or None,
            refusal=getattr(message, "refusal", None) if message else None,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            model=completion.model or self._model,
            reasoning_tokens=int(getattr(details, "reasoning_tokens", 0) or 0),
        )
