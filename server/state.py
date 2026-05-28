from typing import TYPE_CHECKING

from fastapi import WebSocket

if TYPE_CHECKING:
    from .ws import Session

games: dict[str, dict] = {}
connections: dict[str, dict[str, WebSocket]] = {}

# id(ws) → Session. Lets broadcast.send() update per-connection telemetry
# counters (msgs_out, bytes_out) without threading the Session through
# every caller.
sessions: dict[int, "Session"] = {}
