"""Shared game state in Redis.

Replaces the in-memory `games` dict so any instance can serve any game. One
Redis hash per game (`game:{code}`) holds game scalars plus namespaced
per-player fields (`p:{pid}:{field}`); a `games:index` set tracks live codes
for the reaper and the active-games gauge.

Design notes that keep simultaneous rolling fast and correct:
- Distinct players write distinct hash fields (`HSET`/`HINCRBY` are atomic and
  never contend), so N players rolling at once never serialize on a shared key.
- The one genuinely contended write — crowning the round winner — is an atomic
  Lua compare-and-set (`try_finish_round`), so only the first finisher wins.
- Counters use `HINCRBY`; create/join/drop roster edits use small Lua scripts.

Live asyncio objects (ack events, grace-drop / pause-cap tasks) are NOT stored
here — they live in process-local registries in `server.state`, because each is
only ever touched by the instance that owns the relevant connection.
"""
import json
import secrets
import string
import time
from urllib.parse import urlsplit

import redis.asyncio as aioredis

from server.config import GAME_TTL, MAX_GAMES, MAX_PLAYERS_PER_GAME, REDIS_URL, log

INDEX = "games:index"

_r: aioredis.Redis | None = None

# Lua scripts, registered on init().
_create = _join = _finish = _drop = None


def client() -> aioredis.Redis:
    assert _r is not None, "gamestore.init() must be called first"
    return _r


def now_ms() -> int:
    return int(time.time() * 1000)


def _gkey(code: str) -> str:
    return f"game:{code}"


def _redact(url: str) -> str:
    """A connection URL with any credentials stripped (scheme://host:port).

    REDIS_URL embeds its password inline, so it must never reach a log or error
    string verbatim. This drops the userinfo and keeps only the non-sensitive
    target, which is all an operator needs to diagnose a connection problem.
    """
    try:
        p = urlsplit(url)
        host = p.hostname or "?"
        netloc = f"{host}:{p.port}" if p.port else host
        return f"{p.scheme}://{netloc}" if p.scheme else netloc
    except ValueError:
        return "<redacted>"


async def init() -> None:
    """Connect to Redis and register Lua scripts. Fails loudly if unreachable."""
    global _r
    _r = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        await _r.ping()
    except Exception as e:  # noqa: BLE001 — surface a clear, actionable error
        raise RuntimeError(
            f"Cannot reach Redis at {_redact(REDIS_URL)}. Redis is required to run "
            f"Tensies; start one or set REDIS_URL. ({e})"
        ) from e
    _register_scripts()
    # Don't log REDIS_URL (or anything derived from it) — it carries the password
    # inline. The host is static config; the connect confirmation is the signal.
    log.info("gamestore connected to Redis")


async def close() -> None:
    global _r
    if _r is not None:
        await _r.aclose()
        _r = None


# ─── Lua ──────────────────────────────────────────────────────────────────

_CREATE_LUA = """
-- KEYS[1]=game key  KEYS[2]=index ; ARGV: code, cap, ttl, then field/value pairs
local cap = tonumber(ARGV[2])
if redis.call('SCARD', KEYS[2]) >= cap then return 0 end
if redis.call('EXISTS', KEYS[1]) == 1 then return -1 end
for i = 4, #ARGV, 2 do redis.call('HSET', KEYS[1], ARGV[i], ARGV[i+1]) end
redis.call('SADD', KEYS[2], ARGV[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
return 1
"""

_JOIN_LUA = """
-- KEYS[1]=game key ; ARGV: pid, name, token_hash, dice, locked, cap, ttl
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end          -- not found
if redis.call('HGET', KEYS[1], 'started') == '1' then return -2 end  -- started
local order = cjson.decode(redis.call('HGET', KEYS[1], 'order'))
if #order >= tonumber(ARGV[6]) then return -3 end                 -- full
order[#order + 1] = ARGV[1]
redis.call('HSET', KEYS[1], 'order', cjson.encode(order))
local p = 'p:' .. ARGV[1] .. ':'
redis.call('HSET', KEYS[1],
  p .. 'name', ARGV[2], p .. 'token_hash', ARGV[3],
  p .. 'dice', ARGV[4], p .. 'locked', ARGV[5],
  p .. 'wins', 0, p .. 'has_rolled', 0,
  p .. 'last_roll_ms', 0, p .. 'roll_count', 0, p .. 'disconnected', 0)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[7]))
return #order
"""

_FINISH_LUA = """
-- KEYS[1]=game key. Atomically claim the round win. Returns 1 to the first
-- caller that flips round_over 0->1, else 0.
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
if redis.call('HGET', KEYS[1], 'round_over') == '0' then
  redis.call('HSET', KEYS[1], 'round_over', '1')
  return 1
end
return 0
"""

_DROP_LUA = """
-- KEYS[1]=game key  KEYS[2]=index ; ARGV: code, pid, grace_ms, now_ms, ttl
-- Removes a disconnected player past the grace window. Idempotent: a second
-- caller (local task vs reaper) finds the player gone and no-ops.
-- Returns {0}=noop, {1,new_host}=removed (new_host '' if unchanged),
-- {2}=removed and game deleted (was last player).
local key, idx, code, pid = KEYS[1], KEYS[2], ARGV[1], ARGV[2]
if redis.call('EXISTS', key) == 0 then return {0} end
if redis.call('HGET', key, 'paused') == '1' then return {0} end   -- never drop while paused
local p = 'p:' .. pid .. ':'
if redis.call('HGET', key, p .. 'disconnected') ~= '1' then return {0} end
local dat = tonumber(redis.call('HGET', key, p .. 'disconnected_at_ms') or '0')
if dat == 0 or (tonumber(ARGV[4]) - dat) < tonumber(ARGV[3]) then return {0} end
local order = cjson.decode(redis.call('HGET', key, 'order'))
local kept = {}
for _, v in ipairs(order) do if v ~= pid then kept[#kept + 1] = v end end
for _, f in ipairs(redis.call('HKEYS', key)) do
  if string.sub(f, 1, #p) == p then redis.call('HDEL', key, f) end
end
if #kept == 0 then
  redis.call('DEL', key)
  redis.call('SREM', idx, code)
  return {2}
end
redis.call('HSET', key, 'order', cjson.encode(kept))
local new_host = ''
if redis.call('HGET', key, 'host') == pid then
  new_host = kept[1]
  redis.call('HSET', key, 'host', new_host)
end
redis.call('EXPIRE', key, tonumber(ARGV[5]))
return {1, new_host}
"""


def _register_scripts() -> None:
    global _create, _join, _finish, _drop
    _create = _r.register_script(_CREATE_LUA)
    _join = _r.register_script(_JOIN_LUA)
    _finish = _r.register_script(_FINISH_LUA)
    _drop = _r.register_script(_DROP_LUA)


# ─── Code generation (audit L1: secrets, not random) ───────────────────────

async def make_code() -> str:
    """Cryptographically-random 5-letter code, checked free against Redis."""
    while True:
        code = "".join(secrets.choice(string.ascii_uppercase) for _ in range(5))
        if not await _r.exists(_gkey(code)):
            return code


# ─── Lifecycle ──────────────────────────────────────────────────────────────

_LOCKED10 = json.dumps([False] * 10)


async def create_game(host_id: str, host_name: str, token_hash: str) -> str | None:
    """Create a game with the host as first player. None if the cap is hit."""
    code = await make_code()
    p = f"p:{host_id}:"
    pairs = [
        "target", 1, "round_num", 1, "started", 0, "round_over", 0, "paused", 0,
        "host", host_id, "round_seq", 0, "total_rolls", 0, "round_count", 0,
        "created_ms", now_ms(), "round_start_ms", 0, "round_advance_pending", 0,
        "order", json.dumps([host_id]),
        p + "name", host_name, p + "token_hash", token_hash,
        p + "dice", "[]", p + "locked", _LOCKED10,
        p + "wins", 0, p + "has_rolled", 0, p + "last_roll_ms", 0,
        p + "roll_count", 0, p + "disconnected", 0,
    ]
    res = await _create(keys=[_gkey(code), INDEX],
                        args=[code, MAX_GAMES, GAME_TTL, *pairs])
    return code if int(res) == 1 else None


async def add_player(code: str, pid: str, name: str, token_hash: str) -> int:
    """Add a player. Returns new player count, or a negative error code:
    -1 not found, -2 already started, -3 full."""
    return int(await _join(
        keys=[_gkey(code)],
        args=[pid, name, token_hash, "[]", _LOCKED10, MAX_PLAYERS_PER_GAME, GAME_TTL],
    ))


async def start_game(code: str) -> None:
    await _r.hset(_gkey(code), mapping={"started": 1, "round_count": 1})
    await deal(code)


async def advance_round(code: str, new_target: int) -> None:
    g = _gkey(code)
    pipe = _r.pipeline()
    pipe.hincrby(g, "round_num", 1)
    pipe.hincrby(g, "round_count", 1)
    pipe.hset(g, mapping={"target": new_target, "round_over": 0})
    await pipe.execute()
    await deal(code)


async def deal(code: str) -> None:
    """Reset every player's dice for a new round and stamp the round start."""
    from .drand import generate_dice

    g = _gkey(code)
    order = await _order(code)
    pipe = _r.pipeline()
    for pid in order:
        dice, drand_round = generate_dice(pid, 0, code, num_dice=10)
        p = f"p:{pid}:"
        mapping = {
            p + "dice": json.dumps(dice),
            p + "locked": _LOCKED10,
            p + "has_rolled": 0,
            p + "last_roll_ms": 0,
            p + "roll_count": 0,
        }
        if drand_round is not None:
            mapping[f"drand:{pid}:0"] = drand_round
        pipe.hset(g, mapping=mapping)
    pipe.hset(g, mapping={"round_start_ms": now_ms(), "round_seq": 0})
    pipe.expire(g, GAME_TTL)
    await pipe.execute()


# ─── Reads ──────────────────────────────────────────────────────────────────

async def exists(code: str) -> bool:
    return bool(await _r.exists(_gkey(code)))


async def active_count() -> int:
    return int(await _r.scard(INDEX))


async def all_codes() -> list[str]:
    return list(await _r.smembers(INDEX))


async def _order(code: str) -> list[str]:
    raw = await _r.hget(_gkey(code), "order")
    return json.loads(raw) if raw else []


_GAME_INT = {"target", "round_num", "round_seq", "total_rolls", "round_count",
             "created_ms", "round_start_ms", "pause_deadline_ms"}
_GAME_BOOL = {"started", "round_over", "paused", "round_advance_pending"}
_P_INT = {"wins", "roll_count", "last_roll_ms", "disconnected_at_ms"}
_P_BOOL = {"has_rolled", "disconnected"}


def _coerce_game(field: str, v: str):
    if field in _GAME_INT:
        return int(v)
    if field in _GAME_BOOL:
        return v == "1"
    return v


def _coerce_player(field: str, v: str):
    if field in ("dice", "locked"):
        return json.loads(v)
    if field in _P_INT:
        return int(v)
    if field in _P_BOOL:
        return v == "1"
    return v


async def snapshot(code: str) -> dict | None:
    """Rebuild the in-memory game dict shape that game.state_msg() consumes."""
    h = await _r.hgetall(_gkey(code))
    if not h:
        return None
    order = json.loads(h.get("order", "[]"))
    players: dict[str, dict] = {pid: {} for pid in order}
    game: dict = {}
    for k, v in h.items():
        if k.startswith("p:"):
            _, pid, field = k.split(":", 2)
            players.setdefault(pid, {})[field] = _coerce_player(field, v)
        elif k != "order":
            game[k] = _coerce_game(k, v)
    game["players"] = players
    return game


async def get_meta(code: str) -> dict | None:
    """Cheap scalar read for handler guards — avoids loading all players."""
    fields = ["started", "round_over", "paused", "host", "target", "round_num",
              "pause_deadline_ms", "round_advance_pending", "round_start_ms"]
    vals = await _r.hmget(_gkey(code), fields)
    if all(v is None for v in vals):
        return None
    out = {}
    for f, v in zip(fields, vals, strict=True):
        out[f] = None if v is None else _coerce_game(f, v)
    return out


async def get_player(code: str, pid: str) -> dict | None:
    fields = ["name", "dice", "locked", "wins", "has_rolled", "last_roll_ms",
              "roll_count", "disconnected", "token_hash"]
    p = f"p:{pid}:"
    vals = await _r.hmget(_gkey(code), [p + f for f in fields])
    if vals[0] is None:  # no name => no such player
        return None
    return {f: (None if v is None else _coerce_player(f, v))
            for f, v in zip(fields, vals, strict=True)}


# ─── Mutations ──────────────────────────────────────────────────────────────

async def set_player_after_roll(code: str, pid: str, *, dice, locked,
                                 roll_count: int, last_roll_ms: int,
                                 drand_round: int | None = None) -> None:
    p = f"p:{pid}:"
    mapping = {
        p + "dice": json.dumps(dice),
        p + "locked": json.dumps(locked),
        p + "has_rolled": 1,
        p + "roll_count": roll_count,
        p + "last_roll_ms": last_roll_ms,
    }
    if drand_round is not None:
        mapping[f"drand:{pid}:{roll_count}"] = drand_round
    await _r.hset(_gkey(code), mapping=mapping)


async def get_drand_round(code: str, pid: str, roll_count: int) -> int | None:
    """Look up the drand beacon round used for a specific roll (audit trail)."""
    val = await _r.hget(_gkey(code), f"drand:{pid}:{roll_count}")
    return int(val) if val else None


async def incr_counters(code: str) -> tuple[int, int]:
    """Bump total_rolls and round_seq atomically; return their new values."""
    g = _gkey(code)
    pipe = _r.pipeline()
    pipe.hincrby(g, "total_rolls", 1)
    pipe.hincrby(g, "round_seq", 1)
    total, seq = await pipe.execute()
    return int(total), int(seq)


async def try_finish_round(code: str) -> bool:
    """Atomic CAS: True only for the first caller to claim the round win."""
    return int(await _finish(keys=[_gkey(code)])) == 1


async def incr_wins(code: str, pid: str) -> int:
    return int(await _r.hincrby(_gkey(code), f"p:{pid}:wins", 1))


async def set_paused(code: str, paused: bool, deadline_ms: int | None) -> None:
    g = _gkey(code)
    if paused:
        await _r.hset(g, mapping={"paused": 1, "pause_deadline_ms": deadline_ms})
    else:
        pipe = _r.pipeline()
        pipe.hset(g, "paused", 0)
        pipe.hdel(g, "pause_deadline_ms")
        await pipe.execute()


async def set_round_advance_pending(code: str, pending: bool) -> None:
    await _r.hset(_gkey(code), "round_advance_pending", 1 if pending else 0)


async def pop_round_advance_pending(code: str) -> bool:
    """Read-and-clear the deferred-advance flag."""
    g = _gkey(code)
    val = await _r.hget(g, "round_advance_pending")
    if val == "1":
        await _r.hset(g, "round_advance_pending", 0)
        return True
    return False


async def mark_disconnected(code: str, pid: str) -> None:
    p = f"p:{pid}:"
    await _r.hset(_gkey(code), mapping={
        p + "disconnected": 1, p + "disconnected_at_ms": now_ms(),
    })


async def mark_connected(code: str, pid: str) -> None:
    p = f"p:{pid}:"
    pipe = _r.pipeline()
    pipe.hset(_gkey(code), p + "disconnected", 0)
    pipe.hdel(_gkey(code), p + "disconnected_at_ms")
    await pipe.execute()


async def transfer_host(code: str, new_host: str) -> None:
    await _r.hset(_gkey(code), "host", new_host)


async def drop_player(code: str, pid: str, grace_ms: int) -> dict:
    """Remove a disconnected player past grace (atomic, idempotent).

    Returns {"action": "noop"|"removed"|"deleted", "new_host": str|None}.
    """
    res = await _drop(keys=[_gkey(code), INDEX],
                      args=[code, pid, grace_ms, now_ms(), GAME_TTL])
    status = int(res[0])
    if status == 2:
        return {"action": "deleted", "new_host": None}
    if status == 1:
        new_host = res[1] if len(res) > 1 and res[1] else None
        return {"action": "removed", "new_host": new_host}
    return {"action": "noop", "new_host": None}


async def delete_game(code: str) -> None:
    pipe = _r.pipeline()
    pipe.delete(_gkey(code))
    pipe.srem(INDEX, code)
    await pipe.execute()


# ─── Abuse limits (audit H1) — enforced in Redis so they hold across instances ─

async def rate_allow(scope: str, ident: str, limit: int, window: float) -> bool:
    """Sliding-ish fixed-window limiter. True if under `limit` per `window`."""
    key = f"rl:{scope}:{ident}"
    n = await _r.incr(key)
    if n == 1:
        await _r.expire(key, int(window) or 1)
    return n <= limit


async def conn_incr(ip: str) -> int:
    key = f"conn:{ip}"
    n = await _r.incr(key)
    await _r.expire(key, 3600)  # safety TTL against leaked counts
    return int(n)


async def conn_decr(ip: str) -> None:
    key = f"conn:{ip}"
    n = await _r.decr(key)
    if n <= 0:
        await _r.delete(key)
