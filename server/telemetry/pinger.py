"""Per-connection ping loop to measure round-trip latency."""
import asyncio
import time

from server.config import PING_INTERVAL
from server.telemetry import metrics
from server.telemetry.bus import bus


class Pinger:
    """One per WebSocket. Sends `{type: 'ping', t}` every PING_INTERVAL.
    The client echoes back as `{action: 'pong', t}`; the WS handler routes
    it to record_pong() which records the RTT.
    """

    def __init__(self, session_id: str, send_helper) -> None:
        self.session_id = session_id
        self._send = send_helper
        self._pending_t: float | None = None
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._loop(), name=f"pinger.{self.session_id[:8]}")

    def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()

    def record_pong(self) -> None:
        if self._pending_t is None:
            return
        rtt_ms = max(0.0, (time.monotonic() - self._pending_t) * 1000.0)
        self._pending_t = None
        metrics.ws_ping_rtt_seconds.observe(rtt_ms / 1000.0)
        bus.emit("ws_ping", session_id=self.session_id, rtt_ms=rtt_ms)

    async def _loop(self) -> None:
        try:
            await asyncio.sleep(PING_INTERVAL)
            while True:
                self._pending_t = time.monotonic()
                try:
                    await self._send({"type": "ping", "t": self._pending_t})
                except Exception:
                    return
                await asyncio.sleep(PING_INTERVAL)
        except asyncio.CancelledError:
            return
