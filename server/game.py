import hashlib
import random
import re
import secrets
import time


def make_reconnect_token() -> tuple[str, str]:
    """Mint an opaque reconnect token; return (raw_token, sha256_hex).

    The raw token is sent only to the owning player. We store the hash on
    the player record so a leaked game snapshot (which carries pids) can't be
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


# HTML-significant + control characters. Player names flow into telemetry and
# are rendered on Grafana dashboards (which run with HTML sanitization off), so
# we neutralise markup at intake — defense-in-depth for the stored-XSS path
# (audit M1). The client already renders names via textContent.
_UNSAFE_NAME = re.compile(r"""[<>&"'`\x00-\x1f\x7f]""")


def sanitize_name(raw: str) -> str:
    """Strip markup/control chars, collapse whitespace, cap at 20 chars."""
    cleaned = _UNSAFE_NAME.sub("", raw or "")
    cleaned = " ".join(cleaned.split())
    return cleaned[:20]


def fresh_dice() -> list[int]:
    return [random.randint(1, 6) for _ in range(10)]


def next_target(t: int) -> int:
    # cycles 1 → 2 → 3 → 4 → 5 → 6 → 1 → …
    return t % 6 + 1


def apply_roll(player: dict, target: int, *, dice_values: list[int] | None = None) -> dict:
    """Re-randomise unlocked dice, then lock any matching `target`.

    Pure: mutates the passed-in player dict only. Returns the per-roll detail
    dict the roll handler consumes — a single source of truth for `matched`,
    `newly_locked`, and full before/after snapshots used for telemetry.

    When *dice_values* is provided (drand-derived), those values are used
    instead of random.randint(). The caller supplies at least as many values
    as there are unlocked dice; this function consumes them in order.
    """
    dice = player["dice"]
    locked = player["locked"]
    dice_before = list(dice)
    locked_before = list(locked)

    rolled_values: list[int] = []
    val_idx = 0
    for i in range(10):
        if not locked[i]:
            if dice_values is not None:
                dice[i] = dice_values[val_idx]
                val_idx += 1
            else:
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
    # pause_deadline_ms is wall-clock (cross-instance comparable).
    if game.get("paused") and game.get("pause_deadline_ms") is not None:
        msg["pause_remaining_ms"] = max(
            0, int(game["pause_deadline_ms"] - time.time() * 1000)
        )
    return msg
