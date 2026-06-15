import re

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from pathlib import Path

from .assets import absolutize_social_images, build_index_html
from .config import APP_URL, FRONTEND_DIST, METRICS_TOKEN, STATS_TOKEN, TELEMETRY_ENABLED, log

router = APIRouter()

# In prod (FRONTEND_DIST set) serve the prebuilt, fingerprinted index.html that
# the build step produced — it references the hashed bundles nginx serves under
# /static. In dev, build the document from the raw source on the fly. Either way
# it's read once here; the document still flows through SecurityHeadersMiddleware
# so the CSP stays single-sourced in server/security.py.
if FRONTEND_DIST:
    _index_html = (Path(FRONTEND_DIST) / "index.html").read_text()
else:
    _index_html = build_index_html()

# Stamp the social-preview image to an absolute URL (no-op when APP_URL is unset).
# Done here so it covers both serving modes from the one document the routes share.
_index_html = absolutize_social_images(_index_html, APP_URL)

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
    return HTMLResponse(_index_html)


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
@router.get("/join")
async def join_page() -> HTMLResponse:
    return HTMLResponse(_index_html)


@router.get("/signin")
async def signin_page() -> HTMLResponse:
    return HTMLResponse(_index_html)


@router.get("/welcome")
async def welcome_page() -> HTMLResponse:
    return HTMLResponse(_index_html)


@router.get("/api/profile/{username}")
async def api_profile(username: str) -> dict:
    """Public profile: username + lifetime stats. No auth required."""
    if not TELEMETRY_ENABLED:
        raise HTTPException(status_code=503, detail="profiles unavailable")
    from server.telemetry import store
    async with store.pool().acquire() as con:
        user = await con.fetchrow(
            "SELECT id, username, created_ts, profile_photo_url FROM users WHERE username_lower = $1",
            username.lower(),
        )
        if user is None:
            raise HTTPException(status_code=404, detail="Player not found")
        stats = await con.fetchrow(
            "SELECT total_games, total_wins, total_rounds, total_rolls, "
            "fastest_win_ms, fastest_win_rolls, total_time_played_ms "
            "FROM player_stats WHERE user_id = $1",
            str(user["id"]),
        )
        recent = await con.fetch(
            """
            SELECT g.game_code, g.round_count, g.started_ts, g.ended_ts,
                   EXTRACT(EPOCH FROM (g.ended_ts - g.started_ts)) * 1000 AS duration_ms,
                   (SELECT count(*) FROM rounds r
                     WHERE r.game_code = g.game_code
                       AND r.winner_user_id = $1) AS wins,
                   (SELECT count(*) FROM rounds r
                     WHERE r.game_code = g.game_code
                       AND r.winner_user_id = $1)
                   >
                   ALL(SELECT count(*) FROM rounds r2
                        JOIN round_player rp3 USING (game_code, round_num)
                       WHERE r2.game_code = g.game_code
                         AND r2.winner_user_id = rp3.user_id
                         AND rp3.user_id <> $1
                       GROUP BY rp3.user_id) AS won_game,
                   (SELECT min(r3.duration_ms) FROM rounds r3
                     WHERE r3.game_code = g.game_code
                       AND r3.winner_user_id = $1) AS fastest_win_ms,
                   (SELECT avg(rp4.avg_dt_between_rolls_ms) FROM round_player rp4
                     WHERE rp4.game_code = g.game_code
                       AND rp4.user_id = $1
                       AND rp4.avg_dt_between_rolls_ms IS NOT NULL) AS avg_roll_speed_ms,
                   (SELECT json_agg(json_build_object(
                             'name', sub.name, 'photo', sub.photo))
                      FROM (SELECT DISTINCT ON (rp2.user_id)
                                   COALESCE(u2.username, ps2.name_last, rp2.user_id) AS name,
                                   u2.profile_photo_url AS photo
                              FROM round_player rp2
                              LEFT JOIN users u2 ON u2.id::text = rp2.user_id
                              LEFT JOIN player_stats ps2 ON ps2.user_id = rp2.user_id
                             WHERE rp2.game_code = g.game_code
                               AND rp2.user_id <> $1) sub
                   ) AS opponents
              FROM games g
             WHERE g.game_code IN (
                     SELECT DISTINCT rp.game_code
                       FROM round_player rp
                      WHERE rp.user_id = $1
                   )
               AND g.ended_ts IS NOT NULL
               AND (SELECT count(DISTINCT rp5.user_id) FROM round_player rp5
                     WHERE rp5.game_code = g.game_code) > 1
             ORDER BY g.ended_ts DESC
             LIMIT 10
            """,
            str(user["id"]),
        )
        recent_list = []
        for r in recent:
            import json as _json
            opps_raw = r["opponents"]
            if isinstance(opps_raw, str):
                opps_raw = _json.loads(opps_raw)
            recent_list.append({
                "rounds": r["round_count"],
                "wins": r["wins"],
                "won_game": r["won_game"],
                "fastest_win_ms": int(r["fastest_win_ms"]) if r["fastest_win_ms"] else None,
                "avg_roll_speed_ms": int(r["avg_roll_speed_ms"]) if r["avg_roll_speed_ms"] else None,
                "duration_ms": int(r["duration_ms"]) if r["duration_ms"] else None,
                "opponents": opps_raw or [],
            })
    return {
        "username": user["username"],
        "member_since": user["created_ts"].isoformat() if user["created_ts"] else None,
        "profile_photo_url": user["profile_photo_url"],
        "stats": dict(stats) if stats else None,
        "recent": recent_list or None,
    }


# Vanity profile URLs: tensies.app/@username. The @ prefix guarantees no
# collision with game codes (which are [A-Za-z]{5}).
@router.get("/@{username}")
async def profile_vanity(username: str) -> HTMLResponse:
    return HTMLResponse(_index_html)


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
    return HTMLResponse(_index_html)
