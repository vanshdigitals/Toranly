"""Classify OpenAI-SDK errors from xAI and Groq into provider error types.

Messages are inspected only to classify; they are never logged or returned, because they can
echo request data or parts of a key. Billing and bad-key errors are recognised by their text,
since xAI reports them with several status codes (docs.x.ai does not document the bodies;
observed and reported forms: 400 "Incorrect API key provided", 403 or 429 for exhausted
credits or a spending limit). A 429 that names a rate limit is a rate limit even when its text
mentions billing: Groq's free-tier 429 ends with an "upgrade at .../settings/billing" link
(observed 2026-10-29, code "rate_limit_exceeded").
"""

from __future__ import annotations

import re

import openai

from app.ai.provider import (
    ProviderAuthError,
    ProviderBadRequestError,
    ProviderBillingError,
    ProviderContentPolicyError,
    ProviderError,
    ProviderRateLimitedError,
    ProviderServerError,
    ProviderTimeoutError,
)

_BILLING = re.compile(
    r"credit|spending[ -]?limit|billing|insufficient|payment|exceeded your current quota"
    r"|out of funds|subscription"
)
_RATE_LIMIT = re.compile(
    r"rate[ _-]?limit|(tokens|requests) per (minute|day)|\((tpm|rpm|tpd|rpd)\)"
)
_BAD_KEY = re.compile(r"(incorrect|invalid|missing|no)\s+api[ _-]?key|api key (is )?invalid")
_CONTENT_POLICY = re.compile(r"content[ _-]?policy|moderation|flagged|safety system|violat")


def _text(exc: openai.APIStatusError) -> str:
    body = exc.body if exc.body is not None else exc.message
    return str(body).lower()


def _retry_after(exc: openai.APIStatusError) -> float | None:
    value = exc.response.headers.get("retry-after") if exc.response is not None else None
    if value is None:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        return None


def map_error(exc: Exception) -> ProviderError:
    if isinstance(exc, openai.APITimeoutError):
        return ProviderTimeoutError("timeout")
    if isinstance(exc, openai.APIStatusError):
        status = exc.status_code
        text = _text(exc)
        if status == 429 and _RATE_LIMIT.search(text):
            return ProviderRateLimitedError(_retry_after(exc))
        if status in (400, 402, 403, 429) and _BILLING.search(text):
            return ProviderBillingError(status)
        if status in (401, 403) or (status == 400 and _BAD_KEY.search(text)):
            return ProviderAuthError(status)
        if status == 429:
            return ProviderRateLimitedError(_retry_after(exc))
        # 498: Groq "capacity exceeded" for flex processing; treat like an outage.
        if status >= 500 or status == 498:
            return ProviderServerError(status)
        if _CONTENT_POLICY.search(text):
            return ProviderContentPolicyError(status)
        return ProviderBadRequestError(status)
    if isinstance(exc, openai.APIConnectionError):
        return ProviderServerError(None)
    return ProviderServerError(None)
