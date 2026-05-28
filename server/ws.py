import asyncio
import json
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .broadcast import broadcast, delayed_broadcast, drop_player
from .config import MIN_ROLL_INTERVAL, log
from .game import apply_roll, deal_round, fresh_player, new_game, state_msg
from .state import connections, games

router = APIRouter()


class Session:
    """Mutable per-connection state shared between the receive loop and action handlers."""
    __slots__ = ("ws", "pid", "code", "name")

    def __init__(self, ws: WebSocket, pid: str):
        self.ws = ws
        self.pid = pid
        self.code: str | None = None
        self.name: str = "?"


async def _send(ws: WebSocket, message: dict) -> None:
    await ws.send_text(json.dumps(message))


async def _error(ws: WebSocket, msg: str) -> None:
    await _send(ws, {"type": "error", "msg": msg})


async def handle_create(session: Session, msg: dict) -> None:
    name = (msg.get("name") or "Player")[:20].strip() or "Player"
    session.name = name
    code, game = new_game(session.pid, name)
    connections[code] = {session.pid: session.ws}
    session.code = code
    log.info("create   game=%s  host=%s", code, name)
    await broadcast(code, state_msg(game, code))


async def handle_join(session: Session, msg: dict) -> None:
    join_code = (msg.get("code") or "").upper().strip()
    name = (msg.get("name") or "Player")[:20].strip() or "Player"
    session.name = name
    if join_code not in games:
        log.info("join     game=%s  player=%s  GAME NOT FOUND", join_code, name)
        await _error(session.ws, "Game not found")
        return
    game = games[join_code]
    if game["started"]:
        log.info("join     game=%s  player=%s  ALREADY STARTED", join_code, name)
        await _error(session.ws, "Game already in progress")
        return
    session.code = join_code
    game["players"][session.pid] = fresh_player(name)
    connections[join_code][session.pid] = session.ws
    log.info("join     game=%s  player=%s  players=%d", join_code, name, len(game["players"]))
    await broadcast(join_code, state_msg(game, join_code))


async def handle_start(session: Session, msg: dict) -> None:
    code = session.code
    if not code or code not in games:
        return
    game = games[code]
    if game["host"] != session.pid:
        return
    game["started"] = True
    deal_round(game)
    log.info("start    game=%s  players=%d  target=%d", code, len(game["players"]), game["target"])
    await broadcast(code, state_msg(game, code))


async def handle_reconnect(session: Session, msg: dict) -> None:
    old_pid = msg.get("player_id", "").strip()
    join_code = (msg.get("game_code") or "").upper().strip()
    if (join_code not in games
            or old_pid not in games[join_code]["players"]
            or not games[join_code]["players"][old_pid].get("disconnected")):
        await _error(session.ws, "Game not found")
        return
    game = games[join_code]
    player = game["players"][old_pid]
    task = player.pop("disconnect_task", None)
    if task:
        task.cancel()
    session.pid = old_pid
    session.code = join_code
    session.name = player["name"]
    player["disconnected"] = False
    connections[join_code][old_pid] = session.ws
    log.info("reconnect  game=%s  player=%s", join_code, session.name)
    await broadcast(join_code, state_msg(game, join_code))


async def handle_roll(session: Session, msg: dict) -> None:
    code = session.code
    if not code or code not in games:
        return
    game = games[code]
    if not game["started"] or game["round_over"]:
        return
    player = game["players"].get(session.pid)
    if not player:
        return

    now = time.monotonic()
    if now - player["last_roll"] < MIN_ROLL_INTERVAL:
        log.warning("roll     game=%s  player=%s  RATE LIMIT", code, session.name)
        await _error(session.ws, "Slow down")
        return
    player["last_roll"] = now

    matched = apply_roll(player, game["target"])

    if matched == 10:
        game["round_over"] = True
        player["wins"] += 1
        log.info("win      game=%s  player=%s  round=%d  wins=%d",
                 code, session.name, game["round_num"], player["wins"])
        await _send(session.ws, state_msg(game, code, "round_won", winner_name=player["name"]))
        asyncio.create_task(delayed_broadcast(code, session.pid, True, winner_name=player["name"]))
    else:
        log.info("roll     game=%s  player=%s  matched=%d/10  target=%d",
                 code, session.name, matched, game["target"])
        await _send(session.ws, state_msg(game, code))
        asyncio.create_task(delayed_broadcast(code, session.pid, False, None))


async def handle_roll_done(session: Session, msg: dict) -> None:
    code = session.code
    if not code or code not in games:
        return
    player = games[code]["players"].get(session.pid)
    if player is None:
        return
    ev = player.get("ack_event")
    if ev is not None:
        ev.set()


ACTIONS = {
    "create": handle_create,
    "join": handle_join,
    "start": handle_start,
    "reconnect": handle_reconnect,
    "roll": handle_roll,
    "roll_done": handle_roll_done,
}


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    session = Session(ws, str(uuid.uuid4()))
    await _send(ws, {"type": "welcome", "player_id": session.pid})
    log.info("connect  pid=%s", session.pid[:8])

    try:
        while True:
            msg = json.loads(await ws.receive_text())
            handler = ACTIONS.get(msg.get("action"))
            if handler:
                await handler(session, msg)
    except WebSocketDisconnect:
        log.info("disconnect  pid=%s  player=%s  game=%s",
                 session.pid[:8], session.name, session.code or "none")
        code = session.code
        if not code or code not in games:
            return
        connections[code].pop(session.pid, None)
        game = games[code]
        player = game["players"].get(session.pid)
        if player:
            player["disconnected"] = True
            player["disconnect_task"] = asyncio.create_task(drop_player(code, session.pid))
            if connections.get(code):
                await broadcast(code, state_msg(game, code))
