import hashlib
import random
import secrets
import string
import time

from .state import games


def make_reconnect_token() -> tuple[str, str]:
    """Mint an opaque reconnect token; return (raw_token, sha256_hex).

    The raw token is sent only to the owning player. We store the hash on
    the player dict so a leaked game snapshot (which carries pids) can't be
    used to hijack a disconnected slot — reconnect requires the raw token.
    """
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode()).hexdigest()


def verify_token(token_hash: str | None, token: str) -> bool:
    """Constant-time check of a presented reconnect token against its hash."""
    if not token_hash or not token:
        return False
    presented = hashlib.sha256(token.encode()).hexdigest()
    return secrets.compare_digest(presented, token_hash)


def make_code() -> str:
    while True:
        code = "".join(random.choices(string.ascii_uppercase, k=5))
        if code not in games:
            return code


def fresh_dice() -> list[int]:
    return [random.randint(1, 6) for _ in range(10)]


def fresh_player(name: str) -> dict:
    return {
        "name": name,
        "dice": [],
        "locked": [False] * 10,
        "wins": 0,
        "has_rolled": False,
        "last_roll": 0.0,
        "roll_count": 0,
        "disconnected": False,
        "token_hash": None,
    }


def deal_round(game: dict) -> None:
    """Reset every player's dice for a new round and stamp the round start."""
    for p in game["players"].values():
        p["dice"] = fresh_dice()
        p["locked"] = [False] * 10
        p["has_rolled"] = False
        p["last_roll"] = 0.0
        p["roll_count"] = 0
    game["round_start_mono"] = time.monotonic()
    game["round_seq"] = 0


def new_game(host_id: str, host_name: str) -> tuple[str, dict]:
    code = make_code()
    games[code] = {
        "target": 6,
        "round_num": 1,
        "started": False,
        "round_over": False,
        "paused": False,
        "host": host_id,
        "players": {host_id: fresh_player(host_name)},
        # Telemetry bookkeeping — monotonic timers + counters. Consumed by
        # ws.py / broadcast.py when emitting events.
        "created_mono": time.monotonic(),
        "round_start_mono": None,
        "round_seq": 0,
        "total_rolls": 0,
        "round_count": 0,
    }
    return code, games[code]


def next_target(t: int) -> int:
    # cycles 6 → 5 → 4 → 3 → 2 → 1 → 6 → …
    return (t - 2) % 6 + 1


def apply_roll(player: dict, target: int) -> dict:
    """Re-randomise unlocked dice, then lock any matching `target`.

    Returns the per-roll detail dict the roll handler consumes — a single
    source of truth for `matched`, `newly_locked`, and full before/after
    snapshots used for telemetry.
    """
    dice = player["dice"]
    locked = player["locked"]
    dice_before = list(dice)
    locked_before = list(locked)

    rolled_values: list[int] = []
    for i in range(10):
        if not locked[i]:
            dice[i] = random.randint(1, 6)
            rolled_values.append(dice[i])

    newly_locked: list[int] = []
    for i in range(10):
        if dice[i] == target and not locked[i]:
            locked[i] = True
            newly_locked.append(i)

    player["has_rolled"] = True
    player["roll_count"] += 1
    return {
        "matched": sum(locked),
        "newly_locked": newly_locked,
        "rolled_values": rolled_values,
        "dice_before": dice_before,
        "dice_after": list(dice),
        "locked_before": locked_before,
        "locked_after": list(locked),
    }


def state_msg(game: dict, code: str, msg_type: str = "state", **extra) -> dict:
    msg = {
        "type": msg_type,
        "code": code,
        "target": game["target"],
        "round_num": game["round_num"],
        "started": game["started"],
        "paused": game.get("paused", False),
        "host": game["host"],
        "players": {
            pid: {
                "name": p["name"],
                "dice": p["dice"],
                "wins": p["wins"],
                "has_rolled": p.get("has_rolled", False),
                "roll_count": p.get("roll_count", 0),
                "disconnected": p.get("disconnected", False),
            }
            for pid, p in game["players"].items()
        },
        **extra,
    }
    # While paused, hand the host a live countdown to the abandonment cap.
    if game.get("paused") and game.get("pause_deadline_mono") is not None:
        msg["pause_remaining_ms"] = max(
            0, int((game["pause_deadline_mono"] - time.monotonic()) * 1000)
        )
    return msg
