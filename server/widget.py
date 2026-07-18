"""Home-screen widget page — GET /api/widget.

One self-contained HTML card sized for a phone's wide web widget (Widget Web
et al.): system health, live counts, and the latest finished games. Guarded by
WIDGET_TOKEN as a `?key=` query param — widget apps can only configure a URL,
never request headers, so a bearer header is not an option here. The page
re-fetches itself every 5 minutes via <meta http-equiv="refresh">.

Markup lives in static/html/widget.html; styles in static/css/widget.css (the
CSP is `style-src 'self'`, no inline styles). The CSS rides the normal asset
pipeline: dev links it with a ?v=<content hash> like server/assets.py does for
the app; prod links the fingerprinted file scripts/build_assets.mjs emits
(resolved via dist/manifest.json). The HTML is read from the source tree in
both modes — per request in dev so edits show up live, once at import in prod.
"""
import html
import json
import secrets
from datetime import UTC, datetime
from pathlib import Path
from string import Template

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from . import gamestore, state
from .assets import asset_hash
from .config import FRONTEND_DIST, TELEMETRY_ENABLED, WIDGET_TOKEN, log

router = APIRouter()

REFRESH_SECONDS = 300
RECENT_LIMIT = 10

_CSS_URL = "/static/css/widget.css"
_JS_URL = "/static/js/widget.js"
# The brand logo is a fingerprinted-only asset in prod, so its URL is resolved
# through _asset_href like the CSS/JS — the widget HTML template is never run
# through the build's rewriteRefs pass, so a raw href would 404 behind nginx.
_LOGO_URL = "/static/images/logo.svg"

if FRONTEND_DIST:
    # Prod: the build fingerprinted the widget's assets into dist/ and recorded
    # the hashed URLs in its manifest. Resolved once — dist is immutable at
    # runtime.
    try:
        _prod_hrefs = json.loads((Path(FRONTEND_DIST) / "manifest.json").read_text())
    except (OSError, ValueError):
        log.error("dist/manifest.json unreadable — widget assets will 404 "
                  "(rebuild dist/ with scripts/build_assets.mjs)")
        _prod_hrefs = {}


def _asset_href(url: str) -> str:
    if FRONTEND_DIST:
        return _prod_hrefs.get(url, url)
    # Dev: content-hash the file per request so edits bust the cache on the
    # next 5-minute refresh (reusing the app's asset_hash helper; one small
    # file read per widget render is noise).
    return f"{url}?v={asset_hash([Path(url.lstrip('/'))])}"


_HTML_SRC = Path("static/html/widget.html")

if FRONTEND_DIST:
    _PROD_PAGE = Template(_HTML_SRC.read_text())


def _page_template() -> Template:
    if FRONTEND_DIST:
        return _PROD_PAGE
    return Template(_HTML_SRC.read_text())

_ROW = Template("""      <li><span class="code">$code</span>"""
                """<span class="matchup">$matchup</span>"""
                """<span class="ago">$ago</span></li>""")

_EMPTY_ROW = '      <li class="empty">No finished games yet</li>'


def _matchup(players_json) -> str:
    """'a vs b' / 'a (solo)' / 'a vs b +2' from the game's player-name list
    (json_agg comes back from asyncpg as a JSON string)."""
    names = json.loads(players_json) if isinstance(players_json, str) else players_json
    names = [html.escape(n) for n in (names or []) if n]
    if not names:
        return "unknown"
    if len(names) == 1:
        return f"{names[0]} (solo)"
    extra = f" +{len(names) - 2}" if len(names) > 2 else ""
    return f"{names[0]} vs {names[1]}{extra}"


def _ago(ts: datetime | None) -> str:
    if ts is None:
        return ""
    delta = datetime.now(UTC) - ts
    s = int(delta.total_seconds())
    if s < 60:
        return "now"
    if s < 3600:
        return f"{s // 60}m"
    if s < 86400:
        return f"{s // 3600}h"
    return f"{s // 86400}d"


async def _game_stats() -> tuple[str, bool]:
    """(active-games count, redis_ok)."""
    try:
        return str(await gamestore.active_count()), True
    except Exception:
        # Degrade gracefully, but log with traceback so a real breakage isn't
        # indistinguishable from a normal "Redis down" outage on the card.
        log.exception("widget: active-games count failed")
        return "–", False


async def _db_stats() -> tuple[str, list[dict], bool]:
    """(games started today, recent finished games, db_ok) from telemetry
    Postgres; degrades to placeholders when the stack is off or down."""
    if not TELEMETRY_ENABLED:
        return "–", [], True
    try:
        from server.telemetry import store
        async with store.pool().acquire() as con:
            today = await con.fetchval(
                "SELECT count(*) FROM games WHERE started_ts >= date_trunc('day', now())"
            )
            # Pick the recent games first, then resolve player names for just
            # those codes in a single pass over `events` — a correlated subquery
            # per game row would re-scan the (large) events table LIMIT times on
            # every uncached 5-minute refresh. Name resolution mirrors the
            # canonical `joined` CTE in routes.py's api_game.
            recent = await con.fetch(
                """
                WITH recent AS (
                    SELECT game_code, ended_ts
                      FROM games
                     WHERE ended_ts IS NOT NULL
                     ORDER BY ended_ts DESC
                     LIMIT $1
                ),
                names AS (
                    SELECT DISTINCT ON (e.game_code, e.user_id)
                           e.game_code,
                           COALESCE(u.username, ps.name_last,
                                    e.payload->>'name') AS name
                      FROM events e
                      JOIN recent r ON r.game_code = e.game_code
                      LEFT JOIN users u ON u.id::text = e.user_id
                      LEFT JOIN player_stats ps ON ps.user_id = e.user_id
                     WHERE e.type = 'player_joined'
                     ORDER BY e.game_code, e.user_id, e.ts DESC
                )
                SELECT r.game_code, r.ended_ts,
                       (SELECT json_agg(name ORDER BY name) FROM names n
                         WHERE n.game_code = r.game_code) AS players
                  FROM recent r
                 ORDER BY r.ended_ts DESC
                """,
                RECENT_LIMIT,
            )
        return str(today), [dict(r) for r in recent], True
    except Exception:
        # See _game_stats: log so a schema drift (renamed column, changed
        # payload shape) surfaces instead of silently reading "Stats DB offline".
        log.exception("widget: recent-games query failed")
        return "–", [], False


@router.get("/api/widget")
async def widget_page(key: str = "") -> HTMLResponse:
    if WIDGET_TOKEN is None:
        raise HTTPException(status_code=503, detail="widget disabled")
    # Compare as bytes: secrets.compare_digest raises TypeError (→ 500, not 401)
    # on a non-ASCII str, which a non-ASCII WIDGET_TOKEN + key would trigger.
    if not secrets.compare_digest(key.encode("utf-8"), WIDGET_TOKEN.encode("utf-8")):
        raise HTTPException(status_code=401, detail="unauthorized")

    active, redis_ok = await _game_stats()
    today, recent, db_ok = await _db_stats()
    # Local sockets only — right for the single-instance dev/prod-lite deploys
    # this widget targets; a multi-instance count would need a Redis gauge.
    online = sum(len(peers) for peers in state.connections.values())

    if redis_ok and db_ok:
        health_class, health_text = "ok", "All systems go"
    elif redis_ok:
        health_class, health_text = "warn", "Stats DB offline"
    else:
        health_class, health_text = "down", "Redis down"

    rows = "\n".join(
        _ROW.substitute(
            code=html.escape(g["game_code"]),
            matchup=_matchup(g["players"]),
            ago=_ago(g["ended_ts"]),
        )
        for g in recent
    ) or _EMPTY_ROW

    page = _page_template().substitute(
        refresh=REFRESH_SECONDS,
        css_href=_asset_href(_CSS_URL),
        js_href=_asset_href(_JS_URL),
        logo_href=_asset_href(_LOGO_URL),
        health_class=health_class,
        health_text=health_text,
        active=active,
        online=online,
        today=today,
        rows=rows,
    )
    # no-store: the whole point is fresh numbers every 5-minute refresh, and the
    # keyed URL must never land in a shared cache. no-referrer keeps the ?key=
    # secret out of the Referer header if an external sub-resource is ever added.
    return HTMLResponse(page, headers={
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
    })
