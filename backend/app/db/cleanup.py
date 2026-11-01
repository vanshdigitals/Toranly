"""Run the usage cleanup once: `python -m app.db.cleanup` (for a cron job or manual use)."""

from __future__ import annotations

from app.core.clock import now_utc
from app.core.ratelimit import PostgresUsageStore
from app.db.session import get_engine


def main() -> None:
    deleted = PostgresUsageStore(get_engine()).cleanup(now_utc().date())
    print(f"Deleted {deleted} usage rows older than 30 days.")


if __name__ == "__main__":
    main()
