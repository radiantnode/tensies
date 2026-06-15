import asyncio
import json
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import jwt as pyjwt

from . import gamestore, state
from .broadcast import advance_round, broadcast, delayed_broadcast, drop_player, pause_timeout, send
from .config import (
    JWT_SECRET,
    ALLOWED_ORIGINS,
    CREATE_RATE_MAX,
    CREATE_RATE_WINDOW,
    JOIN_RATE_MAX,
    JOIN_RATE_WINDOW,
    MAX_CONNECTIONS_PER_IP,
    MAX_WS_MESSAGE_BYTES,
    MIN_ROLL_INTERVAL,
    PAUSE_MAX,
    TRUST_PROXY_HEADERS,
    TRUSTED_PROXY_HOPS,
    log,
)
from .game import apply_roll, make_reconnect_token, sanitize_name, state_msg, verify_token
from .state import connections, sessions
from .telemetry import emit, metrics
from .telemetry.pinger import Pinger

router = APIRouter()


class Session:
    """Mutable per-connection state shared between the receive loop and action handlers."""
    __slots__ = (
        "ws", "pid", "code", "name", "ip",
        # Authenticated account (set by handle_auth if the client sends a JWT).
        "user_id", "username",
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
        self.ip: str = _client_ip(ws)
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
        self.user_id: str | None = None
        self.username: str | None = None
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


async def handle_auth(session: Session, msg: dict) -> None:
    """Authenticate the WS session with a JWT from the passkey auth flow."""
    token = msg.get("token", "")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        session.user_id = payload.get("sub")
        session.username = payload.get("username")
        await send(session.ws, {
            "type": "auth_ok",
            "username": session.username,
            "user_id": session.user_id,
        })
        log.info("auth     pid=%s  user=%s", session.pid[:8], session.username)
    except pyjwt.InvalidTokenError:
        await _error(session.ws, "Invalid auth token")


async def handle_create(session: Session, msg: dict) -> None:
    # Signed-in users use their account username as the player name.
    raw_name = session.username or msg.get("name") or "Player"
    name = sanitize_name(raw_name) or "Player"
    session.name = name
    if not await gamestore.rate_allow("create", session.ip, CREATE_RATE_MAX, CREATE_RATE_WINDOW):
        log.warning("create   ip=%s  RATE LIMIT", session.ip)
        metrics.rate_limits_total.inc()
        await _error(session.ws, "Too many games created — slow down")
        return
    token, token_hash = make_reconnect_token()
    code = await gamestore.create_game(session.pid, name, token_hash)
    if code is None:
        await _error(session.ws, "Server is at capacity — try again shortly")
        return
    connections[code] = {session.pid: session.ws}
    session.code = code
    session.games_joined += 1
    _ensure_session_started(session)
    log.info("create   game=%s  host=%s", code, name)
    emit("game_created", game_code=code, user_id=session.pid, name=name,
         session_id=session.session_id)
    emit("player_joined", game_code=code, user_id=session.pid, name=name,
         session_id=session.session_id, player_count=1)
    await send(session.ws, {"type": "reconnect_token", "token": token})
    snap = await gamestore.snapshot(code)
    if snap:
        await broadcast(code, state_msg(snap, code))


async def handle_join(session: Session, msg: dict) -> None:
    join_code = (msg.get("code") or "").upper().strip()
    raw_name = session.username or msg.get("name") or "Player"
    name = sanitize_name(raw_name) or "Player"
    session.name = name
    if not await gamestore.rate_allow("join", session.ip, JOIN_RATE_MAX, JOIN_RATE_WINDOW):
        log.warning("join     ip=%s  RATE LIMIT", session.ip)
        metrics.rate_limits_total.inc()
        await _error(session.ws, "Too many attempts — slow down")
        return
    token, token_hash = make_reconnect_token()
    res = await gamestore.add_player(join_code, session.pid, name, token_hash)
    if res == -1:
        log.info("join     game=%s  player=%s  GAME NOT FOUND", join_code, name)
        await _error(session.ws, "Game not found")
        return
    if res == -2:
        log.info("join     game=%s  player=%s  ALREADY STARTED", join_code, name)
        await _error(session.ws, "Game already in progress")
        return
    if res == -3:
        log.info("join     game=%s  player=%s  FULL", join_code, name)
        await _error(session.ws, "Game is full")
        return
    session.code = join_code
    connections.setdefault(join_code, {})[session.pid] = session.ws
    session.games_joined += 1
    _ensure_session_started(session)
    log.info("join     game=%s  player=%s  players=%d", join_code, name, res)
    emit("player_joined", game_code=join_code, user_id=session.pid, name=name,
         session_id=session.session_id, player_count=res)
    await send(session.ws, {"type": "reconnect_token", "token": token})
    snap = await gamestore.snapshot(join_code)
    if snap:
        await broadcast(join_code, state_msg(snap, join_code))


async def handle_start(session: Session, msg: dict) -> None:
    code = session.code
    if not code:
        return
    meta = await gamestore.get_meta(code)
    if meta is None or meta["host"] != session.pid or meta["started"]:
        return
    await gamestore.start_game(code)
    snap = await gamestore.snapshot(code)
    if snap is None:
        return
    pc = len(snap["players"])
    log.info("start    game=%s  players=%d  target=%d", code, pc, snap["target"])
    metrics.games_started_total.inc()
    metrics.players_per_game.observe(pc)
    metrics.rounds_started_total.labels(target=str(snap["target"])).inc()
    emit("game_started", game_code=code, target=snap["target"], player_count=pc)
    emit("round_started", game_code=code, round_num=snap["round_num"],
         target=snap["target"])
    await broadcast(code, state_msg(snap, code))


async def handle_reconnect(session: Session, msg: dict) -> None:
    old_pid = msg.get("player_id", "").strip()
    join_code = (msg.get("game_code") or "").upper().strip()
    token = msg.get("token", "")
    player = await gamestore.get_player(join_code, old_pid)
    # A leaked snapshot reveals every pid + the host pid, so pid alone can't
    # be the credential. Require the private reconnect token (constant-time
    # compared) and that the slot is actually awaiting reconnect.
    if (player is None
            or not player.get("disconnected")
            or not verify_token(player.get("token_hash"), token)):
        await _error(session.ws, "Game not found")
        return
    # Cancel a local grace task if this instance owns it. If the task lives on
    # another instance, mark_connected below makes its drop a no-op anyway.
    t = state.drop_tasks.pop((join_code, old_pid), None)
    if t:
        t.cancel()
    session.pid = old_pid
    session.code = join_code
    session.name = player["name"]
    await gamestore.mark_connected(join_code, old_pid)
    connections.setdefault(join_code, {})[old_pid] = session.ws
    _ensure_session_started(session)
    metrics.reconnects_total.inc()
    log.info("reconnect  game=%s  player=%s", join_code, session.name)
    emit("reconnected", game_code=join_code, user_id=session.pid,
         name=session.name, session_id=session.session_id)
    snap = await gamestore.snapshot(join_code)
    if snap:
        await broadcast(join_code, state_msg(snap, join_code))


async def handle_roll(session: Session, msg: dict) -> None:
    code = session.code
    if not code:
        return
    meta = await gamestore.get_meta(code)
    if meta is None or not meta["started"] or meta["round_over"]:
        return
    if meta["paused"]:
        await _error(session.ws, "Game is paused")
        return
    player = await gamestore.get_player(code, session.pid)
    if not player:
        return

    now_ms = gamestore.now_ms()
    last_ms = player["last_roll_ms"] or 0
    if last_ms and (now_ms - last_ms) < MIN_ROLL_INTERVAL * 1000:
        log.warning("roll     game=%s  player=%s  RATE LIMIT", code, session.name)
        metrics.rate_limits_total.inc()
        emit("rate_limited", game_code=code, user_id=session.pid,
             dt_ms=now_ms - last_ms)
        await _error(session.ws, "Slow down")
        return
    dt_ms = (now_ms - last_ms) if last_ms else None

    target = meta["target"]
    # apply_roll mutates this local copy; only this player ever writes these
    # fields, so the write-back never contends with other rollers.
    p = {
        "dice": player["dice"],
        "locked": player["locked"],
        "has_rolled": player["has_rolled"],
        "roll_count": player["roll_count"],
    }
    result = apply_roll(p, target)
    matched = result["matched"]
    await gamestore.set_player_after_roll(
        code, session.pid, dice=p["dice"], locked=p["locked"],
        roll_count=p["roll_count"], last_roll_ms=now_ms,
    )
    total_rolls, round_seq = await gamestore.incr_counters(code)
    session.rolls += 1

    metrics.rolls_total.inc()
    metrics.matches_per_roll.observe(len(result["newly_locked"]))
    if dt_ms is not None:
        metrics.time_between_rolls_seconds.observe(dt_ms / 1000.0)
    for v in result["rolled_values"]:
        metrics.dice_value_total.labels(value=str(v)).inc()

    emit("roll",
         game_code=code, round_num=meta["round_num"], user_id=session.pid,
         session_id=session.session_id, name=session.name,
         seq=round_seq,
         target=target,
         matched=matched,
         dt_ms=dt_ms,
         round_roll_num=p["roll_count"],
         newly_locked=result["newly_locked"],
         rolled_values=result["rolled_values"],
         dice_before=result["dice_before"],
         dice_after=result["dice_after"],
         locked_before=result["locked_before"],
         locked_after=result["locked_after"])

    if matched == 10:
        # Atomic CAS: only the first finisher across all instances wins.
        if not await gamestore.try_finish_round(code):
            snap = await gamestore.snapshot(code)
            if snap:
                await send(session.ws, state_msg(snap, code))
            return
        wins = await gamestore.incr_wins(code, session.pid)
        round_start_ms = meta["round_start_ms"] or now_ms
        round_duration_ms = now_ms - round_start_ms
        log.info("win      game=%s  player=%s  round=%d  wins=%d",
                 code, session.name, meta["round_num"], wins)
        metrics.rounds_completed_total.labels(target=str(target)).inc()
        metrics.round_duration_seconds.observe(round_duration_ms / 1000.0)
        metrics.rolls_per_round.observe(p["roll_count"])
        metrics.round_winner_rolls.observe(p["roll_count"])
        emit("round_won",
             game_code=code, round_num=meta["round_num"], user_id=session.pid,
             name=session.name, target=target,
             roll_count=p["roll_count"],
             duration_ms=round_duration_ms,
             final_dice=list(p["dice"]))
        snap = await gamestore.snapshot(code)
        if snap:
            await send(session.ws, state_msg(snap, code, "round_won", winner_name=session.name))
        asyncio.create_task(delayed_broadcast(code, session.pid, True, winner_name=session.name))
    else:
        log.info("roll     game=%s  player=%s  matched=%d/10  target=%d",
                 code, session.name, matched, target)
        snap = await gamestore.snapshot(code)
        if snap:
            await send(session.ws, state_msg(snap, code))
        asyncio.create_task(delayed_broadcast(code, session.pid, False, None))


async def handle_pause(session: Session, msg: dict) -> None:
    """Host-only toggle that freezes/unfreezes rolling for everyone in the game."""
    code = session.code
    if not code:
        return
    meta = await gamestore.get_meta(code)
    if meta is None or meta["host"] != session.pid or not meta["started"]:
        return
    new_paused = not meta["paused"]
    log.info("pause    game=%s  paused=%s  by=%s", code, new_paused, session.name)
    emit("game_paused" if new_paused else "game_resumed",
         game_code=code, user_id=session.pid, name=session.name,
         round_num=meta["round_num"])
    if new_paused:
        # Hold the game open for up to PAUSE_MAX; drops are suspended meanwhile.
        deadline_ms = gamestore.now_ms() + int(PAUSE_MAX * 1000)
        await gamestore.set_paused(code, True, deadline_ms)
        old = state.pause_tasks.pop(code, None)
        if old:
            old.cancel()
        state.pause_tasks[code] = asyncio.create_task(pause_timeout(code))
        snap = await gamestore.snapshot(code)
        if snap:
            await broadcast(code, state_msg(snap, code))
    else:
        await gamestore.set_paused(code, False, None)
        t = state.pause_tasks.pop(code, None)
        if t:
            t.cancel()
        snap = await gamestore.snapshot(code)
        if snap is None:
            return
        # Players who went offline during the pause were never dropped. Now
        # that we're live again, give each one the normal grace to return.
        for pid, pl in snap["players"].items():
            if pl.get("disconnected"):
                key = (code, pid)
                old = state.drop_tasks.pop(key, None)
                if old:
                    old.cancel()
                state.drop_tasks[key] = asyncio.create_task(drop_player(code, pid))
        # A round win deferred during the pause (delayed_broadcast) advances now.
        if await gamestore.pop_round_advance_pending(code):
            await advance_round(code)  # broadcasts the fresh round itself
        else:
            await broadcast(code, state_msg(snap, code))


async def handle_roll_done(session: Session, msg: dict) -> None:
    ev = state.ack_events.get(session.pid)
    if ev is not None:
        ev.set()


async def handle_pong(session: Session, msg: dict) -> None:
    if session.pinger is not None:
        session.pinger.record_pong()


ACTIONS = {
    "auth": handle_auth,
    "create": handle_create,
    "join": handle_join,
    "start": handle_start,
    "reconnect": handle_reconnect,
    "roll": handle_roll,
    "pause": handle_pause,
    "roll_done": handle_roll_done,
    "pong": handle_pong,
}


def _client_ip(ws: WebSocket) -> str:
    """Real client IP for abuse limits (audit H1). Behind a trusted proxy the
    transport peer is the proxy, so read X-Forwarded-For; otherwise use the
    peer. Taking the entry TRUSTED_PROXY_HOPS from the right ignores any
    client-spoofed values prepended on the left."""
    peer = ws.client.host if ws.client else "?"
    if not TRUST_PROXY_HEADERS:
        return peer
    xff = ws.headers.get("x-forwarded-for")
    if not xff:
        return peer
    parts = [p.strip() for p in xff.split(",") if p.strip()]
    if not parts:
        return peer
    idx = min(max(TRUSTED_PROXY_HOPS, 1), len(parts))
    return parts[-idx]


def _origin_allowed(ws: WebSocket) -> bool:
    """WS Origin allowlist (audit M3). '*' disables the check (dev default).
    A missing Origin (non-browser client) is allowed — CSWSH is a browser
    threat, and browsers always send Origin."""
    if "*" in ALLOWED_ORIGINS:
        return True
    origin = ws.headers.get("origin")
    if origin is None:
        return True
    return origin in ALLOWED_ORIGINS


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    if not _origin_allowed(ws):
        log.warning("ws reject  bad origin=%s", ws.headers.get("origin"))
        await ws.close(code=1008)
        return
    await ws.accept()
    ip = _client_ip(ws)
    # Per-IP connection cap (audit H1) — bound concurrent sockets / pinger tasks.
    conn_n = await gamestore.conn_incr(ip)
    if conn_n > MAX_CONNECTIONS_PER_IP:
        await gamestore.conn_decr(ip)
        log.warning("ws reject  ip=%s  too many connections (%d)", ip, conn_n)
        await ws.close(code=1013)  # try again later
        return

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
            # Reject oversized frames before parsing (audit L2).
            if len(text) > MAX_WS_MESSAGE_BYTES:
                log.warning("ws oversize pid=%s  bytes=%d", session.pid[:8], len(text))
                await _error(ws, "Message too large")
                continue
            session.msgs_in += 1
            session.bytes_in += len(text)
            metrics.ws_bytes_in_total.inc(len(text))
            try:
                msg = json.loads(text)
            except (ValueError, TypeError):
                continue
            if not isinstance(msg, dict):
                continue
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
        await gamestore.conn_decr(ip)

        code = session.code
        if code:
            local = connections.get(code)
            if local:
                local.pop(session.pid, None)
            player = await gamestore.get_player(code, session.pid)
            if player is not None and not player.get("disconnected"):
                await gamestore.mark_disconnected(code, session.pid)
                emit("player_left", game_code=code, user_id=session.pid,
                     name=session.name, reason="disconnect",
                     player_count=None)
                key = (code, session.pid)
                old = state.drop_tasks.pop(key, None)
                if old:
                    old.cancel()
                state.drop_tasks[key] = asyncio.create_task(drop_player(code, session.pid))
                snap = await gamestore.snapshot(code)
                if snap:
                    await broadcast(code, state_msg(snap, code))
