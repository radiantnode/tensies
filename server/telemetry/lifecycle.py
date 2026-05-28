"""Boots the telemetry subsystem during FastAPI lifespan."""
import asyncio
import logging

from server.telemetry import live, metrics, store, writer
from server.telemetry.bus import bus

log = logging.getLogger("tensies.telemetry")

_depth_task: asyncio.Task | None = None
_partition_task: asyncio.Task | None = None

PARTITION_CHECK_INTERVAL_S = 6 * 60 * 60  # every 6 hours


async def start() -> None:
    await store.init()
    # In-memory game state doesn't survive an app restart, so any live_*
    # rows we see at boot are orphans from a previous process. Truncate
    # them so dashboards don't show ghost games until the 30 s grace
    # eventually times them out.
    async with store.pool().acquire() as con:
        await con.execute(
            "TRUNCATE live_games, live_players, live_sessions"
        )
    await writer.start()
    await live.start()
    global _depth_task, _partition_task
    _depth_task = asyncio.create_task(_depth_loop(), name="telemetry.depths")
    _partition_task = asyncio.create_task(_partition_loop(), name="telemetry.partitions")
    log.info("telemetry started")


async def stop() -> None:
    for t in (_depth_task, _partition_task):
        if t is not None:
            t.cancel()
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
