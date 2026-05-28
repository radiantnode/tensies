import random
import string

from .state import games


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
    }


def deal_round(game: dict) -> None:
    """Reset every player's dice for a new round."""
    for p in game["players"].values():
        p["dice"] = fresh_dice()
        p["locked"] = [False] * 10
        p["has_rolled"] = False
        p["last_roll"] = 0.0
        p["roll_count"] = 0


def new_game(host_id: str, host_name: str) -> tuple[str, dict]:
    code = make_code()
    games[code] = {
        "target": 6,
        "round_num": 1,
        "started": False,
        "round_over": False,
        "host": host_id,
        "players": {host_id: fresh_player(host_name)},
    }
    return code, games[code]


def next_target(t: int) -> int:
    # cycles 6 → 5 → 4 → 3 → 2 → 1 → 6 → …
    return (t - 2) % 6 + 1


def apply_roll(player: dict, target: int) -> int:
    """Re-randomise unlocked dice, then lock any matching `target`. Returns matched count."""
    dice = player["dice"]
    locked = player["locked"]
    for i in range(10):
        if not locked[i]:
            dice[i] = random.randint(1, 6)
    for i in range(10):
        if dice[i] == target:
            locked[i] = True
    player["has_rolled"] = True
    player["roll_count"] += 1
    return sum(locked)


def state_msg(game: dict, code: str, msg_type: str = "state", **extra) -> dict:
    return {
        "type": msg_type,
        "code": code,
        "target": game["target"],
        "round_num": game["round_num"],
        "started": game["started"],
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
