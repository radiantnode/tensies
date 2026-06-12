import asyncio
import json
import time

from fastapi import WebSocket

from . import fanout, gamestore, state
from .config import DISCONNECT_GRACE, PAUSE_MAX, ROLL_ACK_TIMEOUT, ROUND_WIN_DELAY, log
from .game import next_target, state_msg
from .state import sessions
from .telemetry import emit, metrics


async def send(ws: WebSocket, message: dict) -> None:
    """Serialise + send a single message; updates Prometheus + per-session counters.

    Single send site for the whole server — anything that writes to a WS goes
    through here so message-out / bytes-out / send-latency metrics stay
    coherent. The per-Session send_lock prevents the Pinger task and the
    receive-loop handler from interleaving frames on the same WS.
    """
    data = json.dumps(message)
    mtype = message.get("type", "?")
    sess = sessions.get(id(ws))
    t0 = time.monotonic()
    try:
        if sess is not None:
            async with sess.send_lock:
                await ws.send_text(data)
        else:
            await ws.send_text(data)
    finally:
        metrics.ws_send_seconds.labels(type=mtype).observe(time.monotonic() - t0)
    metrics.ws_messages_out_total.labels(type=mtype).inc()
    metrics.ws_bytes_out_total.inc(len(data))
    metrics.ws_message_size_bytes.observe(len(data))
    if sess is not None:
        sess.msgs_out += 1
        sess.bytes_out += len(data)


async def broadcast(code: str, message: dict, *, exclude: str | None = None) -> None:
    """Fan a message out to every player in a game, across all instances."""
    await fanout.publish(code, message, exclude=exclude)


async def advance_round(code: str) -> None:
    """Roll the game to the next round: cycle the target, deal fresh dice."""
    meta = await gamestore.get_meta(code)
    if meta is None:
        return
    old_round = meta["round_num"]
    old_target = meta["target"]
    emit("round_ended", game_code=code, round_num=old_round, target=old_target)
    new_target = next_target(old_target)
    await gamestore.advance_round(code, new_target)
    snap = await gamestore.snapshot(code)
    if snap is None:
        return
    emit("round_started", game_code=code,
         round_num=snap["round_num"], target=new_target)
    metrics.rounds_started_total.labels(target=str(new_target)).inc()
    await broadcast(code, state_msg(snap, code))


async def delayed_broadcast(code: str, pid: str, is_win: bool, winner_name: str | None) -> None:
    """Hold the broadcast until the roller acks their reveal (or times out).

    The ack event is process-local (server.state.ack_events): the roller and
    its `roll_done` are always on this instance, so the handshake never crosses
    processes — only the resulting fan-out does.
    """
    if not await gamestore.exists(code):
        return

    ev = asyncio.Event()
    state.ack_events[pid] = ev
    try:
        await asyncio.wait_for(ev.wait(), timeout=ROLL_ACK_TIMEOUT)
    except asyncio.TimeoutError:
        log.info("ack_timeout  game=%s  pid=%s", code, pid[:8])
        metrics.ack_timeouts_total.inc()
        emit("ack_timeout", game_code=code, user_id=pid,
             wait_ms=int(ROLL_ACK_TIMEOUT * 1000))
    finally:
        if state.ack_events.get(pid) is ev:
            state.ack_events.pop(pid, None)

    snap = await gamestore.snapshot(code)
    if snap is None:
        return

    if is_win:
        msg = state_msg(snap, code, "round_won", winner_name=winner_name or "?")
    else:
        msg = state_msg(snap, code)
    await broadcast(code, msg, exclude=pid)

    if is_win:
        await asyncio.sleep(ROUND_WIN_DELAY)
        meta = await gamestore.get_meta(code)
        if meta is None:
            return
        if meta["paused"]:
            # A pause landed during the win delay — don't advance the round on
            # top of it. Freeze here; handle_pause() advances on resume.
            await gamestore.set_round_advance_pending(code, True)
            return
        await advance_round(code)


async def pause_timeout(code: str) -> None:
    """End a game that has stayed paused past PAUSE_MAX — assumed abandoned.

    Cancelled by handle_pause() on resume. The reaper is a cross-instance
    backstop if the instance that scheduled this dies first.
    """
    try:
        await asyncio.sleep(PAUSE_MAX)
    except asyncio.CancelledError:
        return
    await end_if_paused_over(code)


async def end_if_paused_over(code: str) -> None:
    snap = await gamestore.snapshot(code)
    if snap is None or not snap.get("paused"):
        return
    deadline = snap.get("pause_deadline_ms")
    if deadline is not None and gamestore.now_ms() < deadline:
        return  # not actually over yet (reaper called early)
    log.info("pause_timeout  game=%s  (paused > %ds)", code, int(PAUSE_MAX))
    duration_ms = gamestore.now_ms() - snap["created_ms"]
    emit("game_ended", game_code=code, reason="pause_timeout",
         duration_ms=duration_ms, round_count=snap["round_count"],
         total_rolls=snap["total_rolls"])
    metrics.games_ended_total.labels(reason="pause_timeout").inc()
    metrics.game_duration_seconds.observe(duration_ms / 1000.0)
    await broadcast(code, {"type": "error", "fatal": True, "code": "pause_timeout",
                           "msg": "Game ended — it was paused too long."})
    await gamestore.delete_game(code)
    state.connections.pop(code, None)
    state.pause_tasks.pop(code, None)


async def drop_player(code: str, pid: str) -> None:
    """Remove a disconnected player after the grace period (local-task path)."""
    await asyncio.sleep(DISCONNECT_GRACE)
    state.drop_tasks.pop((code, pid), None)
    await do_drop(code, pid)


async def do_drop(code: str, pid: str) -> None:
    """Shared drop logic used by the grace task and the reaper. Idempotent."""
    snap = await gamestore.snapshot(code)
    if snap is None:
        return
    player = snap["players"].get(pid)
    if player is None or not player.get("disconnected"):
        return

    if snap.get("paused"):
        # While paused, nobody is dropped — the host may have stepped away. But
        # a paused game must not be held hostage by an absent host: if the host
        # is the one who's gone, hand the host role (and the resume control) to
        # a still-connected player so the game stays recoverable.
        if snap["host"] == pid:
            new_host = next((q for q, pl in snap["players"].items()
                             if q != pid and not pl.get("disconnected")), None)
            if new_host:
                await gamestore.transfer_host(code, new_host)
                log.info("host_xfer game=%s  (paused, host away)  %s -> %s",
                         code, pid[:8], new_host[:8])
                emit("host_transferred", game_code=code, **{"from": pid, "to": new_host})
                snap2 = await gamestore.snapshot(code)
                if snap2:
                    await broadcast(code, state_msg(snap2, code))
        return

    name = player["name"]
    res = await gamestore.drop_player(code, pid, int(DISCONNECT_GRACE * 1000))
    if res["action"] == "noop":
        return
    local = state.connections.get(code)
    if local:
        local.pop(pid, None)
    log.info("drop     game=%s  player=%s  (%ds timeout)", code, name, int(DISCONNECT_GRACE))
    remaining = len(snap["players"]) - 1
    emit("player_left", game_code=code, user_id=pid, name=name,
         reason="drop", player_count=remaining)

    if res["action"] == "deleted":
        log.info("close    game=%s  (all dropped)", code)
        duration_ms = gamestore.now_ms() - snap["created_ms"]
        emit("game_ended", game_code=code, reason="all_dropped",
             duration_ms=duration_ms, round_count=snap["round_count"],
             total_rolls=snap["total_rolls"])
        metrics.games_ended_total.labels(reason="all_dropped").inc()
        metrics.game_duration_seconds.observe(duration_ms / 1000.0)
        state.connections.pop(code, None)
        return

    if res["new_host"]:
        emit("host_transferred", game_code=code, **{"from": pid, "to": res["new_host"]})
    snap2 = await gamestore.snapshot(code)
    if snap2:
        await broadcast(code, state_msg(snap2, code))
