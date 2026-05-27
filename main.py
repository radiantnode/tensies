import asyncio
import json
import logging
import random
import string
import time
import uuid

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tensies")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── Cache-busting version string (hash of static assets) ──
import hashlib as _hashlib

def _asset_hash() -> str:
    h = _hashlib.sha1()
    for path in ("static/style.css", "static/game.js"):
        with open(path, "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:8]

_version = _asset_hash()

with open("static/index.html") as _f:
    _index_html = _f.read() \
        .replace("/static/style.css", f"/static/style.css?v={_version}") \
        .replace("/static/game.js",   f"/static/game.js?v={_version}")

# ── Random name generation ──
ADJECTIVES = [
    "Spicy", "Funky", "Sneaky", "Grumpy", "Lazy", "Zippy", "Wobbly",
    "Fluffy", "Cranky", "Salty", "Jumpy", "Wiggly", "Cheeky", "Dizzy",
    "Goofy", "Sassy", "Bouncy", "Zesty", "Grizzly", "Plucky", "Shifty",
    "Jolly", "Gloomy", "Wacky", "Peppy", "Stormy", "Frosty", "Rusty",
    "Dusty", "Shaky", "Lucky", "Spooky", "Fancy", "Rowdy", "Nervy",
]

NOUNS = [
    "Unicorn", "Badger", "Penguin", "Goblin", "Narwhal", "Pickle",
    "Waffle", "Noodle", "Potato", "Biscuit", "Platypus", "Muffin",
    "Cactus", "Blobfish", "Mongoose", "Turnip", "Hamster", "Salamander",
    "Toadstool", "Pretzel", "Walrus", "Capybara", "Burrito", "Otter",
    "Raccoon", "Marmot", "Porcupine", "Kumquat", "Squid", "Yak",
    "Mackerel", "Armadillo", "Chinchilla", "Dumpling", "Puffin",
]


def make_name() -> str:
    return f"{random.choice(ADJECTIVES)} {random.choice(NOUNS)}"


# game_code -> game dict
games: dict[str, dict] = {}
# game_code -> {player_id: WebSocket}
connections: dict[str, dict[str, WebSocket]] = {}


def make_code() -> str:
    while True:
        code = "".join(random.choices(string.ascii_uppercase, k=5))
        if code not in games:
            return code


def fresh_dice() -> list[int]:
    """10 random dice — used for round start (no locking yet)."""
    return [random.randint(1, 6) for _ in range(10)]


MIN_ROLL_INTERVAL = 0.25  # seconds between rolls per player


def fresh_player(name: str) -> dict:
    return {
        "name": name,
        "dice": [],
        "locked": [False] * 10,
        "wins": 0,
        "has_rolled": False,
        "last_roll": 0.0,
        "roll_count": 0,
    }


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
    connections[code] = {}
    return code, games[code]


def next_target(t: int) -> int:
    # cycles 6 → 5 → 4 → 3 → 2 → 1 → 6 → …
    return (t - 2) % 6 + 1


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
            }
            for pid, p in game["players"].items()
        },
        **extra,
    }


async def broadcast(code: str, message: dict, *, exclude: str | None = None) -> None:
    if code not in connections:
        return
    data = json.dumps(message)
    dead = []
    for pid, ws in list(connections[code].items()):
        if pid == exclude:
            continue
        try:
            await ws.send_text(data)
        except Exception:
            dead.append(pid)
    for pid in dead:
        connections[code].pop(pid, None)


# Holds each player's roll broadcast until they've finished animating it (or 2s passes).
# This way other players see the roll at the same time the roller sees their own reveal.
ROLL_ACK_TIMEOUT = 2.0


async def delayed_broadcast(code: str, pid: str, is_win: bool, winner_name: str | None) -> None:
    if code not in games:
        return
    player = games[code]["players"].get(pid)

    if player is not None:
        ev: asyncio.Event = asyncio.Event()
        player["ack_event"] = ev
        try:
            await asyncio.wait_for(ev.wait(), timeout=ROLL_ACK_TIMEOUT)
        except asyncio.TimeoutError:
            log.info("ack_timeout  game=%s  pid=%s", code, pid[:8])
        finally:
            if player.get("ack_event") is ev:
                player.pop("ack_event", None)

    if code not in games:
        return
    game = games[code]

    # Re-snapshot at broadcast time so other concurrent updates are reflected
    if is_win:
        msg = state_msg(game, code, "round_won", winner_name=winner_name or "?")
    else:
        msg = state_msg(game, code)
    await broadcast(code, msg, exclude=pid)

    if is_win:
        await asyncio.sleep(3)
        if code not in games:
            return
        game = games[code]
        target = game["target"]
        game["target"] = next_target(target)
        game["round_num"] += 1
        game["round_over"] = False
        for p in game["players"].values():
            p["dice"] = fresh_dice()
            p["locked"] = [False] * 10
            p["has_rolled"] = False
            p["last_roll"] = 0.0
            p["roll_count"] = 0
        await broadcast(code, state_msg(game, code))


@app.get("/")
async def root():
    return HTMLResponse(_index_html)


@app.get("/random-name")
async def random_name():
    return {"name": make_name()}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    pid = str(uuid.uuid4())
    await ws.send_text(json.dumps({"type": "welcome", "player_id": pid}))
    code: str | None = None
    player_name: str = "?"

    log.info("connect  pid=%s", pid[:8])

    try:
        while True:
            msg = json.loads(await ws.receive_text())
            action = msg.get("action")

            if action == "create":
                name = (msg.get("name") or "Player")[:20].strip() or "Player"
                player_name = name
                code, game = new_game(pid, name)
                connections[code][pid] = ws
                log.info("create   game=%s  host=%s", code, name)
                await broadcast(code, state_msg(game, code))

            elif action == "join":
                join_code = (msg.get("code") or "").upper().strip()
                name = (msg.get("name") or "Player")[:20].strip() or "Player"
                player_name = name
                if join_code not in games:
                    log.info("join     game=%s  player=%s  GAME NOT FOUND", join_code, name)
                    await ws.send_text(json.dumps({"type": "error", "msg": "Game not found"}))
                    continue
                game = games[join_code]
                if game["started"]:
                    log.info("join     game=%s  player=%s  ALREADY STARTED", join_code, name)
                    await ws.send_text(json.dumps({"type": "error", "msg": "Game already in progress"}))
                    continue
                code = join_code
                game["players"][pid] = fresh_player(name)
                connections[code][pid] = ws
                log.info("join     game=%s  player=%s  players=%d", code, name, len(game["players"]))
                await broadcast(code, state_msg(game, code))

            elif action == "start":
                if not code or code not in games:
                    continue
                game = games[code]
                if game["host"] != pid:
                    continue
                game["started"] = True
                for p in game["players"].values():
                    p["dice"] = fresh_dice()
                    p["locked"] = [False] * 10
                    p["has_rolled"] = False
                    p["last_roll"] = 0.0
                    p["roll_count"] = 0
                log.info("start    game=%s  players=%d  target=%d", code, len(game["players"]), game["target"])
                await broadcast(code, state_msg(game, code))

            elif action == "roll":
                if not code or code not in games:
                    continue
                game = games[code]
                if not game["started"] or game["round_over"]:
                    continue
                player = game["players"].get(pid)
                if not player:
                    continue

                now = time.monotonic()
                if now - player["last_roll"] < MIN_ROLL_INTERVAL:
                    log.warning("roll     game=%s  player=%s  RATE LIMIT", code, player_name)
                    await ws.send_text(json.dumps({"type": "error", "msg": "Slow down"}))
                    continue
                player["last_roll"] = now

                target = game["target"]
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
                matched = sum(locked)

                # Send the result to the roller immediately so their reveal can run;
                # delayed_broadcast then publishes to the rest of the room once the
                # roller's animation completes (or a 2s timeout fires).
                if matched == 10:
                    game["round_over"] = True
                    player["wins"] += 1
                    log.info("win      game=%s  player=%s  round=%d  wins=%d",
                             code, player_name, game["round_num"], player["wins"])
                    priv = state_msg(game, code, "round_won", winner_name=player["name"])
                    await ws.send_text(json.dumps(priv))
                    asyncio.create_task(
                        delayed_broadcast(code, pid, True, winner_name=player["name"])
                    )
                else:
                    log.info("roll     game=%s  player=%s  matched=%d/10  target=%d",
                             code, player_name, matched, target)
                    priv = state_msg(game, code)
                    await ws.send_text(json.dumps(priv))
                    asyncio.create_task(delayed_broadcast(code, pid, False, None))

            elif action == "roll_done":
                if not code or code not in games:
                    continue
                player = games[code]["players"].get(pid)
                if player is None:
                    continue
                ev = player.get("ack_event")
                if ev is not None:
                    ev.set()

    except WebSocketDisconnect:
        log.info("disconnect  pid=%s  player=%s  game=%s", pid[:8], player_name, code or "none")
        if code and code in games:
            connections[code].pop(pid, None)
            game = games[code]
            game["players"].pop(pid, None)
            if not game["players"]:
                log.info("close    game=%s  (empty)", code)
                del games[code]
                connections.pop(code, None)
            else:
                if game["host"] == pid:
                    game["host"] = next(iter(game["players"]))
                await broadcast(code, state_msg(game, code))
