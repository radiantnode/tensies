import asyncio
import json

from .config import DISCONNECT_GRACE, ROLL_ACK_TIMEOUT, ROUND_WIN_DELAY, log
from .game import deal_round, next_target, state_msg
from .state import connections, games


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
        game["target"] = next_target(game["target"])
        game["round_num"] += 1
        game["round_over"] = False
        deal_round(game)
        await broadcast(code, state_msg(game, code))


async def drop_player(code: str, pid: str) -> None:
    """Remove a disconnected player after the grace period."""
    await asyncio.sleep(DISCONNECT_GRACE)
    if code not in games:
        return
    game = games[code]
    player = game["players"].get(pid)
    if player is None or not player.get("disconnected"):
        return
    player_name = player["name"]
    del game["players"][pid]
    connections[code].pop(pid, None)
    log.info("drop     game=%s  player=%s  (30s timeout)", code, player_name)
    if not game["players"]:
        log.info("close    game=%s  (all dropped)", code)
        del games[code]
        connections.pop(code, None)
        return
    if game["host"] == pid:
        game["host"] = next(iter(game["players"]))
    await broadcast(code, state_msg(game, code))
