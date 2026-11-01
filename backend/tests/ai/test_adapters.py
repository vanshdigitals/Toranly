"""Provider adapters against mocked HTTP (httpx.MockTransport): request shape, usage parsing,
error classification and the Groq schema subset. No network."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import openai
import pytest

from app.ai.context import render
from app.ai.contracts import CONTRACTS, xai_schema
from app.ai.contracts.models import PlanContext
from app.ai.groq_client import GROQ_SCHEMA_KEYWORDS, GroqProvider, groq_schema
from app.ai.openai_errors import map_error
from app.ai.provider import (
    ProviderAuthError,
    ProviderBadRequestError,
    ProviderBillingError,
    ProviderContentPolicyError,
    ProviderRateLimitedError,
    ProviderRequest,
    ProviderServerError,
)
from app.ai.xai_client import XaiProvider
from tests.ai.sample import context
from tests.fakes import recorded

KEY = "test-key-not-real"


def _request(contract: str = "theme.suggest") -> ProviderRequest:
    prompt = render(CONTRACTS[contract], PlanContext.model_validate(context()), None)
    return ProviderRequest(
        system=prompt.system,
        user=prompt.user,
        schema_name=CONTRACTS[contract].schema_name,
        schema=prompt.schema,
        max_output_tokens=2500,
        timeout_seconds=5,
    )


class Recorder:
    def __init__(self, status: int, body: Any, headers: dict[str, str] | None = None) -> None:
        self.status, self.body, self.headers = status, body, headers or {}
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        content = self.body if isinstance(self.body, str) else json.dumps(self.body)
        return httpx.Response(
            self.status,
            content=content,
            headers={"content-type": "application/json", **self.headers},
        )

    def sent(self) -> dict[str, Any]:
        return json.loads(self.requests[-1].content)


def _client(recorder: Recorder) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(recorder))


CHAT_OK = {
    "id": "c1",
    "object": "chat.completion",
    "created": 0,
    "model": "openai/gpt-oss-120b",
    "choices": [
        {
            "index": 0,
            "finish_reason": "stop",
            "message": {"role": "assistant", "content": recorded("theme_suggest.valid.json")},
        }
    ],
    "usage": {
        "prompt_tokens": 1200,
        "completion_tokens": 400,
        "total_tokens": 1600,
        "completion_tokens_details": {"reasoning_tokens": 90},
    },
}

RESPONSES_OK = {
    "id": "r1",
    "object": "response",
    "created_at": 0,
    "model": "grok-4.3",
    "status": "completed",
    "output": [
        {
            "type": "message",
            "id": "m1",
            "role": "assistant",
            "status": "completed",
            "content": [
                {
                    "type": "output_text",
                    "text": recorded("theme_suggest.valid.json"),
                    "annotations": [],
                }
            ],
        }
    ],
    "usage": {
        "input_tokens": 1100,
        "output_tokens": 350,
        "total_tokens": 1450,
        "input_tokens_details": {"cached_tokens": 0},
        "output_tokens_details": {"reasoning_tokens": 0},
    },
    "parallel_tool_calls": False,
    "tool_choice": "none",
    "tools": [],
}


def test_groq_request_shape_and_usage() -> None:
    rec = Recorder(200, CHAT_OK)
    provider = GroqProvider(
        KEY, "https://api.groq.com/openai/v1", "openai/gpt-oss-120b", _client(rec)
    )
    result = asyncio.run(provider.generate(_request()))
    sent = rec.sent()
    assert rec.requests[-1].url.path == "/openai/v1/chat/completions"
    assert sent["model"] == "openai/gpt-oss-120b"
    fmt = sent["response_format"]
    assert fmt["type"] == "json_schema" and fmt["json_schema"]["strict"] is True
    assert fmt["json_schema"]["name"] == "theme_suggest"
    assert sent["reasoning_effort"] == "low" and sent["include_reasoning"] is False
    assert sent["max_completion_tokens"] == 2500
    for absent in ("store", "tools", "logprobs", "n", "stream"):
        assert absent not in sent
    assert (result.input_tokens, result.output_tokens, result.reasoning_tokens) == (1200, 400, 90)
    assert result.text == recorded("theme_suggest.valid.json")
    assert rec.requests[-1].headers["authorization"] == f"Bearer {KEY}"


def test_xai_request_shape_and_usage() -> None:
    rec = Recorder(200, RESPONSES_OK)
    provider = XaiProvider(KEY, "https://api.x.ai/v1", "grok-4.3", "responses", _client(rec))
    result = asyncio.run(provider.generate(_request()))
    sent = rec.sent()
    assert rec.requests[-1].url.path == "/v1/responses"
    assert sent["store"] is False and "tools" not in sent
    assert (
        sent["text"]["format"]["type"] == "json_schema" and sent["text"]["format"]["strict"] is True
    )
    # xAI keeps the full schema (its documented subset includes lengths and patterns).
    assert "maxLength" in json.dumps(sent["text"]["format"]["schema"])
    assert sent["max_output_tokens"] == 2500
    assert (result.input_tokens, result.output_tokens) == (1100, 350)
    assert result.text == recorded("theme_suggest.valid.json")


@pytest.mark.parametrize(
    ("provider_name", "status", "body", "headers", "expected"),
    [
        (
            "xai",
            400,
            {
                "code": "invalid-argument",
                "error": "Incorrect API key provided. You can obtain an API key from https://console.x.ai.",
            },
            {},
            ProviderAuthError,
        ),
        (
            "xai",
            403,
            {
                "code": "personal-team-blocked:spending-limit",
                "error": "You have run out of credits or need a Grok subscription.",
            },
            {},
            ProviderBillingError,
        ),
        (
            "xai",
            429,
            {
                "error": "Your team has either used all available credits or reached its "
                "monthly spending limit."
            },
            {},
            ProviderBillingError,
        ),
        (
            "xai",
            429,
            {"error": "Too many requests"},
            {"retry-after": "4"},
            ProviderRateLimitedError,
        ),
        ("xai", 403, {"error": "Permission denied for this model"}, {}, ProviderAuthError),
        (
            "groq",
            401,
            {
                "error": {
                    "message": "Invalid API Key",
                    "type": "invalid_request_error",
                    "code": "invalid_api_key",
                }
            },
            {},
            ProviderAuthError,
        ),
        (
            "groq",
            429,
            {"error": {"message": "Rate limit reached for model on tokens per day (TPD)"}},
            {"retry-after": "420"},
            ProviderRateLimitedError,
        ),
        (
            # Groq free-tier TPM limit: the message links to the billing page.
            "groq",
            429,
            {
                "error": {
                    "message": "Rate limit reached for model `openai/gpt-oss-120b` on tokens "
                    "per minute (TPM): Limit 8000. Please try again in 17s. Need more tokens? "
                    "Upgrade to Dev Tier today at https://console.groq.com/settings/billing",
                    "type": "tokens",
                    "code": "rate_limit_exceeded",
                }
            },
            {"retry-after": "17"},
            ProviderRateLimitedError,
        ),
        ("groq", 498, {"error": {"message": "Capacity exceeded"}}, {}, ProviderServerError),
        ("groq", 503, {"error": {"message": "Service unavailable"}}, {}, ProviderServerError),
        (
            "groq",
            400,
            {"error": {"message": "This content was flagged by the moderation system"}},
            {},
            ProviderContentPolicyError,
        ),
        (
            "groq",
            400,
            {"error": {"message": "invalid json_schema: unsupported keyword"}},
            {},
            ProviderBadRequestError,
        ),
    ],
)
def test_error_classification_over_http(
    provider_name: str, status: int, body: Any, headers: dict[str, str], expected: type
) -> None:
    rec = Recorder(status, body, headers)
    provider: Any = (
        GroqProvider(KEY, "https://api.groq.com/openai/v1", "openai/gpt-oss-120b", _client(rec))
        if provider_name == "groq"
        else XaiProvider(KEY, "https://api.x.ai/v1", "grok-4.3", "responses", _client(rec))
    )
    with pytest.raises(expected) as info:
        asyncio.run(provider.generate(_request()))
    assert len(rec.requests) == 1  # adapters never retry on their own
    assert KEY not in str(info.value)  # provider error text is not carried in our exception
    if expected is ProviderRateLimitedError:
        assert info.value.retry_after == float(headers["retry-after"])  # type: ignore[attr-defined]


def test_connection_error_is_server_error() -> None:
    req = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    exc = openai.APIConnectionError(request=req)
    assert isinstance(map_error(exc), ProviderServerError)


@pytest.mark.parametrize("name", list(CONTRACTS))
def test_groq_schema_uses_only_documented_keywords(name: str) -> None:
    schema = groq_schema(xai_schema(CONTRACTS[name]))
    seen: set[str] = set()

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key in ("properties", "$defs"):
                    for sub in value.values():
                        walk(sub)
                    continue
                seen.add(key)
                walk(value)
            if node.get("type") == "object" and "properties" in node:
                assert node["additionalProperties"] is False
                assert set(node["required"]) == set(node["properties"])
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(schema)
    assert seen <= GROQ_SCHEMA_KEYWORDS
    assert "const" not in json.dumps(schema)
    text = json.dumps(schema)
    assert '"enum": ["1.0"]' in text  # contract_version kept as a one-value enum
