"""Boots the telemetry subsystem during FastAPI lifespan."""
import asyncio
import logging

from telemetry import live, metrics, store, writer
from telemetry.bus import bus

log = logging.getLogger("tensies.telemetry")

_depth_task: asyncio.Task | None = None


async def start() -> None:
    await store.init()
    await writer.start()
    await live.start()
    global _depth_task
    _depth_task = asyncio.create_task(_depth_loop(), name="telemetry.depths")
    log.info("telemetry started")


async def stop() -> None:
    if _depth_task is not None:
        _depth_task.cancel()
    await writer.stop()
    await live.stop()
    await store.close()
    log.info("telemetry stopped")


async def _depth_loop() -> None:
    """Periodically publish queue depths to Prometheus."""
    names = ("writer", "live")
    try:
        while True:
            depths = bus.queue_depths()
            for i, d in enumerate(depths):
                lbl = names[i] if i < len(names) else f"q{i}"
                metrics.telemetry_queue_depth.labels(subscriber=lbl).set(d)
            await asyncio.sleep(1.0)
    except asyncio.CancelledError:
        return
