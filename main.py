import asyncio
import json
import logging
import random
import string
import time
import uuid
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tensies")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

import telemetry
from telemetry import metrics
from telemetry.pinger import Pinger


@asynccontextmanager
async def lifespan(app: FastAPI):
    await telemetry.start()
    try:
        yield
    finally:
        await telemetry.stop()


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/metrics")
async def metrics_endpoint():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

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
# id(ws) -> per-connection metadata (counters, session, pinger, …)
ws_meta: dict[int, dict] = {}


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
        "last_roll_ts_ms": None,
        "roll_count": 0,
        "disconnected": False,
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
        "created_mono": time.monotonic(),
        "round_start_mono": None,
        "round_seq": 0,
        "total_rolls": 0,
        "round_count": 0,
    }
    connections[code] = {}
    metrics.games_active.inc()
    metrics.games_started_total.inc()
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
                "disconnected": p.get("disconnected", False),
            }
            for pid, p in game["players"].items()
        },
        **extra,
    }


async def send(ws: WebSocket, msg: dict) -> None:
    """Serialize + send to one ws; updates per-connection and Prometheus counters."""
    data = json.dumps(msg)
    mtype = msg.get("type", "?")
    t0 = time.monotonic()
    try:
        await ws.send_text(data)
    finally:
        metrics.ws_send_seconds.labels(type=mtype).observe(time.monotonic() - t0)
    metrics.ws_messages_out_total.labels(type=mtype).inc()
    metrics.ws_bytes_out_total.inc(len(data))
    metrics.ws_message_size_bytes.observe(len(data))
    meta = ws_meta.get(id(ws))
    if meta is not None:
        meta["msgs_out"] += 1
        meta["bytes_out"] += len(data)


async def broadcast(code: str, message: dict, *, exclude: str | None = None) -> None:
    if code not in connections:
        return
    dead = []
    for pid, ws in list(connections[code].items()):
        if pid == exclude:
            continue
        try:
            await send(ws, message)
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
            metrics.ack_timeouts_total.inc()
            telemetry.emit("ack_timeout", game_code=code, user_id=pid,
                           wait_ms=int(ROLL_ACK_TIMEOUT * 1000))
        finally:
            if player.get("ack_event") is ev:
                player.pop("ack_event", None)

    if code not in games:
        return
    game = games[code]

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
        # End current round
        old_round = game["round_num"]
        old_target = game["target"]
        telemetry.emit("round_ended", game_code=code, round_num=old_round, target=old_target)
        # Advance
        game["target"] = next_target(old_target)
        game["round_num"] += 1
        game["round_over"] = False
        game["round_count"] += 1
        for p in game["players"].values():
            p["dice"] = fresh_dice()
            p["locked"] = [False] * 10
            p["has_rolled"] = False
            p["last_roll"] = 0.0
            p["last_roll_ts_ms"] = None
            p["roll_count"] = 0
        game["round_start_mono"] = time.monotonic()
        game["round_seq"] = 0
        telemetry.emit(
            "round_started",
            game_code=code,
            round_num=game["round_num"],
            target=game["target"],
        )
        metrics.rounds_started_total.labels(target=str(game["target"])).inc()
        await broadcast(code, state_msg(game, code))


async def drop_player(code: str, pid: str) -> None:
    """Remove a disconnected player after the 30-second grace period."""
    await asyncio.sleep(30)
    if code not in games:
        return
    game = games[code]
    player = game["players"].get(pid)
    if player is None or not player.get("disconnected"):
        return  # Already reconnected — nothing to do
    player_name = player["name"]
    del game["players"][pid]
    connections[code].pop(pid, None)
    log.info("drop     game=%s  player=%s  (30s timeout)", code, player_name)
    telemetry.emit("player_left", game_code=code, user_id=pid, name=player_name,
                   reason="drop", player_count=len(game["players"]))
    if not game["players"]:
        log.info("close    game=%s  (all dropped)", code)
        duration_ms = int((time.monotonic() - game["created_mono"]) * 1000)
        telemetry.emit(
            "game_ended", game_code=code, reason="all_dropped",
            duration_ms=duration_ms, round_count=game["round_count"],
            total_rolls=game["total_rolls"],
        )
        metrics.games_active.dec()
        metrics.games_ended_total.labels(reason="all_dropped").inc()
        metrics.game_duration_seconds.observe(duration_ms / 1000.0)
        del games[code]
        connections.pop(code, None)
        return
    if game["host"] == pid:
        new_host = next(iter(game["players"]))
        game["host"] = new_host
        telemetry.emit("host_transferred", game_code=code, **{"from": pid, "to": new_host})
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
    session_id = str(uuid.uuid4())
    peer = f"{ws.client.host}:{ws.client.port}" if ws.client else None
    ua = ws.headers.get("user-agent", "")
    code: str | None = None
    player_name: str = "?"

    # per-connection bookkeeping
    meta = {
        "session_id": session_id,
        "user_id": pid,            # current pid; updated on reconnect
        "name": None,
        "peer": peer,
        "ua": ua,
        "connected_mono": time.monotonic(),
        "msgs_in": 0,
        "msgs_out": 0,
        "bytes_in": 0,
        "bytes_out": 0,
        "rolls": 0,
        "games_joined": 0,
        "session_started_emitted": False,
    }
    ws_meta[id(ws)] = meta

    metrics.ws_connections_active.inc()
    metrics.ws_connects_total.inc()
    telemetry.emit("connection_opened", session_id=session_id, peer=peer, user_agent=ua)

    pinger = Pinger(ws, session_id, lambda m: send(ws, m))
    pinger.start()
    meta["pinger"] = pinger

    await send(ws, {"type": "welcome", "player_id": pid})

    log.info("connect  pid=%s  session=%s", pid[:8], session_id[:8])
    disconnect_reason = "client"

    def _ensure_session_started():
        if meta["session_started_emitted"]:
            return
        meta["session_started_emitted"] = True
        metrics.sessions_started_total.inc()
        telemetry.emit(
            "session_started",
            session_id=session_id,
            user_id=meta["user_id"],
            name=meta["name"],
            peer=peer,
            user_agent=ua,
        )

    try:
        while True:
            text = await ws.receive_text()
            meta["msgs_in"] += 1
            meta["bytes_in"] += len(text)
            metrics.ws_bytes_in_total.inc(len(text))
            t_parse = time.monotonic()
            msg = json.loads(text)
            action = msg.get("action")
            metrics.ws_messages_in_total.labels(action=str(action or "?")).inc()

            if action == "pong":
                pinger.record_pong(float(msg.get("t", 0)))
                continue

            if action == "create":
                name = (msg.get("name") or "Player")[:20].strip() or "Player"
                player_name = name
                meta["name"] = name
                code, game = new_game(pid, name)
                connections[code][pid] = ws
                meta["games_joined"] += 1
                _ensure_session_started()
                log.info("create   game=%s  host=%s", code, name)
                telemetry.emit(
                    "game_created", game_code=code, user_id=pid, name=name,
                    session_id=session_id,
                )
                telemetry.emit(
                    "player_joined", game_code=code, user_id=pid, name=name,
                    session_id=session_id, player_count=1,
                )
                await broadcast(code, state_msg(game, code))

            elif action == "join":
                join_code = (msg.get("code") or "").upper().strip()
                name = (msg.get("name") or "Player")[:20].strip() or "Player"
                player_name = name
                meta["name"] = name
                if join_code not in games:
                    log.info("join     game=%s  player=%s  GAME NOT FOUND", join_code, name)
                    await send(ws, {"type": "error", "msg": "Game not found"})
                    continue
                game = games[join_code]
                if game["started"]:
                    log.info("join     game=%s  player=%s  ALREADY STARTED", join_code, name)
                    await send(ws, {"type": "error", "msg": "Game already in progress"})
                    continue
                code = join_code
                game["players"][pid] = fresh_player(name)
                connections[code][pid] = ws
                meta["games_joined"] += 1
                _ensure_session_started()
                log.info("join     game=%s  player=%s  players=%d", code, name, len(game["players"]))
                telemetry.emit(
                    "player_joined", game_code=code, user_id=pid, name=name,
                    session_id=session_id, player_count=len(game["players"]),
                )
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
                    p["last_roll_ts_ms"] = None
                    p["roll_count"] = 0
                game["round_start_mono"] = time.monotonic()
                game["round_seq"] = 0
                game["round_count"] = 1
                log.info("start    game=%s  players=%d  target=%d", code, len(game["players"]), game["target"])
                metrics.players_per_game.observe(len(game["players"]))
                telemetry.emit(
                    "game_started", game_code=code, target=game["target"],
                    player_count=len(game["players"]),
                )
                telemetry.emit(
                    "round_started", game_code=code, round_num=game["round_num"],
                    target=game["target"],
                )
                metrics.rounds_started_total.labels(target=str(game["target"])).inc()
                await broadcast(code, state_msg(game, code))

            elif action == "reconnect":
                old_pid = msg.get("player_id", "").strip()
                join_code = (msg.get("game_code") or "").upper().strip()
                if (join_code not in games
                        or old_pid not in games[join_code]["players"]
                        or not games[join_code]["players"][old_pid].get("disconnected")):
                    await send(ws, {"type": "error", "msg": "Game not found"})
                    continue
                game = games[join_code]
                player = game["players"][old_pid]
                task = player.pop("disconnect_task", None)
                if task:
                    task.cancel()
                pid = old_pid
                code = join_code
                player_name = player["name"]
                meta["user_id"] = pid
                meta["name"] = player_name
                player["disconnected"] = False
                connections[code][pid] = ws
                _ensure_session_started()
                metrics.reconnects_total.inc()
                telemetry.emit(
                    "reconnected", game_code=code, user_id=pid, name=player_name,
                    session_id=session_id,
                )
                log.info("reconnect  game=%s  player=%s", code, player_name)
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

                now_mono = time.monotonic()
                if now_mono - player["last_roll"] < MIN_ROLL_INTERVAL:
                    log.warning("roll     game=%s  player=%s  RATE LIMIT", code, player_name)
                    metrics.rate_limits_total.inc()
                    telemetry.emit(
                        "rate_limited", game_code=code, user_id=pid,
                        dt_ms=int((now_mono - player["last_roll"]) * 1000),
                    )
                    await send(ws, {"type": "error", "msg": "Slow down"})
                    continue
                prev_last_mono = player["last_roll"]
                player["last_roll"] = now_mono
                now_ms = int(time.time() * 1000)
                dt_ms = (
                    int((now_mono - prev_last_mono) * 1000)
                    if prev_last_mono > 0 else None
                )

                target = game["target"]
                dice = player["dice"]
                locked = player["locked"]
                dice_before = list(dice)
                locked_before = list(locked)

                rolled_values: list[int] = []
                for i in range(10):
                    if not locked[i]:
                        dice[i] = random.randint(1, 6)
                        rolled_values.append(dice[i])
                newly_locked = []
                for i in range(10):
                    if dice[i] == target and not locked[i]:
                        locked[i] = True
                        newly_locked.append(i)

                player["has_rolled"] = True
                player["roll_count"] += 1
                player["last_roll_ts_ms"] = now_ms
                game["total_rolls"] += 1
                game["round_seq"] += 1
                matched = sum(locked)
                new_matches = len(newly_locked)

                metrics.rolls_total.inc()
                metrics.matches_per_roll.observe(new_matches)
                if dt_ms is not None:
                    metrics.time_between_rolls_seconds.observe(dt_ms / 1000.0)
                for v in rolled_values:
                    metrics.dice_value_total.labels(value=str(v)).inc()

                telemetry.emit(
                    "roll",
                    game_code=code,
                    round_num=game["round_num"],
                    user_id=pid,
                    name=player_name,
                    session_id=session_id,
                    seq=game["round_seq"],
                    target=target,
                    matched=matched,
                    new_matches=new_matches,
                    newly_locked=newly_locked,
                    rolled_values=rolled_values,
                    dice_before=dice_before,
                    dice_after=list(dice),
                    locked_before=locked_before,
                    locked_after=list(locked),
                    dt_ms=dt_ms,
                    round_roll_num=player["roll_count"],
                )
                meta["rolls"] += 1

                if matched == 10:
                    game["round_over"] = True
                    player["wins"] += 1
                    round_duration_ms = int(
                        (now_mono - (game.get("round_start_mono") or now_mono)) * 1000
                    )
                    log.info("win      game=%s  player=%s  round=%d  wins=%d",
                             code, player_name, game["round_num"], player["wins"])
                    metrics.rounds_completed_total.labels(target=str(target)).inc()
                    metrics.round_duration_seconds.observe(round_duration_ms / 1000.0)
                    metrics.rolls_per_round.observe(player["roll_count"])
                    metrics.round_winner_rolls.observe(player["roll_count"])
                    telemetry.emit(
                        "round_won",
                        game_code=code,
                        round_num=game["round_num"],
                        user_id=pid,
                        name=player_name,
                        target=target,
                        roll_count=player["roll_count"],
                        duration_ms=round_duration_ms,
                        final_dice=list(dice),
                    )
                    priv = state_msg(game, code, "round_won", winner_name=player["name"])
                    await send(ws, priv)
                    asyncio.create_task(
                        delayed_broadcast(code, pid, True, winner_name=player["name"])
                    )
                else:
                    log.info("roll     game=%s  player=%s  matched=%d/10  target=%d",
                             code, player_name, matched, target)
                    priv = state_msg(game, code)
                    await send(ws, priv)
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
        disconnect_reason = "client"
    except Exception as e:
        disconnect_reason = "error"
        log.exception("ws error pid=%s: %s", pid[:8], e)
    finally:
        log.info("disconnect  pid=%s  player=%s  game=%s", pid[:8], player_name, code or "none")
        pinger.stop()
        duration_ms = int((time.monotonic() - meta["connected_mono"]) * 1000)
        metrics.ws_connections_active.dec()
        metrics.ws_disconnects_total.labels(reason=disconnect_reason).inc()
        metrics.ws_connection_seconds.observe(duration_ms / 1000.0)
        telemetry.emit(
            "connection_closed", session_id=session_id, reason=disconnect_reason,
            duration_ms=duration_ms,
            messages_in=meta["msgs_in"], messages_out=meta["msgs_out"],
            bytes_in=meta["bytes_in"], bytes_out=meta["bytes_out"],
        )
        if meta["session_started_emitted"]:
            telemetry.emit(
                "session_ended", session_id=session_id, user_id=meta["user_id"],
                duration_ms=duration_ms, reason=disconnect_reason,
                rolls=meta["rolls"], games_joined=meta["games_joined"],
            )
        ws_meta.pop(id(ws), None)
        if code and code in games:
            connections[code].pop(pid, None)
            game = games[code]
            player = game["players"].get(pid)
            if player:
                player["disconnected"] = True
                telemetry.emit(
                    "player_left", game_code=code, user_id=pid, name=player_name,
                    reason="disconnect", player_count=len(game["players"]),
                )
                task = asyncio.create_task(drop_player(code, pid))
                player["disconnect_task"] = task
                if connections.get(code):
                    await broadcast(code, state_msg(game, code))
