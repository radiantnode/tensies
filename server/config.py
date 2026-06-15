"""Central configuration.

Plain constants plus environment-driven settings, grouped by concern. Values are
read once at import via the small `_flag`/`_int`/`_float` helpers (each falls back
to the given default when the env var is unset or unparseable).
"""
import logging
import os
import socket


# ─── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tensies")


# ─── Environment helpers ─────────────────────────────────────────────────
def _flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() not in ("0", "false", "no", "off", "")


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _list(name: str) -> list[str]:
    """Parse a space- or comma-separated env var into a list (empty when unset)."""
    raw = os.environ.get(name, "")
    return [item for item in raw.replace(",", " ").split() if item]


# ─── Gameplay ────────────────────────────────────────────────────────────
MIN_ROLL_INTERVAL = 0.25     # min seconds between a player's rolls (rate limit)
ROLL_ACK_TIMEOUT = 2.0       # wait for the roller's reveal ack before broadcasting
DISCONNECT_GRACE = 60.0      # seconds a dropped player's slot is held for reconnect
ROUND_WIN_DELAY = 3.0        # winner overlay hold before advancing the round

# A paused game is held open (players are never dropped) for at most this long,
# so the host can put their phone down and come back. Past it, the game is
# assumed abandoned and ended.
PAUSE_MAX = 3600.0


# ─── Shared state (Redis) ────────────────────────────────────────────────
# Game state and cross-instance fan-out live in Redis so the app can run as
# multiple instances behind a plain round-robin load balancer. REQUIRED.
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Identifies this instance in logs / ownership bookkeeping.
INSTANCE_ID = os.environ.get("INSTANCE_ID") or socket.gethostname()

# TTL on a game's keys without a refresh — a backstop against leaked keys if an
# instance dies hard. Refreshed on every state mutation.
GAME_TTL = _int("GAME_TTL", 7200)

# Reaper sweep cadence: catches disconnect-drops / pause caps whose owning
# instance vanished mid-countdown (the normal path still fires promptly).
REAP_INTERVAL = _float("REAP_INTERVAL", 15.0)


# ─── Abuse / resource limits (audit H1, L2) ──────────────────────────────
MAX_GAMES = _int("MAX_GAMES", 1000)                       # global active-game cap
MAX_PLAYERS_PER_GAME = _int("MAX_PLAYERS_PER_GAME", 20)
MAX_CONNECTIONS_PER_IP = _int("MAX_CONNECTIONS_PER_IP", 30)
MAX_WS_MESSAGE_BYTES = _int("MAX_WS_MESSAGE_BYTES", 4096)  # reject larger frames

CREATE_RATE_MAX = _int("CREATE_RATE_MAX", 10)             # creates per window per IP
CREATE_RATE_WINDOW = _float("CREATE_RATE_WINDOW", 60.0)
JOIN_RATE_MAX = _int("JOIN_RATE_MAX", 60)                 # joins per window per IP
JOIN_RATE_WINDOW = _float("JOIN_RATE_WINDOW", 60.0)


# ─── WebSocket origin allowlist (audit M3) ───────────────────────────────
# Comma-separated allowed Origins. "*" disables the check (dev default).
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]


# ─── Real client IP behind a proxy (audit H1) ────────────────────────────
# Behind a TLS-terminating reverse proxy / load balancer the transport peer is
# the proxy, not the user, so the per-IP cap + rate limits must read the real
# client from X-Forwarded-For. Enable ONLY when a trusted proxy sits in front
# (otherwise XFF is client-spoofable).
TRUST_PROXY_HEADERS = _flag("TRUST_PROXY_HEADERS", False)

# Number of trusted proxies that append to X-Forwarded-For. The real client is
# taken this many entries from the right, so client-supplied (left) values are
# ignored. Default 1 = a single LB you control.
TRUSTED_PROXY_HOPS = _int("TRUSTED_PROXY_HOPS", 1)


# ─── Endpoint auth (audit M2) ────────────────────────────────────────────
# When set, /metrics and /stats/* require `Authorization: Bearer <token>`.
# Unset leaves them open — both compose files set tokens so dev and prod are
# authenticated; routes.py logs a warning when either is left unset.
METRICS_TOKEN = os.environ.get("METRICS_TOKEN") or None
STATS_TOKEN = os.environ.get("STATS_TOKEN") or None


# ─── Frontend asset serving ──────────────────────────────────────────────
# In prod the frontend is bundled + fingerprinted into a static dist/ at
# image-build time (scripts/build_assets.mjs) and served straight from disk by
# nginx. When FRONTEND_DIST points at that directory the app does ZERO asset
# work: it skips the in-process JS cache + StaticFiles mount and serves only the
# prebuilt dist/index.html document (nginx owns everything under /static).
# Unset (dev): the app serves the raw, unbundled ES modules itself so the
# edit-and-reload loop needs no build step.
FRONTEND_DIST = os.environ.get("FRONTEND_DIST", "").strip()

# Public origin the app is served from (e.g. https://tensies.app). When set, the
# served index.html gets an ABSOLUTE og:image/twitter:image so iOS LinkPresentation
# (which fetches the join URL without running JS and wants absolute URLs) can show
# the share-sheet preview. Unset (dev/preview): the image stays relative.
APP_URL = os.environ.get("APP_URL", "").strip().rstrip("/")


# ─── Security response headers: HSTS + CSP (audit L4) ────────────────────
# Master switch for the Content-Security-Policy header. On by default — the
# frontend has no inline scripts/styles, so a strict CSP applies with no
# exceptions and doubles as a regression tripwire in dev.
SECURITY_HEADERS = _flag("SECURITY_HEADERS", True)

# Optional full CSP override for advanced operators (e.g. adding a CDN). When
# unset, a strict same-origin policy is built in server/security.py.
CSP_OVERRIDE = os.environ.get("CONTENT_SECURITY_POLICY") or None

# Append extra sources to individual CSP directives without rewriting the whole
# policy. Each is a space- or comma-separated host list. Example: a Cloudflare
# Web Analytics beacon needs its script host on script-src and its collector on
# connect-src (CSP_EXTRA_SCRIPT_SRC="https://static.cloudflareinsights.com",
# CSP_EXTRA_CONNECT_SRC="https://cloudflareinsights.com"). Ignored when the full
# CONTENT_SECURITY_POLICY override above is set.
CSP_EXTRA_SCRIPT_SRC = _list("CSP_EXTRA_SCRIPT_SRC")
CSP_EXTRA_CONNECT_SRC = _list("CSP_EXTRA_CONNECT_SRC")
CSP_EXTRA_IMG_SRC = _list("CSP_EXTRA_IMG_SRC")

# HSTS is only honoured by browsers over HTTPS, so it's off by default (plain
# http dev) and turned on in docker-compose.prod.yml. Enabling it also adds
# `upgrade-insecure-requests` to the CSP.
HSTS_ENABLED = _flag("HSTS_ENABLED", False)
HSTS_MAX_AGE = _int("HSTS_MAX_AGE", 63072000)             # 2 years
HSTS_INCLUDE_SUBDOMAINS = _flag("HSTS_INCLUDE_SUBDOMAINS", False)
HSTS_PRELOAD = _flag("HSTS_PRELOAD", False)


# ─── Telemetry (optional Postgres/Grafana stack) ─────────────────────────
# Redis is required; the telemetry stack is not. Set TELEMETRY_ENABLED=0 for a
# lightweight deploy (or local dev / CI) — Prometheus /metrics still works
# in-process; only the Postgres writer + Grafana pusher are skipped.
TELEMETRY_ENABLED = _flag("TELEMETRY_ENABLED", True)

POSTGRES_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://tensies:tensies@postgres:5432/tensies"
)
GRAFANA_LIVE_URL = os.environ.get(
    "GRAFANA_LIVE_URL", "http://grafana:3000/api/live/push"
)
GRAFANA_USER = os.environ.get("GRAFANA_USER", "admin")
GRAFANA_PASS = os.environ.get("GRAFANA_PASS", "admin")

PING_INTERVAL = 5.0          # seconds between server→client WS pings


# ─── WebAuthn / user accounts ─────────────────────────────────────────
WEBAUTHN_RP_ID = os.environ.get("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_RP_NAME = os.environ.get("WEBAUTHN_RP_NAME", "Tensies")
WEBAUTHN_ORIGIN = [
    o.strip()
    for o in os.environ.get("WEBAUTHN_ORIGIN", APP_URL or "http://localhost:8888").split(",")
    if o.strip()
]
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-prod")
JWT_EXPIRY_DAYS = _int("JWT_EXPIRY_DAYS", 30)
