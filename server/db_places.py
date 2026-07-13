"""Persistence of the game↔place check-in association.

Backed by the core `game_places` table (migration 009), so it's available
whenever Postgres is (independent of telemetry). Rows are kept after a game
ends for history; an explicit check-out removes them. Callers must guard on
`db.available()` — gameplay degrades gracefully without Postgres.
"""
from . import db


async def upsert(code: str, place: dict, checked_in_by: str | None) -> None:
    """Record (or replace) the game's current check-in. `place` is a places
    dict with place_id/name/lat/lon."""
    async with db.pool().acquire() as con:
        await con.execute(
            """
            INSERT INTO game_places
                (game_code, place_id, place_name, lat, lng, checked_in_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (game_code) DO UPDATE SET
                place_id      = EXCLUDED.place_id,
                place_name    = EXCLUDED.place_name,
                lat           = EXCLUDED.lat,
                lng           = EXCLUDED.lng,
                checked_in_by = EXCLUDED.checked_in_by,
                checked_in_ts = now()
            """,
            code, place["place_id"], place["name"],
            place["lat"], place["lon"], checked_in_by,
        )


async def delete(code: str) -> None:
    async with db.pool().acquire() as con:
        await con.execute("DELETE FROM game_places WHERE game_code = $1", code)


async def get(code: str) -> dict | None:
    async with db.pool().acquire() as con:
        row = await con.fetchrow(
            "SELECT * FROM game_places WHERE game_code = $1", code)
    return dict(row) if row else None
