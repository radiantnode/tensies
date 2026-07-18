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

import redis.asyncio as aioredis

from server.config import (
    CLAIM_TTL,
    GAME_TTL,
    MAX_GAMES,
    MAX_PLAYERS_PER_GAME,
    REDIS_URL,
    log,
)

INDEX = "games:index"
GEO_INDEX = "games:geo"  # GEO sorted set of discoverable lobbies (checked-in venue coords)

_r: aioredis.Redis | None = None

# Lua scripts, registered on init().
_create = _join = _finish = _drop = _restamp = _end_paused = _rate = None


def client() -> aioredis.Redis:
    assert _r is not None, "gamestore.init() must be called first"
    return _r


def now_ms() -> int:
    return int(time.time() * 1000)


def _gkey(code: str) -> str:
    return f"game:{code}"


async def init() -> None:
    """Connect to Redis and register Lua scripts. Fails loudly if unreachable."""
    global _r
    _r = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        await _r.ping()
    except Exception as e:  # noqa: BLE001 — surface a clear, actionable error
        raise RuntimeError(
            f"Cannot reach Redis at {REDIS_URL}. Redis is required to run "
            f"Tensies; start one or set REDIS_URL. ({e})"
        ) from e
    _register_scripts()
    log.info("gamestore connected  redis=%s", REDIS_URL)


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
-- KEYS[1]=game key  KEYS[2]=index  KEYS[3]=geo index
-- ARGV: code, pid, grace_ms, now_ms, ttl
-- Removes a disconnected player past the grace window. Idempotent: a second
-- caller (local task vs reaper) finds the player gone and no-ops.
-- Returns {0}=noop, {1,new_host}=removed (new_host '' if unchanged),
-- {2}=removed and game deleted (was last player).
local key, idx, geo, code, pid = KEYS[1], KEYS[2], KEYS[3], ARGV[1], ARGV[2]
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
  redis.call('ZREM', geo, code)   -- prune the discovery blip with the game
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


_RATE_LUA = """
local n = redis.call('INCR', KEYS[1])
-- Guarantee a TTL atomically so a crash between INCR and EXPIRE can't leave a
-- TTL-less key that throttles an identity forever. TTL < 0 means no expiry
-- (-1) — set it; also self-heals any pre-existing leaked key.
if redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return n
"""


def _register_scripts() -> None:
    global _create, _join, _finish, _drop, _restamp, _end_paused, _rate
    _create = _r.register_script(_CREATE_LUA)
    _join = _r.register_script(_JOIN_LUA)
    _finish = _r.register_script(_FINISH_LUA)
    _drop = _r.register_script(_DROP_LUA)
    _restamp = _r.register_script(_RESTAMP_LUA)
    _end_paused = _r.register_script(_END_PAUSED_LUA)
    _rate = _r.register_script(_RATE_LUA)


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
        "place_id", "", "place_name", "",
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
        elif k.startswith("drand:"):
            # Per-roll provable-fairness audit fields — one accumulates per roll.
            # They are read directly via get_drand_round() (HGET), never through
            # this snapshot, so keep them out of the rebuilt game dict: otherwise
            # every broadcast state frame would carry O(total rolls) of them.
            continue
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

async def set_player_photo(code: str, pid: str, photo: str) -> None:
    """Store a signed-in player's avatar URL on their game slot. Read back
    generically by snapshot() as players[pid]['photo']."""
    await _r.hset(_gkey(code), f"p:{pid}:photo", photo)


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


_RESTAMP_LUA = """
local p = 'p:' .. ARGV[1] .. ':'
if redis.call('HGET', KEYS[1], p .. 'disconnected') == '1' then
  redis.call('HSET', KEYS[1], p .. 'disconnected_at_ms', ARGV[2])
  return 1
end
return 0
"""

# Atomic claim of a pause-cap ending: paused + past deadline -> delete, else
# no-op. Only the caller that wins the delete may emit/broadcast, so with N
# instances the ending stays exactly-once (same gate-on-Lua-result pattern
# as the drop path).
_END_PAUSED_LUA = """
if redis.call('HGET', KEYS[1], 'paused') ~= '1' then return 0 end
local dl = tonumber(redis.call('HGET', KEYS[1], 'pause_deadline_ms') or '0')
if dl == 0 or tonumber(ARGV[2]) < dl then return 0 end
redis.call('DEL', KEYS[1])
redis.call('SREM', KEYS[2], ARGV[1])
return 1
"""


async def try_end_paused(code: str) -> bool:
    """CAS-end a paused game past its deadline. True iff this caller won."""
    res = await _end_paused(keys=[_gkey(code), INDEX], args=[code, now_ms()])
    return bool(res)


async def restamp_disconnect(code: str, pid: str) -> bool:
    """Refresh disconnected_at_ms — only if the player is still disconnected.

    Used on pause-resume so the post-resume grace is measured from the resume,
    not from the original mid-pause disconnect. Conditional inside Redis: a
    player who reconnected between our snapshot and this call must NOT be
    flipped back to disconnected (an unconditional mark_disconnected would).
    """
    res = await _restamp(keys=[_gkey(code)], args=[pid, now_ms()])
    return bool(res)


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
    res = await _drop(keys=[_gkey(code), INDEX, GEO_INDEX],
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
    pipe.zrem(GEO_INDEX, code)  # prune the discovery blip with the game
    await pipe.execute()


# ─── Nearby discovery (GPS) ──────────────────────────────────────────────────
# GEO_INDEX is a Redis GEO sorted set (member = game code) of lobbies checked in
# to a public place. The stored point is the venue's own public coordinates — a
# real place, not the host's home — so there's nothing private to protect: only
# distance and bearing surface to clients, and the point is the same for anyone
# standing at that venue.


async def _geo_set(code: str, lon: float, lat: float) -> None:
    """Place the game's single radar point at the checked-in venue's coords."""
    await _r.geoadd(GEO_INDEX, (lon, lat, code))


async def geo_remove(code: str) -> None:
    await _r.zrem(GEO_INDEX, code)


async def geo_members() -> list[str]:
    """All indexed codes — used by the reaper to reconcile orphaned blips."""
    return list(await _r.zrange(GEO_INDEX, 0, -1))


async def prune_orphan_geo() -> int:
    """Drop discovery blips whose game hash has vanished (crashed instance / TTL
    expiry) — a GEO set has no per-member TTL of its own. Batches the EXISTS
    probes into one pipeline and removes the dead codes in one ZREM, rather than
    a round-trip per member. Returns how many were pruned."""
    members = await geo_members()
    if not members:
        return 0
    pipe = _r.pipeline()
    for code in members:
        pipe.exists(_gkey(code))
    present = await pipe.execute()
    dead = [code for code, ok in zip(members, present, strict=True) if not ok]
    if dead:
        await _r.zrem(GEO_INDEX, *dead)
    return len(dead)


async def geo_search(lon: float, lat: float, radius_m: float,
                     limit: int) -> list[tuple[str, float, float, float]]:
    """Codes within radius_m of (lon, lat), nearest first.

    Returns [(code, distance_m, plon, plat), ...] — the stored venue point, so
    the caller can compute a bearing to it.
    """
    rows = await _r.geosearch(
        GEO_INDEX, longitude=lon, latitude=lat,
        radius=radius_m, unit="m", sort="ASC", count=limit,
        withdist=True, withcoord=True,
    )
    out: list[tuple[str, float, float, float]] = []
    for row in rows:
        code, dist, (plon, plat) = row[0], float(row[1]), row[2]
        out.append((code, dist, float(plon), float(plat)))
    return out


# A game is discoverable iff it's checked in to a place: set_place indexes it at
# the venue's exact public coords, clear_place removes it. _recompute_geo is the
# single writer that keeps the GEO index in sync with the place fields.

async def _recompute_geo(code: str) -> None:
    """Set (or clear) the game's radar point from its checked-in place. Checked
    in → indexed at the venue's coords; not → removed from the index."""
    place_id, plat, plon = await _r.hmget(
        _gkey(code), ["place_id", "place_lat", "place_lng"])
    if place_id and plat is not None and plon is not None:
        await _geo_set(code, float(plon), float(plat))
    else:
        await geo_remove(code)


async def set_place(code: str, place_id: str, name: str,
                    lat: float, lon: float,
                    photo_ref: str | None = None,
                    place_type: str | None = None) -> None:
    """Check the game in to a public place at its exact coordinates."""
    await _r.hset(_gkey(code), mapping={
        "place_id": place_id, "place_name": name,
        "place_lat": lat, "place_lng": lon,
        "place_photo": photo_ref or "", "place_type": place_type or "",
        "place_ts": int(time.time() * 1000)})
    await _recompute_geo(code)


async def get_place(code: str) -> dict | None:
    """Read the checked-in place ({place_id, place_name, place_type, place_ts})
    without mutating, or None if the game isn't checked in. Lets a caller
    snapshot the check-in before a destructive drop that would wipe the hash."""
    place_id, place_name, place_type, place_ts = await _r.hmget(
        _gkey(code), ["place_id", "place_name", "place_type", "place_ts"])
    if not place_id:
        return None
    return {"place_id": place_id, "place_name": place_name or "",
            "place_type": place_type or "",
            "place_ts": int(place_ts) if place_ts else None}


async def clear_place(code: str) -> dict | None:
    """Check the game out of its place: drop the place fields and prune the
    radar blip. Returns what was cleared (see get_place) so the caller can emit
    a checked_out event, or None if the game wasn't checked in."""
    info = await get_place(code)
    await _r.hdel(_gkey(code), "place_id", "place_name", "place_lat", "place_lng",
                  "place_photo", "place_type", "place_ts")
    await _recompute_geo(code)
    return info


async def discovery_card(code: str) -> dict | None:
    """Cheap read for the discovery endpoint — host name + avatar + player count
    + started flag + checked-in place, without loading every player via
    snapshot(). None if the game has vanished. Two steps: the host pid comes
    from `host`, then its name/photo."""
    started, host, order, place_id, place_name, place_photo = await _r.hmget(
        _gkey(code), ["started", "host", "order", "place_id", "place_name",
                      "place_photo"])
    if host is None or order is None:
        return None
    host_name, host_photo = await _r.hmget(
        _gkey(code), [f"p:{host}:name", f"p:{host}:photo"])
    try:
        player_count = len(json.loads(order))
    except (TypeError, ValueError):
        player_count = 0
    return {
        "host_name": host_name or "Someone",
        "photo": host_photo,  # None for anonymous hosts; client uses a fallback
        "player_count": player_count,
        "started": started == "1",
        "place_id": place_id or None,
        "place_name": place_name or None,
        "place_photo": place_photo or None,
    }


# ─── Abuse limits (audit H1) — enforced in Redis so they hold across instances ─

async def rate_allow(scope: str, ident: str, limit: int, window: float) -> bool:
    """Sliding-ish fixed-window limiter. True if under `limit` per `window`.

    INCR + EXPIRE run in one atomic Lua script so a crash can't split them and
    strand a TTL-less key that would throttle the identity forever."""
    key = f"rl:{scope}:{ident}"
    n = await _rate(keys=[key], args=[int(window) or 1])
    return int(n) <= limit


# ─── Stat-claim ownership tokens ───────────────────────────────────────────────
# An anonymous player's pid leaks to co-players via state_msg, so the pid alone
# can't authorise transferring that pid's player_stats onto a new account (a
# co-player could harvest it and claim someone else's stats). The private
# reconnect token never leaves the owner's client, so we keep its hash keyed by
# pid — outliving the ephemeral game — and require the token at registration.

def _claim_key(pid: str) -> str:
    return f"claim:{pid}"


async def record_claim(pid: str, token_hash: str) -> None:
    """Remember an anonymous pid's reconnect-token hash so a later registration
    can prove ownership of its stats. Self-expiring (CLAIM_TTL)."""
    await _r.set(_claim_key(pid), token_hash, ex=CLAIM_TTL)


async def verify_claim(pid: str, token: str) -> bool:
    """True if `token` matches the stored claim hash for `pid`."""
    if not pid or not token:
        return False
    from .game import verify_token  # local import avoids an import cycle
    return verify_token(await _r.get(_claim_key(pid)), token)


async def clear_claim(pid: str) -> None:
    """Drop a claim once its stats have been transferred (single use)."""
    await _r.delete(_claim_key(pid))


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
