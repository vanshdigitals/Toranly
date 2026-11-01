"""Mapping of OpenAI SDK errors to provider errors (no network)."""

from __future__ import annotations

import httpx
import openai
import pytest

from app.ai.provider import (
    ProviderAuthError,
    ProviderBadRequestError,
    ProviderRateLimitedError,
    ProviderServerError,
)
from app.ai.xai_client import map_error

REQUEST = httpx.Request("POST", "https://api.x.ai/v1/responses")


def _status_error(
    cls: type[openai.APIStatusError],
    status: int,
    body: object,
    headers: dict[str, str] | None = None,
) -> openai.APIStatusError:
    response = httpx.Response(status, request=REQUEST, headers=headers or {})
    return cls("error", response=response, body=body)


def test_xai_bad_key_400_is_auth_error() -> None:
    # Body text as returned by xAI in the live smoke test.
    exc = _status_error(
        openai.BadRequestError,
        400,
        "Incorrect API key provided. You can obtain an API key from https://console.x.ai.",
    )
    mapped = map_error(exc)
    assert isinstance(mapped, ProviderAuthError) and mapped.status == 400


def test_other_400_stays_bad_request() -> None:
    exc = _status_error(openai.BadRequestError, 400, {"error": "Invalid json_schema"})
    assert isinstance(map_error(exc), ProviderBadRequestError)


@pytest.mark.parametrize(
    ("cls", "status", "expected"),
    [
        (openai.AuthenticationError, 401, ProviderAuthError),
        (openai.PermissionDeniedError, 403, ProviderAuthError),
        (openai.InternalServerError, 503, ProviderServerError),
    ],
)
def test_status_mapping(cls: type[openai.APIStatusError], status: int, expected: type) -> None:
    assert isinstance(map_error(_status_error(cls, status, None)), expected)


def test_rate_limit_reads_retry_after() -> None:
    exc = _status_error(openai.RateLimitError, 429, None, {"retry-after": "7"})
    mapped = map_error(exc)
    assert isinstance(mapped, ProviderRateLimitedError) and mapped.retry_after == 7.0
