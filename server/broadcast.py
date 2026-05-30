import asyncio
import json
import time

from fastapi import WebSocket

from .config import DISCONNECT_GRACE, PAUSE_MAX, ROLL_ACK_TIMEOUT, ROUND_WIN_DELAY, log
from .game import deal_round, next_target, state_msg
from .state import connections, games, sessions
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


async def delayed_broadcast(code: str, pid: str, is_win: bool, winner_name: str | None) -> None:
    """Hold the broadcast until the roller acks their reveal (or times out)."""
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
            emit("ack_timeout", game_code=code, user_id=pid,
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
        await asyncio.sleep(ROUND_WIN_DELAY)
        if code not in games:
            return
        game = games[code]
        # End the old round
        old_round = game["round_num"]
        old_target = game["target"]
        emit("round_ended", game_code=code, round_num=old_round, target=old_target)
        # Advance to the next round
        game["target"] = next_target(old_target)
        game["round_num"] += 1
        game["round_over"] = False
        game["round_count"] += 1
        deal_round(game)
        emit("round_started", game_code=code,
             round_num=game["round_num"], target=game["target"])
        metrics.rounds_started_total.labels(target=str(game["target"])).inc()
        await broadcast(code, state_msg(game, code))


async def pause_timeout(code: str) -> None:
    """End a game that has stayed paused past PAUSE_MAX — assumed abandoned.

    Cancelled by handle_pause() on resume. Holding the game open (instead of
    dropping players) is what lets the host put their phone down mid-pause; this
    is the backstop so an abandoned paused game doesn't live forever in memory.
    """
    try:
        await asyncio.sleep(PAUSE_MAX)
    except asyncio.CancelledError:
        return
    if code not in games:
        return
    game = games[code]
    if not game.get("paused"):
        return
    log.info("pause_timeout  game=%s  (paused > %ds)", code, int(PAUSE_MAX))
    duration_ms = int((time.monotonic() - game["created_mono"]) * 1000)
    emit("game_ended", game_code=code, reason="pause_timeout",
         duration_ms=duration_ms, round_count=game["round_count"],
         total_rolls=game["total_rolls"])
    metrics.games_active.dec()
    metrics.games_ended_total.labels(reason="pause_timeout").inc()
    metrics.game_duration_seconds.observe(duration_ms / 1000.0)
    # Best-effort: send anyone still connected back to the landing screen.
    await broadcast(code, {"type": "error", "fatal": True,
                           "msg": "Game ended — it was paused too long."})
    del games[code]
    connections.pop(code, None)


async def drop_player(code: str, pid: str) -> None:
    """Remove a disconnected player after the grace period."""
    await asyncio.sleep(DISCONNECT_GRACE)
    if code not in games:
        return
    game = games[code]
    player = game["players"].get(pid)
    if player is None or not player.get("disconnected"):
        return
    # While paused, nobody is dropped — the host may have stepped away (phone
    # asleep). They can reconnect any time until the pause cap; if the pause
    # itself runs out, pause_timeout() ends the whole game. On resume,
    # handle_pause reschedules a fresh drop for anyone still offline.
    if game.get("paused"):
        return
    player_name = player["name"]
    del game["players"][pid]
    connections[code].pop(pid, None)
    log.info("drop     game=%s  player=%s  (30s timeout)", code, player_name)
    emit("player_left", game_code=code, user_id=pid, name=player_name,
         reason="drop", player_count=len(game["players"]))
    if not game["players"]:
        log.info("close    game=%s  (all dropped)", code)
        duration_ms = int((time.monotonic() - game["created_mono"]) * 1000)
        emit("game_ended", game_code=code, reason="all_dropped",
             duration_ms=duration_ms, round_count=game["round_count"],
             total_rolls=game["total_rolls"])
        metrics.games_active.dec()
        metrics.games_ended_total.labels(reason="all_dropped").inc()
        metrics.game_duration_seconds.observe(duration_ms / 1000.0)
        del games[code]
        connections.pop(code, None)
        return
    if game["host"] == pid:
        old_host = game["host"]
        new_host = next(iter(game["players"]))
        game["host"] = new_host
        emit("host_transferred", game_code=code, **{"from": old_host, "to": new_host})
    await broadcast(code, state_msg(game, code))
