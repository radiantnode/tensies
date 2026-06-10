import re

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from pathlib import Path

from .config import FRONTEND_DIST, METRICS_TOKEN, STATS_TOKEN, TELEMETRY_ENABLED, log

router = APIRouter()

# In prod (FRONTEND_DIST set) serve the prebuilt, fingerprinted index.html that
# the build step produced — it references the hashed bundles nginx serves under
# /static; it's read once here. In dev, render the document per request with
# fresh ?v= hashes (mtime-gated in assets.py) so CSS/JS edits show on reload,
# and mark it no-cache so the browser always revalidates. Either way the
# document still flows through SecurityHeadersMiddleware so the CSP stays
# single-sourced in server/security.py.
if FRONTEND_DIST:
    _index_html = (Path(FRONTEND_DIST) / "index.html").read_text()

    def _index_response() -> HTMLResponse:
        return HTMLResponse(_index_html)
else:
    from .assets import dev_index_html

    def _index_response() -> HTMLResponse:
        return HTMLResponse(dev_index_html(), headers={"Cache-Control": "no-cache"})

# Fail loud, not closed: a bare `uvicorn` run stays usable, but warn so an
# operator never unknowingly exposes these on a public port. Both compose files
# set tokens, so dev and prod are authenticated by default.
if METRICS_TOKEN is None:
    log.warning("/metrics is UNAUTHENTICATED (set METRICS_TOKEN to require a bearer token)")
if TELEMETRY_ENABLED and STATS_TOKEN is None:
    log.warning("/stats/* is UNAUTHENTICATED (set STATS_TOKEN to require a bearer token)")


def _bearer_guard(expected: str | None):
    """Dependency factory (audit M2). When `expected` is set, require
    `Authorization: Bearer <expected>`. When unset, the endpoint stays open —
    rely on a network ACL (the prod compose keeps these off the public net)."""
    async def _dep(authorization: str | None = Header(default=None)) -> None:
        if expected is None:
            return
        if authorization != f"Bearer {expected}":
            raise HTTPException(status_code=401, detail="unauthorized")
    return _dep


def _require_telemetry() -> None:
    if not TELEMETRY_ENABLED:
        raise HTTPException(status_code=503, detail="telemetry disabled")


@router.get("/")
async def root() -> HTMLResponse:
    return _index_response()


@router.get("/metrics", dependencies=[Depends(_bearer_guard(METRICS_TOKEN))])
async def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@router.get("/stats/leaderboard", dependencies=[Depends(_bearer_guard(STATS_TOKEN))])
async def stats_leaderboard(limit: int = 25) -> dict:
    _require_telemetry()
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


@router.get("/stats/player/{user_id}", dependencies=[Depends(_bearer_guard(STATS_TOKEN))])
async def stats_player(user_id: str) -> dict:
    """Lifetime stats for one player plus their recent rounds."""
    _require_telemetry()
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


@router.get("/stats/game/{game_code}", dependencies=[Depends(_bearer_guard(STATS_TOKEN))])
async def stats_game(game_code: str) -> dict:
    """Summary of one game with per-round and per-player breakdowns."""
    _require_telemetry()
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


# Clean join URLs: GET /<code> serves the SPA, which reads the code from the
# path, pre-fills the join screen, then replaces the URL with /. Game codes are
# 5 letters (gamestore.make_code), so only that shape matches — anything else
# 404s so this can't shadow favicons or other single-segment asset requests.
# Declared last so the explicit routes above (/, /metrics, /stats/*) win.
_GAME_CODE_RE = re.compile(r"[A-Za-z]{5}")


@router.get("/{code}")
async def join_deeplink(code: str) -> HTMLResponse:
    if not _GAME_CODE_RE.fullmatch(code):
        raise HTTPException(status_code=404)
    return _index_response()
