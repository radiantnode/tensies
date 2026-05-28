"""Postgres connection pool + schema migrations."""
import logging
import os
import pathlib

import asyncpg

log = logging.getLogger("tensies.store")

_pool: asyncpg.Pool | None = None

DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://tensies:tensies@postgres:5432/tensies"
)


async def init() -> asyncpg.Pool:
    """Create the connection pool and apply migrations."""
    global _pool
    _pool = await asyncpg.create_pool(
        DSN, min_size=2, max_size=10, command_timeout=30
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
        migrations_dir = pathlib.Path(__file__).resolve().parent.parent / "migrations"
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
