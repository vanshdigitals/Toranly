"""Alembic environment. Uses DATABASE_URL from settings, or a URL passed by tests.

Startup safety (the container runs `alembic upgrade head` before the app on every start):
- the first connection is retried, because a suspended Neon database takes a few seconds
  to wake up and a cold start must not crash-loop;
- the migration runs under a Postgres advisory lock, so two instances starting at the same
  time apply it once (the second waits, then finds nothing to do).
"""

from __future__ import annotations

import logging
import time
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection, Engine, engine_from_config, pool, text
from sqlalchemy.exc import OperationalError

from app.core.config import get_settings
from app.db.models import Base

config = context.config
if config.config_file_name is not None and not config.attributes.get("skip_logging"):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata
logger = logging.getLogger("alembic.env")

# Arbitrary constant shared by every Toranly instance ("toranly" as a 64-bit number).
MIGRATION_LOCK_ID = 0x746F72616E6C79
CONNECT_ATTEMPTS = 6
CONNECT_BACKOFF_SECONDS = 2.0


def _url() -> str:
    url = config.attributes.get("database_url") or get_settings().database_url
    return str(url)


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def _connect_with_retry(engine: Engine) -> Connection:
    """About a minute in total (2, 4, 8, 16, 32 s), then the error is raised."""
    for attempt in range(1, CONNECT_ATTEMPTS + 1):
        try:
            return engine.connect()
        except OperationalError as exc:
            if attempt == CONNECT_ATTEMPTS:
                raise
            wait = CONNECT_BACKOFF_SECONDS * 2 ** (attempt - 1)
            # The URL (and its password) is never logged; only the error class.
            logger.warning(
                "Database not reachable (%s); retry %d/%d in %.0f s.",
                type(exc.orig).__name__,
                attempt,
                CONNECT_ATTEMPTS - 1,
                wait,
            )
            time.sleep(wait)
    raise AssertionError("unreachable")


def run_migrations_online() -> None:
    connectable = engine_from_config(
        {"sqlalchemy.url": _url()},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": 10},
    )
    with _connect_with_retry(connectable) as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            if connection.dialect.name == "postgresql":
                # Held until this transaction commits (Postgres DDL is transactional).
                connection.execute(
                    text("SELECT pg_advisory_xact_lock(:id)"), {"id": MIGRATION_LOCK_ID}
                )
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
