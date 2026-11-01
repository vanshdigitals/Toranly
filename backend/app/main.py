"""App factory: middleware, routers, Problem Details handlers and the built web app."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from anyio import to_thread
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, Response
from sqlalchemy import Engine

from app.ai.fixture_provider import FixtureProvider
from app.ai.orchestrator import AiService
from app.ai.provider import Provider
from app.ai.registry import build_slots
from app.api.v1 import ai, health, plan
from app.core.clock import now_utc
from app.core.config import Settings, get_settings
from app.core.errors import ProblemError, install_error_handlers
from app.core.logging import configure_logging, redactor
from app.core.ratelimit import PostgresUsageStore, SlidingWindowLimiter, UsageStore
from app.core.security import SecurityMiddleware
from app.db.session import make_engine

logger = logging.getLogger("toranly.app")
CLEANUP_INTERVAL_SECONDS = 24 * 3600


async def _cleanup_loop(store: UsageStore) -> None:
    """Delete usage rows older than 30 days at startup and then once a day."""
    while True:
        try:
            deleted = await to_thread.run_sync(store.cleanup, now_utc().date())
            logger.info("usage_cleanup", extra={"deleted_rows": deleted})
        except Exception as exc:
            logger.warning("usage_cleanup_failed", extra={"error_type": type(exc).__name__})
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)


def create_app(
    settings: Settings | None = None,
    *,
    provider: Provider | None = None,
    fallback_provider: Provider | None = None,
    store: UsageStore | None = None,
    engine: Engine | None = None,
    run_cleanup: bool = True,
) -> FastAPI:
    settings = settings or get_settings()
    redactor.register(
        [
            settings.xai_api_key.get_secret_value(),
            settings.groq_api_key.get_secret_value(),
            settings.session_secret.get_secret_value(),
            settings.ip_hash_salt.get_secret_value(),
        ]
    )
    engine = engine or make_engine(settings.database_url)
    store = store or PostgresUsageStore(engine)
    # `provider` / `fallback_provider` replace the real clients for the primary and fallback
    # providers (tests); a provider is still used only when its key and limits are configured.
    overrides: dict[str, Provider] = {}
    if provider is not None:
        overrides[settings.ai_primary_provider] = provider
    if fallback_provider is not None and settings.ai_fallback_provider != "none":
        overrides[settings.ai_fallback_provider] = fallback_provider
    if settings.ai_fake_provider:
        # Every provider answers from recorded fixtures, so no request can reach the network.
        fixtures = FixtureProvider()
        overrides = {name: fixtures for name in settings.provider_chain}

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        slots = build_slots(settings, overrides) if settings.ai_enabled else []
        app.state.ai_service = AiService(settings, slots, store)
        logger.info(
            "ai_providers",
            extra={"provider": [s.name for s in slots], "model": [s.model for s in slots]},
        )
        if settings.ai_disabled_reason:
            logger.warning("ai_disabled", extra={"error_code": settings.ai_disabled_reason})
        task = asyncio.create_task(_cleanup_loop(store)) if run_cleanup else None
        try:
            yield
        finally:
            if task:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

    prod = settings.is_production
    app = FastAPI(
        title="Toranly API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if prod else "/docs",
        redoc_url=None if prod else "/redoc",
        openapi_url=None if prod else "/openapi.json",
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.api_limiter = SlidingWindowLimiter(settings.api_limit_per_ip_per_minute)

    install_error_handlers(app)

    if settings.cors_origins and not prod:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
            max_age=600,
        )
    elif settings.cors_origins and prod:
        logger.warning("CORS_ORIGINS is ignored in production; the app is served same-origin.")
    # Compress the built web app and JSON (about 70% smaller on the main bundle).
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    # Added last so it is the outermost middleware: every response gets the request id
    # and security headers, including CORS preflights and 413/403 rejections.
    app.add_middleware(SecurityMiddleware, settings=settings)

    api_prefix = "/api/v1"
    app.include_router(health.router, prefix=api_prefix)
    app.include_router(plan.router, prefix=api_prefix)
    app.include_router(ai.router, prefix=api_prefix)

    _mount_web(app, settings)
    return app


def _mount_web(app: FastAPI, settings: Settings) -> None:
    """Serve the built React app from the same origin (ARCHITECTURE.md §7)."""
    static = Path(settings.static_dir).resolve() if settings.static_dir else None
    index = static / "index.html" if static else None
    reserved = ("api", "docs", "redoc", "openapi.json")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa(path: str, request: Request) -> Response:
        first = path.split("/", 1)[0]
        if first in reserved or static is None or index is None or not index.is_file():
            raise ProblemError(404, "not_found", "This page or resource does not exist.")
        candidate = (static / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(static):
            immutable = path.startswith("assets/")
            return FileResponse(
                candidate,
                headers={
                    "Cache-Control": "public, max-age=31536000, immutable"
                    if immutable
                    else "public, max-age=3600"
                },
            )
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


def app_factory() -> FastAPI:
    configure_logging()
    return create_app()
