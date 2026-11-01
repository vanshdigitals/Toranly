"""Provider protocol and the error types every adapter maps its failures to."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ProviderRequest:
    system: str
    user: str
    schema_name: str
    schema: dict[str, Any]
    max_output_tokens: int
    timeout_seconds: float
    repair_note: str | None = None


@dataclass(frozen=True)
class ProviderResult:
    text: str | None
    refusal: str | None
    input_tokens: int
    output_tokens: int
    model: str
    # Reasoning tokens as reported separately by the provider (0 when not reported).
    reasoning_tokens: int = 0


class ProviderError(Exception):
    """Base class. `input_tokens`/`output_tokens` are billed usage if the provider reported any."""

    kind = "error"


class ProviderRateLimitedError(ProviderError):
    kind = "rate_limited"

    def __init__(self, retry_after: float | None) -> None:
        super().__init__("rate_limited")
        self.retry_after = retry_after


class ProviderTimeoutError(ProviderError):
    kind = "timeout"


class ProviderServerError(ProviderError):
    kind = "server_error"

    def __init__(self, status: int | None = None) -> None:
        super().__init__("server_error")
        self.status = status


class ProviderAuthError(ProviderError):
    kind = "auth"

    def __init__(self, status: int) -> None:
        super().__init__("auth")
        self.status = status


class ProviderBadRequestError(ProviderError):
    kind = "bad_request"

    def __init__(self, status: int) -> None:
        super().__init__("bad_request")
        self.status = status


class ProviderBillingError(ProviderError):
    """No credits, spending limit reached or billing problem. Retrying cannot help."""

    kind = "billing"

    def __init__(self, status: int) -> None:
        super().__init__("billing")
        self.status = status


class ProviderContentPolicyError(ProviderError):
    """The provider refused the content. Switching providers must not be used to bypass it."""

    kind = "content_policy"

    def __init__(self, status: int) -> None:
        super().__init__("content_policy")
        self.status = status


class Provider(Protocol):
    """Generates one structured response. No tools or function calling, ever."""

    async def generate(self, request: ProviderRequest) -> ProviderResult: ...
