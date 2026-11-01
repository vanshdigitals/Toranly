"""xAI adapter using the OpenAI Python SDK with XAI_BASE_URL.

Default: Responses API with `text.format` json_schema (strict), confirmed against
docs.x.ai (Structured Outputs guide and API reference, checked 2026-10-28).
Fallback adapter: Chat Completions `response_format` json_schema, selected with
XAI_API_STYLE=chat if the live smoke test shows the Responses shape is rejected.

Requests are sent with `store=False` and without `tools`. SDK retries are disabled; the
orchestrator owns the retry policy.
"""

from __future__ import annotations

from typing import Any

import openai
from openai import AsyncOpenAI

from app.ai.openai_errors import map_error
from app.ai.provider import ProviderRequest, ProviderResult

__all__ = ["XaiProvider", "map_error", "messages"]


def messages(request: ProviderRequest) -> list[dict[str, str]]:
    messages = [
        {"role": "system", "content": request.system},
        {"role": "user", "content": request.user},
    ]
    if request.repair_note:
        messages.append({"role": "user", "content": request.repair_note})
    return messages


def _response_refusal(response: Any) -> str | None:
    for item in getattr(response, "output", None) or []:
        for part in getattr(item, "content", None) or []:
            if getattr(part, "type", None) == "refusal":
                refusal = getattr(part, "refusal", None)
                return str(refusal) if refusal else "refused"
    return None


class XaiProvider:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        style: str = "responses",
        http_client: Any = None,  # tests pass a mocked HTTP client
    ) -> None:
        self._client = AsyncOpenAI(
            api_key=api_key, base_url=base_url, max_retries=0, http_client=http_client
        )
        self._model = model
        self._style = style

    async def generate(self, request: ProviderRequest) -> ProviderResult:
        try:
            if self._style == "chat":
                return await self._chat(request)
            return await self._responses(request)
        except openai.OpenAIError as exc:
            raise map_error(exc) from None

    async def _responses(self, request: ProviderRequest) -> ProviderResult:
        response = await self._client.responses.create(  # type: ignore[call-overload]
            model=self._model,
            input=messages(request),
            text={
                "format": {
                    "type": "json_schema",
                    "name": request.schema_name,
                    "schema": request.schema,
                    "strict": True,
                }
            },
            max_output_tokens=request.max_output_tokens,
            store=False,
            timeout=request.timeout_seconds,
        )
        usage = response.usage
        details = getattr(usage, "output_tokens_details", None) if usage else None
        return ProviderResult(
            text=response.output_text or None,
            refusal=_response_refusal(response),
            input_tokens=usage.input_tokens if usage else 0,
            output_tokens=usage.output_tokens if usage else 0,
            model=response.model or self._model,
            reasoning_tokens=int(getattr(details, "reasoning_tokens", 0) or 0),
        )

    async def _chat(self, request: ProviderRequest) -> ProviderResult:
        completion = await self._client.chat.completions.create(  # type: ignore[call-overload]
            model=self._model,
            messages=messages(request),
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": request.schema_name,
                    "schema": request.schema,
                    "strict": True,
                },
            },
            max_completion_tokens=request.max_output_tokens,
            store=False,
            timeout=request.timeout_seconds,
        )
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
