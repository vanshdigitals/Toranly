"""RFC 9457 Problem Details responses and exception handlers."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("toranly.errors")

PROBLEM_CONTENT_TYPE = "application/problem+json"

_TITLES: dict[int, str] = {
    400: "The request could not be read",
    401: "Not allowed",
    403: "Not allowed",
    404: "Not found",
    405: "Method not allowed",
    413: "Request too large",
    422: "Some fields need attention",
    429: "Too many requests",
    500: "Something went wrong",
    502: "The AI service returned an error",
    503: "Temporarily unavailable",
}


def problem_body(
    status: int,
    code: str,
    detail: str,
    *,
    title: str | None = None,
    instance: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "type": f"urn:toranly:problem:{code}",
        "title": title or _TITLES.get(status, "Request failed"),
        "status": status,
        "detail": detail,
        "code": code,
    }
    if instance:
        body["instance"] = instance
    if extra:
        body.update(extra)
    return body


def problem_response(
    status: int,
    code: str,
    detail: str,
    *,
    title: str | None = None,
    instance: str | None = None,
    headers: dict[str, str] | None = None,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        problem_body(status, code, detail, title=title, instance=instance, extra=extra),
        status_code=status,
        headers=headers,
        media_type=PROBLEM_CONTENT_TYPE,
    )


def problem_bytes(status: int, code: str, detail: str, instance: str | None = None) -> bytes:
    """Serialized problem body for pure ASGI middleware."""
    return json.dumps(problem_body(status, code, detail, instance=instance)).encode()


class ProblemError(Exception):
    """Raise anywhere in a request to return a Problem Details response."""

    def __init__(
        self,
        status: int,
        code: str,
        detail: str,
        *,
        title: str | None = None,
        retry_after: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.detail = detail
        self.title = title
        self.retry_after = retry_after
        self.extra = extra


def _field_name(loc: tuple[Any, ...]) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path", "header", "cookie")]
    return ".".join(parts) or "body"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProblemError)
    async def _problem(request: Request, exc: ProblemError) -> JSONResponse:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after is not None else None
        return problem_response(
            exc.status,
            exc.code,
            exc.detail,
            title=exc.title,
            instance=request.url.path,
            headers=headers,
            extra=exc.extra,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        if any(err.get("type") == "json_invalid" for err in errors):
            return problem_response(
                400,
                "bad_request",
                "The request body is not valid JSON.",
                instance=request.url.path,
            )
        # Never echo submitted values back: only field paths and Pydantic's messages.
        fields = [
            {"field": _field_name(tuple(err.get("loc", ()))), "message": str(err.get("msg", ""))}
            for err in errors[:50]
        ]
        return problem_response(
            422,
            "validation_failed",
            "Check the highlighted fields.",
            instance=request.url.path,
            extra={"errors": fields},
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        codes = {404: "not_found", 405: "method_not_allowed", 400: "bad_request"}
        details = {
            404: "This page or resource does not exist.",
            405: "This method is not allowed here.",
        }
        status = exc.status_code
        return problem_response(
            status,
            codes.get(status, "http_error"),
            details.get(status, "The request could not be completed."),
            instance=request.url.path,
            headers=dict(exc.headers) if exc.headers else None,
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Stack trace goes to logs only (redacted by the log filter); the client gets no internals.
        logger.error(
            "unhandled_exception",
            exc_info=exc,
            extra={"path": request.url.path, "error_type": type(exc).__name__},
        )
        return problem_response(
            500,
            "internal_error",
            "Something went wrong on our side. Try again in a moment.",
            instance=request.url.path,
        )
