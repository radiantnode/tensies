"""Grafana Live pusher.

Subscribes to the bus and POSTs selected events to Grafana's
/api/live/push/tensies endpoint in InfluxDB line protocol. Browser
dashboards subscribe to `stream/tensies/<measurement>` for sub-second
updates without polling.

Channels:
    stream/tensies/rolls         every roll
    stream/tensies/wins          every round won
    stream/tensies/games         game/player lifecycle
    stream/tensies/connections   ws connect/disconnect
    stream/tensies/pings         ping RTT samples
"""
import asyncio
import logging
import os
import time

import httpx

from telemetry import metrics
from telemetry.bus import bus

log = logging.getLogger("tensies.live")

GRAFANA_URL = os.environ.get("GRAFANA_LIVE_URL", "http://grafana:3000/api/live/push")
GRAFANA_USER = os.environ.get("GRAFANA_USER", "admin")
GRAFANA_PASS = os.environ.get("GRAFANA_PASS", "admin")
STREAM_ID = "tensies"

PUSH_INTERVAL_S = 0.1
PUSH_MAX = 200

_task: asyncio.Task | None = None
_client: httpx.AsyncClient | None = None


async def start() -> None:
    global _task, _client
    _client = httpx.AsyncClient(
        auth=(GRAFANA_USER, GRAFANA_PASS), timeout=httpx.Timeout(2.0)
    )
    q = bus.subscribe(maxsize=20_000)
    _task = asyncio.create_task(_run(q), name="telemetry.live")


async def stop() -> None:
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):
            pass
    if _client is not None:
        await _client.aclose()


async def _run(q: asyncio.Queue) -> None:
    while True:
        try:
            metrics.telemetry_queue_depth.labels(subscriber="live").set(q.qsize())
            lines = await _collect(q)
            if not lines:
                continue
            await _push(lines)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("live pusher loop error")
            await asyncio.sleep(0.5)


async def _collect(q: asyncio.Queue) -> list[str]:
    try:
        first = await asyncio.wait_for(q.get(), timeout=PUSH_INTERVAL_S)
    except asyncio.TimeoutError:
        return []
    lines: list[str] = []
    _maybe_add(lines, first)
    deadline = time.monotonic() + PUSH_INTERVAL_S
    while len(lines) < PUSH_MAX:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            ev = await asyncio.wait_for(q.get(), timeout=remaining)
        except asyncio.TimeoutError:
            break
        _maybe_add(lines, ev)
    return lines


def _maybe_add(lines: list[str], ev: dict) -> None:
    t = ev["type"]
    if t == "roll":
        lines.append(_line(
            "rolls",
            tags={"game": ev.get("game_code"), "player": ev.get("name"), "user": ev.get("user_id")},
            fields={
                "matched": ev.get("matched", 0),
                "target": ev.get("target"),
                "dt_ms": ev.get("dt_ms") or 0,
                "round_roll_num": ev.get("round_roll_num", 0),
                "round_num": ev.get("round_num", 0),
            },
            ts_ms=ev["ts_ms"],
        ))
    elif t == "round_won":
        lines.append(_line(
            "wins",
            tags={"game": ev.get("game_code"), "player": ev.get("name"), "user": ev.get("user_id")},
            fields={
                "rolls": ev.get("roll_count", 0),
                "duration_ms": ev.get("duration_ms") or 0,
                "target": ev.get("target"),
                "round_num": ev.get("round_num", 0),
            },
            ts_ms=ev["ts_ms"],
        ))
    elif t in ("game_created", "game_started", "game_ended", "player_joined", "player_left"):
        lines.append(_line(
            "games",
            tags={"game": ev.get("game_code"), "event": t},
            fields={
                "player_count": ev.get("player_count", 0),
                "round_num": ev.get("round_num", 0),
                "name": _quote(ev.get("name")),
            },
            ts_ms=ev["ts_ms"],
        ))
    elif t in ("connection_opened", "connection_closed"):
        lines.append(_line(
            "connections",
            tags={"event": t, "session": (ev.get("session_id") or "")[:8]},
            fields={
                "duration_ms": ev.get("duration_ms") or 0,
                "messages_in": ev.get("messages_in", 0),
                "messages_out": ev.get("messages_out", 0),
                "bytes_in": ev.get("bytes_in", 0),
                "bytes_out": ev.get("bytes_out", 0),
            },
            ts_ms=ev["ts_ms"],
        ))
    elif t == "ws_ping":
        rtt = ev.get("rtt_ms")
        if rtt is not None:
            lines.append(_line(
                "pings",
                tags={"session": (ev.get("session_id") or "")[:8]},
                fields={"rtt_ms": float(rtt)},
                ts_ms=ev["ts_ms"],
            ))


def _line(measurement: str, *, tags: dict, fields: dict, ts_ms: int) -> str:
    tag_str = ",".join(
        f"{_esc_key(k)}={_esc_val(v)}"
        for k, v in tags.items()
        if v is not None and v != ""
    )
    field_str = ",".join(
        f"{_esc_key(k)}={_fmt_field(v)}"
        for k, v in fields.items()
        if v is not None
    )
    head = measurement if not tag_str else f"{measurement},{tag_str}"
    return f"{head} {field_str} {int(ts_ms) * 1_000_000}"


def _esc_key(s) -> str:
    return str(s).replace(" ", "\\ ").replace(",", "\\,").replace("=", "\\=")


def _esc_val(s) -> str:
    return _esc_key(str(s))


def _fmt_field(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return f"{v}i"
    if isinstance(v, float):
        return repr(v)
    return _quote(v)


def _quote(s) -> str:
    if s is None:
        return '""'
    return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'


async def _push(lines: list[str]) -> None:
    if _client is None:
        return
    body = "\n".join(lines)
    url = f"{GRAFANA_URL}/{STREAM_ID}"
    t0 = time.monotonic()
    try:
        r = await _client.post(url, content=body)
        metrics.live_push_seconds.labels(channel=STREAM_ID).observe(time.monotonic() - t0)
        if r.status_code >= 300:
            metrics.live_push_failures_total.inc()
            if r.status_code != 401:
                log.warning("grafana live push %d: %s", r.status_code, r.text[:200])
    except Exception as e:
        metrics.live_push_failures_total.inc()
        log.debug("grafana live push failed: %s", e)
