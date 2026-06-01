"""Process-local state.

Game state itself lives in Redis (see server.gamestore) so any instance can
serve any game. What stays here is strictly per-process: the sockets this
instance terminates, plus registries of live asyncio objects that can't be
serialised and are only ever touched by the instance that owns the connection.
"""
from typing import TYPE_CHECKING

import asyncio

from fastapi import WebSocket

if TYPE_CHECKING:
    from .ws import Session

# game_code → {player_id: ws} for the connections THIS instance terminates.
# Cross-instance fan-out is handled by server.fanout publishing to Redis.
connections: dict[str, dict[str, WebSocket]] = {}

# id(ws) → Session. Lets broadcast.send() update per-connection telemetry
# counters (msgs_out, bytes_out) without threading the Session through
# every caller.
sessions: dict[int, "Session"] = {}

# pid → asyncio.Event for the reveal-ack handshake. The roller and its
# `roll_done` are always on the same instance, so this never needs to cross
# processes (delayed_broadcast waits here; handle_roll_done sets it).
ack_events: dict[str, asyncio.Event] = {}

# (code, pid) → grace-drop task, and code → pause-cap task. Owned by the
# instance that scheduled them; the reaper is the cross-instance backstop.
drop_tasks: dict[tuple[str, str], asyncio.Task] = {}
pause_tasks: dict[str, asyncio.Task] = {}
