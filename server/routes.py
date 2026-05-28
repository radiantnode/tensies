from fastapi import APIRouter
from fastapi.responses import HTMLResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from .assets import build_index_html

router = APIRouter()

_index_html = build_index_html()


@router.get("/")
async def root() -> HTMLResponse:
    return HTMLResponse(_index_html)


@router.get("/metrics")
async def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@router.get("/stats/leaderboard")
async def stats_leaderboard(limit: int = 25) -> dict:
    """Top players by wins. Cheap query against the player_stats rollup."""
    from server.telemetry import store
    limit = max(1, min(limit, 100))
    async with store.pool().acquire() as con:
        rows = await con.fetch(
            """
            SELECT user_id, name_last, total_wins, total_rounds, total_rolls,
                   fastest_win_ms, fastest_win_rolls
              FROM player_stats
             ORDER BY total_wins DESC, fastest_win_ms ASC NULLS LAST
             LIMIT $1
            """,
            limit,
        )
    return {"leaderboard": [dict(r) for r in rows]}


@router.get("/stats/player/{user_id}")
async def stats_player(user_id: str) -> dict:
    """Lifetime stats for one player plus their recent rounds."""
    from server.telemetry import store
    async with store.pool().acquire() as con:
        row = await con.fetchrow(
            "SELECT * FROM player_stats WHERE user_id = $1", user_id
        )
        recent = await con.fetch(
            """
            SELECT r.game_code, r.round_num, r.target, r.duration_ms, r.total_rolls,
                   r.winner_user_id = $1 AS won
              FROM rounds r
              JOIN round_player rp USING (game_code, round_num)
             WHERE rp.user_id = $1
             ORDER BY r.started_ts DESC
             LIMIT 20
            """,
            user_id,
        )
    return {
        "user_id": user_id,
        "stats": dict(row) if row else None,
        "recent_rounds": [dict(r) for r in recent],
    }


@router.get("/stats/game/{game_code}")
async def stats_game(game_code: str) -> dict:
    """Summary of one game with per-round and per-player breakdowns."""
    from server.telemetry import store
    code = game_code.upper().strip()
    async with store.pool().acquire() as con:
        game = await con.fetchrow("SELECT * FROM games WHERE game_code = $1", code)
        if game is None:
            return {"error": "not_found"}
        rounds = await con.fetch(
            "SELECT * FROM rounds WHERE game_code = $1 ORDER BY round_num", code
        )
        players = await con.fetch(
            """
            SELECT user_id, sum(rolls) AS rolls, max(matched_at_end) AS best_matched,
                   min(avg_dt_between_rolls_ms) AS fastest_avg_dt_ms
              FROM round_player WHERE game_code = $1 GROUP BY user_id
            """,
            code,
        )
    return {
        "game": dict(game),
        "rounds": [dict(r) for r in rounds],
        "players": [dict(p) for p in players],
    }
