"""Postgres helpers for the telemetry subsystem.

Pool management and schema migrations live in server.db (shared with auth).
This module re-exports pool() for telemetry callers and keeps the
telemetry-specific partition helper.
"""
import logging

from server.db import pool  # noqa: F401 — re-export for telemetry callers

log = logging.getLogger("tensies.store")


async def ensure_partitions() -> None:
    """Create partitions for the current and next month if missing.

    Idempotent — safe to call on every startup and from the periodic cron.
    """
    async with pool().acquire() as con:
        await con.execute(
            """
            DO $$
            DECLARE
                cur_start DATE := date_trunc('month', now())::date;
                cur_end   DATE := (date_trunc('month', now()) + interval '1 month')::date;
                nxt_end   DATE := (date_trunc('month', now()) + interval '2 months')::date;
                cur_name  TEXT := 'events_' || to_char(cur_start, 'YYYY_MM');
                nxt_name  TEXT := 'events_' || to_char(cur_end, 'YYYY_MM');
            BEGIN
                EXECUTE format(
                    'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
                    cur_name, cur_start, cur_end
                );
                EXECUTE format(
                    'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
                    nxt_name, cur_end, nxt_end
                );
            END $$;
            """
        )
