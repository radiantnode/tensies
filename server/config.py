import logging
import os
import socket

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tensies")


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


# Gameplay
MIN_ROLL_INTERVAL = 0.25
ROLL_ACK_TIMEOUT = 2.0
DISCONNECT_GRACE = 60.0
ROUND_WIN_DELAY = 3.0
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
# How long an entry in games:index lives without a refresh — a backstop against
# leaked keys if an instance dies hard. Refreshed on every state mutation.
GAME_TTL = _int("GAME_TTL", 7200)
# Reaper sweep cadence: catches disconnect-drops / pause caps whose owning
# instance vanished mid-countdown (the normal path still fires promptly).
REAP_INTERVAL = _float("REAP_INTERVAL", 15.0)

# ─── Abuse / resource limits (audit H1, L2) ──────────────────────────────
MAX_GAMES = _int("MAX_GAMES", 1000)               # global cap on active games
MAX_PLAYERS_PER_GAME = _int("MAX_PLAYERS_PER_GAME", 20)
MAX_CONNECTIONS_PER_IP = _int("MAX_CONNECTIONS_PER_IP", 30)
CREATE_RATE_MAX = _int("CREATE_RATE_MAX", 10)     # creates per window per IP
CREATE_RATE_WINDOW = _float("CREATE_RATE_WINDOW", 60.0)
JOIN_RATE_MAX = _int("JOIN_RATE_MAX", 60)         # joins per window per IP
JOIN_RATE_WINDOW = _float("JOIN_RATE_WINDOW", 60.0)
MAX_WS_MESSAGE_BYTES = _int("MAX_WS_MESSAGE_BYTES", 4096)  # reject larger frames

# ─── WebSocket origin allowlist (audit M3) ───────────────────────────────
# Comma-separated allowed Origins. "*" disables the check (dev default).
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]

# ─── Endpoint auth (audit M2) ────────────────────────────────────────────
# If set, /metrics and /stats/* require `Authorization: Bearer <token>`.
# Unset (default) leaves them open — rely on a network ACL in that case.
METRICS_TOKEN = os.environ.get("METRICS_TOKEN") or None
STATS_TOKEN = os.environ.get("STATS_TOKEN") or None

# ─── Telemetry ───────────────────────────────────────────────────────────
# Redis is required; the Postgres/Grafana telemetry stack is optional. Set
# TELEMETRY_ENABLED=0 for a lightweight deploy (or local dev / CI) — Prometheus
# /metrics still works in-process; only the Postgres writer + Grafana pusher
# are skipped.
TELEMETRY_ENABLED = _flag("TELEMETRY_ENABLED", True)
POSTGRES_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://tensies:tensies@postgres:5432/tensies"
)
GRAFANA_LIVE_URL = os.environ.get(
    "GRAFANA_LIVE_URL", "http://grafana:3000/api/live/push"
)
GRAFANA_USER = os.environ.get("GRAFANA_USER", "admin")
GRAFANA_PASS = os.environ.get("GRAFANA_PASS", "admin")
PING_INTERVAL = 5.0
