"""Boots the telemetry subsystem during FastAPI lifespan."""
import asyncio
import logging

from server.config import TELEMETRY_ENABLED
from server.telemetry import live, metrics, store, writer
from server.telemetry.bus import bus

log = logging.getLogger("tensies.telemetry")

_depth_task: asyncio.Task | None = None
_partition_task: asyncio.Task | None = None
_enabled = False

PARTITION_CHECK_INTERVAL_S = 6 * 60 * 60  # every 6 hours


async def start() -> None:
    # Redis is required; the Postgres/Grafana telemetry stack is optional.
    # When disabled, emit() still runs (its bounded queues simply drain to
    # nowhere) and Prometheus /metrics still works in-process.
    global _enabled
    if not TELEMETRY_ENABLED:
        log.info("telemetry disabled (TELEMETRY_ENABLED=0) — /metrics still served")
        return
    _enabled = True
    # Pool + migrations are now handled by server.db (initialized in lifespan
    # before telemetry.start()), so we skip store.init() here.
    # NOTE: this used to TRUNCATE live_* on boot, assuming game state died with
    # the process. State now lives in Redis and is shared by every instance, so
    # a boot-time truncate would wipe peers' live rows. Stale rows age out via
    # the telemetry grace instead.
    await writer.start()
    await live.start()
    global _depth_task, _partition_task
    _depth_task = asyncio.create_task(_depth_loop(), name="telemetry.depths")
    _partition_task = asyncio.create_task(_partition_loop(), name="telemetry.partitions")
    log.info("telemetry started")


async def stop() -> None:
    if not _enabled:
        return
    for t in (_depth_task, _partition_task):
        if t is not None:
            t.cancel()
    await writer.stop()
    await live.stop()
    # Pool closure is now handled by server.db (in lifespan finally block).
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


async def _partition_loop() -> None:
    """Ensure event partitions exist for the current and next month.

    The 001 migration bootstraps both; this task keeps us ahead of the
    calendar so we never roll into a month with no partition.
    """
    try:
        while True:
            try:
                await store.ensure_partitions()
            except Exception:
                log.exception("ensure_partitions failed")
            await asyncio.sleep(PARTITION_CHECK_INTERVAL_S)
    except asyncio.CancelledError:
        return
