"""Cross-instance broadcast over Redis pub/sub.

`broadcast()` no longer iterates local sockets directly. Instead it publishes
to `bcast:{code}`; every instance pattern-subscribes to `bcast:*` and delivers
each message to the players of that game it terminates locally (honouring
`exclude` locally). The publishing instance receives its own message the same
way, so there is exactly one delivery path.
"""
import asyncio
import json

import redis.asyncio as aioredis

from server.config import REDIS_URL, log
from server.state import connections

CHANNEL_PREFIX = "bcast:"

_pub: aioredis.Redis | None = None
_sub_conn: aioredis.Redis | None = None
_pubsub = None
_task: asyncio.Task | None = None


async def start() -> None:
    global _pub, _sub_conn, _pubsub, _task
    _pub = aioredis.from_url(REDIS_URL, decode_responses=True)
    _sub_conn = aioredis.from_url(REDIS_URL, decode_responses=True)
    _pubsub = _sub_conn.pubsub(ignore_subscribe_messages=True)
    await _pubsub.psubscribe(CHANNEL_PREFIX + "*")
    _task = asyncio.create_task(_run(), name="fanout.subscriber")
    log.info("fanout subscriber started")


async def stop() -> None:
    if _task is not None:
        _task.cancel()
    for closer in (_pubsub, _sub_conn, _pub):
        try:
            if closer is not None:
                await closer.aclose()
        except Exception:
            pass


async def publish(code: str, message: dict, exclude: str | None = None) -> None:
    if _pub is None:
        return
    env = json.dumps({"exclude": exclude, "msg": message})
    await _pub.publish(CHANNEL_PREFIX + code, env)


async def _run() -> None:
    try:
        async for m in _pubsub.listen():
            if m.get("type") != "pmessage":
                continue
            code = m["channel"][len(CHANNEL_PREFIX):]
            try:
                env = json.loads(m["data"])
            except (ValueError, TypeError):
                continue
            await _deliver(code, env.get("msg"), env.get("exclude"))
    except asyncio.CancelledError:
        return
    except Exception:
        log.exception("fanout subscriber loop error")


async def _deliver(code: str, message: dict, exclude: str | None) -> None:
    # Lazy import avoids an import cycle (broadcast imports this module).
    from server.broadcast import send

    local = connections.get(code)
    if not local:
        return
    dead = []
    for pid, ws in list(local.items()):
        if pid == exclude:
            continue
        try:
            await send(ws, message)
        except Exception:
            dead.append(pid)
    for pid in dead:
        local.pop(pid, None)
