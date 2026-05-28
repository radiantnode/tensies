"""Postgres connection pool + schema migrations."""
import logging
import pathlib

import asyncpg

from server.config import POSTGRES_DSN

log = logging.getLogger("tensies.store")

_pool: asyncpg.Pool | None = None


async def init() -> asyncpg.Pool:
    """Create the connection pool and apply migrations."""
    global _pool
    _pool = await asyncpg.create_pool(
        POSTGRES_DSN, min_size=2, max_size=10, command_timeout=30
    )
    await _migrate()
    return _pool


async def close() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    assert _pool is not None, "store.init() must be called first"
    return _pool


async def ensure_partitions() -> None:
    """Create partitions for the current and next month if missing.

    Idempotent — safe to call on every startup and from the periodic cron.
    """
    async with _pool.acquire() as con:
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


async def _migrate() -> None:
    async with _pool.acquire() as con:
        await con.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name        TEXT PRIMARY KEY,
                applied_ts  TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        migrations_dir = pathlib.Path(__file__).resolve().parents[2] / "migrations"
        files = sorted(migrations_dir.glob("*.sql"))
        for f in files:
            applied = await con.fetchval(
                "SELECT 1 FROM schema_migrations WHERE name = $1", f.name
            )
            if applied:
                continue
            log.info("migrate  applying %s", f.name)
            sql = f.read_text()
            async with con.transaction():
                await con.execute(sql)
                await con.execute(
                    "INSERT INTO schema_migrations(name) VALUES($1)", f.name
                )
