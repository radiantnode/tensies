"""In-process event bus.

emit() is sync and never blocks the caller. Each subscriber owns a bounded
queue; on overflow the oldest event is dropped (and counted). The roll handler
in main.py can call emit() in its hot path without ever awaiting I/O.
"""
import asyncio
import time

from telemetry import metrics


class _Bus:
    def __init__(self) -> None:
        self._queues: list[asyncio.Queue] = []

    def subscribe(self, maxsize: int = 10_000) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=maxsize)
        self._queues.append(q)
        return q

    def emit(self, event_type: str, **payload) -> None:
        ev = {
            "type": event_type,
            "ts_ms": int(time.time() * 1000),
            **payload,
        }
        for q in self._queues:
            try:
                q.put_nowait(ev)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                    q.put_nowait(ev)
                    metrics.telemetry_dropped_total.inc()
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    metrics.telemetry_dropped_total.inc()

    def queue_depths(self) -> list[int]:
        return [q.qsize() for q in self._queues]


bus = _Bus()


def emit(event_type: str, **payload) -> None:
    bus.emit(event_type, **payload)
