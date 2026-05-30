import asyncio
import json
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .broadcast import broadcast, delayed_broadcast, drop_player, send
from .config import MIN_ROLL_INTERVAL, log
from .game import (
    apply_roll,
    deal_round,
    fresh_player,
    make_reconnect_token,
    new_game,
    state_msg,
    verify_token,
)
from .state import connections, games, sessions
from .telemetry import emit, metrics
from .telemetry.pinger import Pinger

router = APIRouter()


class Session:
    """Mutable per-connection state shared between the receive loop and action handlers."""
    __slots__ = (
        "ws", "pid", "code", "name",
        # Telemetry meta — populated on connect, used by send() and the
        # disconnect finally block to attribute counters and emit lifecycle
        # events. Cheap (one allocation per WS), no global maps required.
        "session_id", "peer", "user_agent",
        "connected_mono",
        "msgs_in", "msgs_out", "bytes_in", "bytes_out",
        "rolls", "games_joined",
        "session_started_emitted",
        "send_lock", "pinger",
    )

    def __init__(self, ws: WebSocket, pid: str):
        self.ws = ws
        self.pid = pid
        self.code: str | None = None
        self.name: str = "?"
        self.session_id = str(uuid.uuid4())
        self.peer = f"{ws.client.host}:{ws.client.port}" if ws.client else None
        self.user_agent = ws.headers.get("user-agent", "")
        self.connected_mono = time.monotonic()
        self.msgs_in = 0
        self.msgs_out = 0
        self.bytes_in = 0
        self.bytes_out = 0
        self.rolls = 0
        self.games_joined = 0
        self.session_started_emitted = False
        self.send_lock = asyncio.Lock()
        self.pinger: Pinger | None = None


async def _error(ws: WebSocket, msg: str) -> None:
    await send(ws, {"type": "error", "msg": msg})


def _ensure_session_started(session: Session) -> None:
    """Emit session_started once per WS, on the first action that names a user."""
    if session.session_started_emitted:
        return
    session.session_started_emitted = True
    metrics.sessions_started_total.inc()
    emit("session_started",
         session_id=session.session_id, user_id=session.pid, name=session.name,
         peer=session.peer, user_agent=session.user_agent)


async def handle_create(session: Session, msg: dict) -> None:
    name = (msg.get("name") or "Player")[:20].strip() or "Player"
    session.name = name
    code, game = new_game(session.pid, name)
    token, token_hash = make_reconnect_token()
    game["players"][session.pid]["token_hash"] = token_hash
    connections[code] = {session.pid: session.ws}
    session.code = code
    session.games_joined += 1
    _ensure_session_started(session)
    metrics.games_active.inc()
    log.info("create   game=%s  host=%s", code, name)
    emit("game_created", game_code=code, user_id=session.pid, name=name,
         session_id=session.session_id)
    emit("player_joined", game_code=code, user_id=session.pid, name=name,
         session_id=session.session_id, player_count=1)
    await send(session.ws, {"type": "reconnect_token", "token": token})
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
    token, token_hash = make_reconnect_token()
    game["players"][session.pid] = fresh_player(name)
    game["players"][session.pid]["token_hash"] = token_hash
    connections[join_code][session.pid] = session.ws
    session.games_joined += 1
    _ensure_session_started(session)
    log.info("join     game=%s  player=%s  players=%d", join_code, name, len(game["players"]))
    emit("player_joined", game_code=join_code, user_id=session.pid, name=name,
         session_id=session.session_id, player_count=len(game["players"]))
    await send(session.ws, {"type": "reconnect_token", "token": token})
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
    game["round_count"] = 1
    log.info("start    game=%s  players=%d  target=%d", code, len(game["players"]), game["target"])
    metrics.games_started_total.inc()
    metrics.players_per_game.observe(len(game["players"]))
    metrics.rounds_started_total.labels(target=str(game["target"])).inc()
    emit("game_started", game_code=code, target=game["target"],
         player_count=len(game["players"]))
    emit("round_started", game_code=code, round_num=game["round_num"],
         target=game["target"])
    await broadcast(code, state_msg(game, code))


async def handle_reconnect(session: Session, msg: dict) -> None:
    old_pid = msg.get("player_id", "").strip()
    join_code = (msg.get("game_code") or "").upper().strip()
    token = msg.get("token", "")
    game = games.get(join_code)
    player = game["players"].get(old_pid) if game else None
    # A leaked snapshot reveals every pid + the host pid, so pid alone can't
    # be the credential. Require the private reconnect token (constant-time
    # compared) and that the slot is actually awaiting reconnect.
    if (player is None
            or not player.get("disconnected")
            or not verify_token(player.get("token_hash"), token)):
        await _error(session.ws, "Game not found")
        return
    task = player.pop("disconnect_task", None)
    if task:
        task.cancel()
    session.pid = old_pid
    session.code = join_code
    session.name = player["name"]
    player["disconnected"] = False
    connections[join_code][old_pid] = session.ws
    _ensure_session_started(session)
    metrics.reconnects_total.inc()
    log.info("reconnect  game=%s  player=%s", join_code, session.name)
    emit("reconnected", game_code=join_code, user_id=session.pid,
         name=session.name, session_id=session.session_id)
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

    now_mono = time.monotonic()
    if now_mono - player["last_roll"] < MIN_ROLL_INTERVAL:
        log.warning("roll     game=%s  player=%s  RATE LIMIT", code, session.name)
        metrics.rate_limits_total.inc()
        emit("rate_limited", game_code=code, user_id=session.pid,
             dt_ms=int((now_mono - player["last_roll"]) * 1000))
        await _error(session.ws, "Slow down")
        return
    prev_last_mono = player["last_roll"]
    player["last_roll"] = now_mono
    dt_ms = int((now_mono - prev_last_mono) * 1000) if prev_last_mono > 0 else None

    target = game["target"]
    result = apply_roll(player, target)
    matched = result["matched"]
    game["total_rolls"] += 1
    game["round_seq"] += 1
    session.rolls += 1

    metrics.rolls_total.inc()
    metrics.matches_per_roll.observe(len(result["newly_locked"]))
    if dt_ms is not None:
        metrics.time_between_rolls_seconds.observe(dt_ms / 1000.0)
    for v in result["rolled_values"]:
        metrics.dice_value_total.labels(value=str(v)).inc()

    emit("roll",
         game_code=code, round_num=game["round_num"], user_id=session.pid,
         session_id=session.session_id, name=session.name,
         seq=game["round_seq"],
         target=target,
         matched=matched,
         dt_ms=dt_ms,
         round_roll_num=player["roll_count"],
         newly_locked=result["newly_locked"],
         rolled_values=result["rolled_values"],
         dice_before=result["dice_before"],
         dice_after=result["dice_after"],
         locked_before=result["locked_before"],
         locked_after=result["locked_after"])

    if matched == 10:
        game["round_over"] = True
        player["wins"] += 1
        round_duration_ms = int(
            (now_mono - (game.get("round_start_mono") or now_mono)) * 1000
        )
        log.info("win      game=%s  player=%s  round=%d  wins=%d",
                 code, session.name, game["round_num"], player["wins"])
        metrics.rounds_completed_total.labels(target=str(target)).inc()
        metrics.round_duration_seconds.observe(round_duration_ms / 1000.0)
        metrics.rolls_per_round.observe(player["roll_count"])
        metrics.round_winner_rolls.observe(player["roll_count"])
        emit("round_won",
             game_code=code, round_num=game["round_num"], user_id=session.pid,
             name=session.name, target=target,
             roll_count=player["roll_count"],
             duration_ms=round_duration_ms,
             final_dice=list(player["dice"]))
        await send(session.ws, state_msg(game, code, "round_won", winner_name=player["name"]))
        asyncio.create_task(delayed_broadcast(code, session.pid, True, winner_name=player["name"]))
    else:
        log.info("roll     game=%s  player=%s  matched=%d/10  target=%d",
                 code, session.name, matched, game["target"])
        await send(session.ws, state_msg(game, code))
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


async def handle_pong(session: Session, msg: dict) -> None:
    if session.pinger is not None:
        session.pinger.record_pong()


ACTIONS = {
    "create": handle_create,
    "join": handle_join,
    "start": handle_start,
    "reconnect": handle_reconnect,
    "roll": handle_roll,
    "roll_done": handle_roll_done,
    "pong": handle_pong,
}


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    session = Session(ws, str(uuid.uuid4()))
    sessions[id(ws)] = session

    metrics.ws_connections_active.inc()
    metrics.ws_connects_total.inc()
    emit("connection_opened",
         session_id=session.session_id, peer=session.peer,
         user_agent=session.user_agent)

    # Pinger: routes through send() so its frames respect the per-session
    # send_lock and get counted in the outbound metrics.
    session.pinger = Pinger(session.session_id, lambda m: send(ws, m))
    session.pinger.start()

    await send(ws, {"type": "welcome", "player_id": session.pid})
    log.info("connect  pid=%s  session=%s", session.pid[:8], session.session_id[:8])

    disconnect_reason = "client"
    try:
        while True:
            text = await ws.receive_text()
            session.msgs_in += 1
            session.bytes_in += len(text)
            metrics.ws_bytes_in_total.inc(len(text))
            msg = json.loads(text)
            action = msg.get("action")
            metrics.ws_messages_in_total.labels(action=str(action or "?")).inc()
            handler = ACTIONS.get(action)
            if handler:
                await handler(session, msg)
    except WebSocketDisconnect:
        disconnect_reason = "client"
    except Exception:
        disconnect_reason = "error"
        log.exception("ws error pid=%s", session.pid[:8])
    finally:
        log.info("disconnect  pid=%s  player=%s  game=%s",
                 session.pid[:8], session.name, session.code or "none")
        if session.pinger is not None:
            session.pinger.stop()

        duration_ms = int((time.monotonic() - session.connected_mono) * 1000)
        metrics.ws_connections_active.dec()
        metrics.ws_disconnects_total.labels(reason=disconnect_reason).inc()
        metrics.ws_connection_seconds.observe(duration_ms / 1000.0)
        emit("connection_closed",
             session_id=session.session_id, reason=disconnect_reason,
             duration_ms=duration_ms,
             messages_in=session.msgs_in, messages_out=session.msgs_out,
             bytes_in=session.bytes_in, bytes_out=session.bytes_out)
        if session.session_started_emitted:
            emit("session_ended",
                 session_id=session.session_id, user_id=session.pid,
                 duration_ms=duration_ms, reason=disconnect_reason,
                 rolls=session.rolls, games_joined=session.games_joined)

        sessions.pop(id(ws), None)

        code = session.code
        if code and code in games:
            connections[code].pop(session.pid, None)
            game = games[code]
            player = game["players"].get(session.pid)
            if player:
                player["disconnected"] = True
                emit("player_left", game_code=code, user_id=session.pid,
                     name=session.name, reason="disconnect",
                     player_count=len(game["players"]))
                player["disconnect_task"] = asyncio.create_task(
                    drop_player(code, session.pid)
                )
                if connections.get(code):
                    await broadcast(code, state_msg(game, code))
