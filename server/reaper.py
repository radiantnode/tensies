"""Cross-instance backstop for per-game timers.

Normal disconnect-drops and pause caps fire promptly as asyncio tasks on the
instance that owns the connection. If that instance dies mid-countdown, those
tasks die with it — this periodic sweep catches the orphans:

- disconnected players past the grace window are dropped (via the same
  idempotent gamestore CAS the live path uses, so it's safe if both run);
- paused games past their deadline are ended.

It also publishes the global active-games gauge from `games:index`. Note: every
instance reports the same global count, so aggregate that gauge with max()/avg()
across instances in Grafana, not sum().
"""
import asyncio

from . import gamestore
from .broadcast import do_drop, end_if_paused_over
from .config import DISCONNECT_GRACE, REAP_INTERVAL, log
from .telemetry import metrics

_task: asyncio.Task | None = None


async def start() -> None:
    global _task
    _task = asyncio.create_task(_loop(), name="reaper")
    log.info("reaper started  interval=%ss", REAP_INTERVAL)


async def stop() -> None:
    if _task is not None:
        _task.cancel()


async def _loop() -> None:
    while True:
        try:
            await _sweep()
        except asyncio.CancelledError:
            return
        except Exception:
            log.exception("reaper sweep error")
        await asyncio.sleep(REAP_INTERVAL)


async def _sweep() -> None:
    metrics.games_active.set(await gamestore.active_count())
    for code in await gamestore.all_codes():
        snap = await gamestore.snapshot(code)
        if snap is None:
            # The game hash TTL-expired (its instance died with players still
            # connected) but the index entry survives expiry. Reap it, or the
            # code inflates the active gauge and counts against MAX_GAMES
            # forever. delete_game is idempotent: DEL of a gone key + SREM.
            await gamestore.delete_game(code)
            continue
        # A started game must not linger in the discovery index (the live path
        # prunes it on start; this catches a broadcast/check-in whose owner
        # crashed). Idempotent — geo_remove no-ops if it's not indexed.
        if snap.get("started"):
            await gamestore.geo_remove(code)
        if snap.get("paused"):
            deadline = snap.get("pause_deadline_ms")
            if deadline is not None and gamestore.now_ms() >= deadline:
                await end_if_paused_over(code)
                continue
            # Paused-host handover backstop: nobody is dropped while paused,
            # but an absent host must still lose the resume control (do_drop's
            # paused branch transfers the role without dropping anyone). The
            # local grace task enforces the grace by sleeping first; here we
            # check it explicitly, since do_drop's paused path does not.
            host_pid = snap.get("host")
            host = snap["players"].get(host_pid) if host_pid else None
            if host and host.get("disconnected"):
                dat = host.get("disconnected_at_ms") or 0
                if gamestore.now_ms() - dat >= DISCONNECT_GRACE * 1000:
                    await do_drop(code, host_pid)
            continue
        for pid, p in snap["players"].items():
            if p.get("disconnected"):
                # Idempotent: do_drop only removes players actually past grace.
                await do_drop(code, pid)
    # Reconcile orphaned discovery blips whose game has vanished (hard-crashed
    # instance, TTL expiry) — a GEO set has no per-member TTL of its own.
    for code in await gamestore.geo_members():
        if not await gamestore.exists(code):
            await gamestore.geo_remove(code)
