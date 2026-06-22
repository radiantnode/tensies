import re
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from .assets import build_index_html, build_page_template, render_page
from .config import APP_URL, FRONTEND_DIST, METRICS_TOKEN, STATS_TOKEN, TELEMETRY_ENABLED, log

router = APIRouter()

# Build the page template once at import. In prod the prebuilt index.html is
# read from FRONTEND_DIST; in dev it's assembled from the raw source with
# cache-busting hashes. Either way, render_page() substitutes the $meta_vars
# per-request (defaults for most routes, overrides for profiles etc.).
_html_source = (Path(FRONTEND_DIST) / "index.html").read_text() if FRONTEND_DIST else build_index_html()
_tmpl, _defaults = build_page_template(_html_source, APP_URL)
_index_html = render_page(_tmpl, _defaults)

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
            "SELECT id, username, created_ts, profile_photo_url, location, admin, bio "
            "FROM users WHERE username_lower = $1",
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
            SELECT g.game_code, g.round_count, g.player_count, g.started_ts, g.ended_ts,
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
                             'name', sub.name, 'photo', sub.photo,
                             'wins', sub.wins)
                           ORDER BY sub.wins DESC)
                      FROM (SELECT DISTINCT ON (rp2.user_id)
                                   COALESCE(u2.username, ps2.name_last, rp2.user_id) AS name,
                                   u2.profile_photo_url AS photo,
                                   (SELECT count(*) FROM rounds rw
                                     WHERE rw.game_code = g.game_code
                                       AND rw.winner_user_id = rp2.user_id) AS wins
                              FROM round_player rp2
                              LEFT JOIN users u2 ON u2.id::text = rp2.user_id
                              LEFT JOIN player_stats ps2 ON ps2.user_id = rp2.user_id
                             WHERE rp2.game_code = g.game_code
                               AND rp2.user_id <> $1
                             ORDER BY rp2.user_id) sub
                   ) AS opponents
              FROM games g
             WHERE g.game_code IN (
                     SELECT DISTINCT rp.game_code
                       FROM round_player rp
                      WHERE rp.user_id = $1
                   )
               AND g.ended_ts IS NOT NULL
               AND g.peak_players > 1
             ORDER BY g.ended_ts DESC
             LIMIT 100
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
                "avg_roll_speed_ms": (
                    int(r["avg_roll_speed_ms"]) if r["avg_roll_speed_ms"] else None
                ),
                "duration_ms": int(r["duration_ms"]) if r["duration_ms"] else None,
                "opponents": opps_raw or [],
                "player_count": r["player_count"],
                "game_code": r["game_code"],
            })
    return {
        "username": user["username"],
        "member_since": user["created_ts"].isoformat() if user["created_ts"] else None,
        "profile_photo_url": user["profile_photo_url"],
        "location": user["location"],
        "admin": bool(user["admin"]),
        "bio": user["bio"],
        "stats": dict(stats) if stats else None,
        "recent": recent_list or None,
    }


@router.get("/api/game/{code}")
async def api_game(code: str) -> dict:
    """Public game detail: rounds, players, results. No auth required."""
    if not TELEMETRY_ENABLED:
        raise HTTPException(status_code=503, detail="game history unavailable")
    from server.telemetry import store
    code = code.upper().strip()
    async with store.pool().acquire() as con:
        game = await con.fetchrow("SELECT * FROM games WHERE game_code = $1", code)
        if game is None:
            raise HTTPException(status_code=404, detail="Game not found")
        rounds = await con.fetch(
            """
            SELECT r.round_num, r.target, r.duration_ms, r.total_rolls,
                   r.winner_user_id,
                   COALESCE(u.username, ps.name_last, r.winner_user_id) AS winner_name
              FROM rounds r
              LEFT JOIN users u ON u.id::text = r.winner_user_id
              LEFT JOIN player_stats ps ON ps.user_id = r.winner_user_id
             WHERE r.game_code = $1
             ORDER BY r.round_num
            """,
            code,
        )
        players = await con.fetch(
            """
            WITH joined AS (
                SELECT DISTINCT ON (user_id)
                       user_id,
                       payload->>'name' AS join_name
                  FROM events
                 WHERE game_code = $1 AND type = 'player_joined'
                 ORDER BY user_id, ts DESC
            ),
            roll_stats AS (
                SELECT rp.user_id,
                       sum(rp.rolls)::int AS total_rolls,
                       count(*) FILTER (WHERE r.winner_user_id = rp.user_id)::int AS wins,
                       count(*)::int AS rounds_played
                  FROM round_player rp
                  JOIN rounds r USING (game_code, round_num)
                 WHERE rp.game_code = $1
                 GROUP BY rp.user_id
            )
            SELECT j.user_id,
                   COALESCE(u.username, ps.name_last, j.join_name, j.user_id) AS name,
                   u.profile_photo_url AS photo,
                   COALESCE(rs.total_rolls, 0) AS total_rolls,
                   COALESCE(rs.wins, 0) AS wins,
                   COALESCE(rs.rounds_played, 0) AS rounds_played
              FROM joined j
              LEFT JOIN roll_stats rs USING (user_id)
              LEFT JOIN users u ON u.id::text = j.user_id
              LEFT JOIN player_stats ps ON ps.user_id = j.user_id
             ORDER BY wins DESC, total_rolls ASC
            """,
            code,
        )
    duration_ms = None
    if game["started_ts"] and game["ended_ts"]:
        duration_ms = int((game["ended_ts"] - game["started_ts"]).total_seconds() * 1000)
    return {
        "game_code": code,
        "started_at": game["started_ts"].isoformat() if game["started_ts"] else None,
        "ended_at": game["ended_ts"].isoformat() if game["ended_ts"] else None,
        "duration_ms": duration_ms,
        "num_rounds": game["round_count"],
        "num_players": game["peak_players"],
        "players": [dict(p) for p in players],
        "rounds": [dict(r) for r in rounds],
    }


@router.get("/api/game/{code}/verify")
async def api_game_verify(code: str) -> dict:
    """Batch-verify all drand-backed rolls for a completed game from Postgres."""
    if not TELEMETRY_ENABLED:
        raise HTTPException(status_code=503, detail="telemetry unavailable")
    from .rolltrust import verify_game
    return await verify_game(code)


@router.get("/api/verify/{code}/{pid}/{roll_count}")
async def verify_roll(code: str, pid: str, roll_count: int) -> dict:
    """Re-derive dice from the stored drand round and confirm they match."""
    from .config import DRAND_BASE_URL, DRAND_CHAIN_HASH, ENABLE_DRAND_ROLLING
    from .drand import derive_dice

    if not ENABLE_DRAND_ROLLING:
        raise HTTPException(status_code=404, detail="drand not enabled")

    code = code.upper().strip()
    from . import gamestore
    drand_round = await gamestore.get_drand_round(code, pid, roll_count)
    if drand_round is None:
        raise HTTPException(status_code=404, detail="no drand data for this roll")

    url = f"{DRAND_BASE_URL}/{DRAND_CHAIN_HASH}/public/{drand_round}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="cannot fetch drand beacon")
    beacon = resp.json()

    derived = derive_dice(beacon["randomness"], pid, roll_count, code, num_dice=10)

    return {
        "game_code": code,
        "player_id": pid,
        "roll_count": roll_count,
        "drand_round": drand_round,
        "drand_randomness": beacon["randomness"],
        "derived_dice": derived,
        "beacon_url": url,
    }


@router.get("/games/{code}")
async def game_detail_page(code: str) -> HTMLResponse:
    return HTMLResponse(_index_html)


# Vanity profile URLs: tensies.app/@username. The @ prefix guarantees no
# collision with game codes (which are [A-Za-z]{5}).
@router.get("/@{username}")
async def profile_vanity(username: str) -> HTMLResponse:
    if not TELEMETRY_ENABLED:
        return HTMLResponse(_index_html)
    try:
        from server.telemetry import store
        async with store.pool().acquire() as con:
            user = await con.fetchrow(
                "SELECT username, profile_photo_url, bio FROM users WHERE username_lower = $1",
                username.lower(),
            )
            if user is None:
                return HTMLResponse(_index_html)
            stats = await con.fetchrow(
                "SELECT total_wins, total_games FROM player_stats WHERE user_id = ("
                "SELECT id::text FROM users WHERE username_lower = $1)",
                username.lower(),
            )
        display = user["username"]
        desc_parts = [f"@{display}'s profile on Tensies."]
        if stats and stats["total_games"]:
            desc_parts.append(f"{stats['total_wins']} wins across {stats['total_games']} games.")
        if user["bio"]:
            desc_parts.append(user["bio"])
        desc_parts.append("Challenge them to a game — no download required.")
        base = APP_URL.rstrip("/") if APP_URL else ""
        html = render_page(
            _tmpl, _defaults,
            page_title=f"@{display} — Tensies Player Profile",
            share_title=f"Play Tensies with @{display}!",
            share_description=" ".join(desc_parts),
            canonical_url=f"{base}/@{display}" if base else f"/@{display}",
        )
        return HTMLResponse(html)
    except Exception:
        log.exception("profile meta injection failed for @%s", username)
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
