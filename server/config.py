import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tensies")

MIN_ROLL_INTERVAL = 0.25
ROLL_ACK_TIMEOUT = 2.0
DISCONNECT_GRACE = 30.0
ROUND_WIN_DELAY = 3.0
