import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tensies")

# Gameplay
MIN_ROLL_INTERVAL = 0.25
ROLL_ACK_TIMEOUT = 2.0
DISCONNECT_GRACE = 60.0
ROUND_WIN_DELAY = 3.0

# Telemetry
POSTGRES_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://tensies:tensies@postgres:5432/tensies"
)
GRAFANA_LIVE_URL = os.environ.get(
    "GRAFANA_LIVE_URL", "http://grafana:3000/api/live/push"
)
GRAFANA_USER = os.environ.get("GRAFANA_USER", "admin")
GRAFANA_PASS = os.environ.get("GRAFANA_PASS", "admin")
PING_INTERVAL = 5.0
