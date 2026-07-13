"""Discord bot notifier — publishes one living game card per game to a channel.

A bus subscriber (sibling of server/telemetry/live.py) that turns game
lifecycle events into a single, continuously-edited Discord embed per game:

    game_started  → POST a card (code, host, players, round/target), save its
                    message id.
    round_won     → bump the per-player win tally and PATCH the card's
                    scoreboard in place.
    game_ended    → final PATCH (standings, rounds, rolls, duration), then drop
                    the card.

Why a bot (vs a webhook): the card posts under the bot's own identity in the
target channel via the REST API (`Authorization: Bot <token>`), no gateway
connection needed for publish-only v1. Reactions / threads / slash-commands are
a clean additive step on top later.

Multi-instance correctness: there are no sticky sessions, so a single game's
events can fire on different instances. The card's message id and running win
tally therefore live in Redis (`discord:card:{code}`), edited with the same
atomic HSET/HINCRBY pattern gamestore uses — so whichever instance handles
`round_won` edits the message some other instance created on `game_started`,
and the final standings survive the game's deletion from Redis.

Failures are swallowed and metered: Discord being down never touches gameplay
(emit() is fire-and-forget; this loop only ever reads the bus + Redis).
"""
import asyncio
import json
import logging
from datetime import UTC, datetime

import httpx

from server import gamestore
from server.config import (
    DISCORD_API_BASE,
    DISCORD_APPLICATION_ID,
    DISCORD_BOT_TOKEN,
    DISCORD_CHANNEL_ID,
    DISCORD_ENABLED,
    DISCORD_GUILD_ID,
    GAME_TTL,
)
from server.telemetry import metrics
from server.telemetry.bus import bus

log = logging.getLogger("tensies.discord")

# Drain window: events are gathered for this long, then each affected game is
# rendered at most once — so a burst collapses into a single PATCH and we stay
# well under Discord's per-channel edit rate limit.
COLLECT_WINDOW_S = 0.4

# Embed accent colours.
COLOR_ACTIVE = 0x5865F2  # blurple — game in progress
COLOR_ENDED = 0x57F287   # green — game over

_END_REASONS = {
    "all_dropped": "everyone left",
    "pause_timeout": "paused too long",
    "host_ended": "host ended it",
}

_task: asyncio.Task | None = None
_client: httpx.AsyncClient | None = None


# ─── Lifecycle ──────────────────────────────────────────────────────────────
async def start() -> None:
    """Subscribe to the bus and spawn the notifier loop (no-op when disabled)."""
    global _task, _client
    if not DISCORD_ENABLED:
        return
    if not DISCORD_BOT_TOKEN or not DISCORD_CHANNEL_ID:
        log.warning(
            "DISCORD_ENABLED is set but DISCORD_BOT_TOKEN/DISCORD_CHANNEL_ID is "
            "missing — Discord notifier not started."
        )
        return
    _client = httpx.AsyncClient(
        base_url=DISCORD_API_BASE,
        headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"},
        timeout=httpx.Timeout(10.0),
    )
    q = bus.subscribe(maxsize=10_000)
    _task = asyncio.create_task(_run(q), name="discord.notifier")
    log.info("discord notifier started  channel=%s", DISCORD_CHANNEL_ID)
    await register_commands()


async def stop() -> None:
    global _task, _client
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):
            pass
        _task = None
    if _client is not None:
        await _client.aclose()
        _client = None


# ─── Drain loop ─────────────────────────────────────────────────────────────
async def _run(q: asyncio.Queue) -> None:
    while True:
        try:
            metrics.telemetry_queue_depth.labels(subscriber="discord").set(q.qsize())
            events = await _collect(q)
            if not events:
                continue
            await _process(events)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("discord notifier loop error")
            await asyncio.sleep(0.5)


async def _collect(q: asyncio.Queue) -> list[dict]:
    """Block for the first event, then gather any others within the window."""
    first = await q.get()
    events = [first]
    loop = asyncio.get_event_loop()
    deadline = loop.time() + COLLECT_WINDOW_S
    while True:
        remaining = deadline - loop.time()
        if remaining <= 0:
            break
        try:
            events.append(await asyncio.wait_for(q.get(), timeout=remaining))
        except TimeoutError:
            break
    return events


async def _process(events: list[dict]) -> None:
    """Apply every event's state to Redis, then render each touched game once."""
    ended: dict[str, bool] = {}  # game_code → seen a game_ended this batch
    for ev in events:
        code = await _apply(ev)
        if code is None:
            continue
        ended[code] = ended.get(code, False) or ev["type"] == "game_ended"
    for code, is_end in ended.items():
        try:
            await _render(code, is_end)
        except Exception:
            log.exception("discord render failed  game=%s", code)


# ─── State (Redis card hash) ────────────────────────────────────────────────
def _ckey(code: str) -> str:
    return f"discord:card:{code}"


async def _apply(ev: dict) -> str | None:
    """Fold one event into the game's Redis card. Returns the affected code."""
    t = ev["type"]
    code = ev.get("game_code")
    if not code:
        return None
    r = gamestore.client()
    key = _ckey(code)

    if t == "game_started":
        snap = await gamestore.snapshot(code)
        mapping = {"target": ev.get("target") or "", "round": 1}
        if snap:
            mapping.update(_roster_fields(snap))
        await r.hset(key, mapping=mapping)
        await r.expire(key, GAME_TTL)
        return code

    if t == "round_won":
        name = ev.get("name") or "?"
        await r.hincrby(key, f"w:{name}", 1)
        mapping = {
            "round": ev.get("round_num") or "",
            "target": ev.get("target") or "",
            "last_winner": name,
        }
        # Backfill the roster if we never saw game_started (notifier joined late).
        if not await r.hexists(key, "host"):
            snap = await gamestore.snapshot(code)
            if snap:
                mapping.update(_roster_fields(snap))
        await r.hset(key, mapping=mapping)
        await r.expire(key, GAME_TTL)
        return code

    if t == "game_ended":
        await r.hset(key, mapping={
            "ended": 1,
            "reason": ev.get("reason") or "",
            "duration_ms": ev.get("duration_ms") or 0,
            "round_count": ev.get("round_count") or 0,
            "total_rolls": ev.get("total_rolls") or 0,
        })
        await r.expire(key, GAME_TTL)
        return code

    return None


def _roster_fields(snap: dict) -> dict:
    """Pull host name + ordered roster out of a game snapshot for the card."""
    players = snap.get("players", {})
    host_pid = snap.get("host")
    host_name = players.get(host_pid, {}).get("name") if host_pid else None
    roster = [p.get("name", "?") for p in players.values()]
    return {"host": host_name or "?", "players": json.dumps(roster)}


# Durable map message_id -> game_code, used by the /verify slash command. A
# thread started from the card shares the card's message id, so a /verify in
# that thread arrives with channel_id == this message id. Kept far longer than
# the card itself (which is deleted on game end) so verification still resolves.
MSG_MAP_TTL = 60 * 60 * 24 * 30  # 30 days


def _msg_key(message_id: str) -> str:
    return f"discord:game_by_msg:{message_id}"


async def game_for_message(message_id: str) -> str | None:
    """Resolve a card message / thread id back to its game code (or None)."""
    return await gamestore.client().get(_msg_key(message_id))


# ─── Render (POST / PATCH the card) ─────────────────────────────────────────
async def _render(code: str, ended: bool) -> None:
    r = gamestore.client()
    key = _ckey(code)
    card = await r.hgetall(key)
    if not card:
        return
    embed = _build_final_embed(code, card) if ended else _build_active_embed(code, card)
    mid = card.get("mid")
    if mid:
        await _patch(mid, embed)
    else:
        mid = await _post(embed)
        if mid:
            await r.hset(key, "mid", mid)
            await r.set(_msg_key(mid), code, ex=MSG_MAP_TTL)
    if ended:
        if mid:
            await r.set(_msg_key(mid), code, ex=MSG_MAP_TTL)
        await r.delete(key)



def _standings(card: dict) -> list[tuple[str, int]]:
    """All known players with their round-win counts, best first."""
    wins = {k[2:]: int(v) for k, v in card.items() if k.startswith("w:")}
    roster = json.loads(card["players"]) if card.get("players") else []
    names: list[str] = []
    for n in roster + list(wins.keys()):
        if n not in names:
            names.append(n)
    rows = [(n, wins.get(n, 0)) for n in names]
    rows.sort(key=lambda row: (-row[1], row[0].lower()))
    return rows


def _scoreboard_text(card: dict) -> str:
    rows = _standings(card)
    if not rows:
        return "_No players yet_"
    medals = ["🥇", "🥈", "🥉"]
    lines = []
    for i, (name, wins) in enumerate(rows):
        prefix = medals[i] if i < len(medals) and wins > 0 else "•"
        lines.append(f"{prefix} **{name}** — {wins}")
    return "\n".join(lines)


def _base_embed(title: str, color: int, card: dict) -> dict:
    fields = [{"name": "Host", "value": card.get("host") or "?", "inline": True}]
    roster = json.loads(card["players"]) if card.get("players") else []
    if roster:
        fields.append({"name": "Players", "value": str(len(roster)), "inline": True})
    return {
        "title": title,
        "color": color,
        "fields": fields,
        "footer": {"text": "Tensies"},
        "timestamp": datetime.now(UTC).isoformat(),
    }


def _build_active_embed(code: str, card: dict) -> dict:
    embed = _base_embed(f"🎲 Tensies — game {code}", COLOR_ACTIVE, card)
    round_num = card.get("round") or "1"
    target = card.get("target")
    where = f"Round {round_num}" + (f" · target {target}" if target else "")
    embed["fields"].append({"name": "In progress", "value": where, "inline": False})
    embed["fields"].append(
        {"name": "Scoreboard", "value": _scoreboard_text(card), "inline": False}
    )
    return embed


def _build_final_embed(code: str, card: dict) -> dict:
    embed = _base_embed(f"🏁 Game over — {code}", COLOR_ENDED, card)
    rows = _standings(card)
    if rows and rows[0][1] > 0:
        embed["description"] = f"🏆 **{rows[0][0]}** takes it"
    embed["fields"].append(
        {"name": "Final standings", "value": _scoreboard_text(card), "inline": False}
    )
    rounds = card.get("round_count") or "0"
    rolls = card.get("total_rolls") or "0"
    embed["fields"].append({"name": "Rounds", "value": str(rounds), "inline": True})
    embed["fields"].append({"name": "Total rolls", "value": str(rolls), "inline": True})
    dur = _fmt_duration(card.get("duration_ms"))
    if dur:
        embed["fields"].append({"name": "Duration", "value": dur, "inline": True})
    reason = _END_REASONS.get(card.get("reason", ""))
    if reason:
        embed["footer"] = {"text": f"Tensies · {reason}"}
    return embed


def _fmt_duration(ms) -> str | None:
    try:
        secs = int(ms) // 1000
    except (TypeError, ValueError):
        return None
    if secs <= 0:
        return None
    m, s = divmod(secs, 60)
    return f"{m}m {s}s" if m else f"{s}s"


# ─── Discord REST ───────────────────────────────────────────────────────────
async def _post(embed: dict) -> str | None:
    r = await _request(
        "POST",
        f"/channels/{DISCORD_CHANNEL_ID}/messages",
        {"embeds": [embed], "allowed_mentions": {"parse": []}},
    )
    if r is not None and r.status_code < 300:
        metrics.discord_messages_total.labels(op="create").inc()
        try:
            return r.json()["id"]
        except (ValueError, KeyError):
            return None
    metrics.discord_failures_total.labels(op="create").inc()
    return None


async def _patch(message_id: str, embed: dict) -> None:
    r = await _request(
        "PATCH",
        f"/channels/{DISCORD_CHANNEL_ID}/messages/{message_id}",
        {"embeds": [embed], "allowed_mentions": {"parse": []}},
    )
    if r is not None and r.status_code < 300:
        metrics.discord_messages_total.labels(op="edit").inc()
    else:
        metrics.discord_failures_total.labels(op="edit").inc()


async def _request(method: str, path: str, body: dict | list) -> httpx.Response | None:
    """One Discord API call, honouring a 429 retry-after at most twice."""
    if _client is None:
        return None
    for _ in range(3):
        try:
            r = await _client.request(method, path, json=body)
        except Exception as e:
            log.debug("discord request failed: %s", e)
            return None
        if r.status_code == 429:
            retry_after = _retry_after(r)
            log.warning("discord rate-limited; retry in %.2fs", retry_after)
            await asyncio.sleep(retry_after)
            continue
        if r.status_code >= 300:
            log.warning("discord %s %s -> %d: %s",
                        method, path, r.status_code, r.text[:200])
        return r
    return None


def _retry_after(r: httpx.Response) -> float:
    try:
        return float(r.json().get("retry_after", 1.0))
    except Exception:
        try:
            return float(r.headers.get("Retry-After", "1"))
        except (TypeError, ValueError):
            return 1.0


# ─── Slash commands ─────────────────────────────────────────────────────────
_VERIFY_COMMAND = {
    "name": "verify",
    "type": 1,  # CHAT_INPUT
    "description": "Show Roll Trust verification for this game's thread",
}


async def register_commands() -> None:
    """Register /verify to the configured guild (instant). No-op if unconfigured.

    A guild-scoped bulk PUT registers the command on that one server immediately
    (global registration takes ~1h). Idempotent — safe to run on every boot.
    """
    if not (DISCORD_APPLICATION_ID and DISCORD_GUILD_ID):
        log.info("discord slash commands not registered (app id / guild id unset)")
        return
    r = await _request(
        "PUT",
        f"/applications/{DISCORD_APPLICATION_ID}/guilds/{DISCORD_GUILD_ID}/commands",
        [_VERIFY_COMMAND],
    )
    if r is not None and r.status_code < 300:
        log.info("discord /verify registered to guild %s", DISCORD_GUILD_ID)
    else:
        log.warning("discord command registration failed: %s",
                    r.status_code if r is not None else "no response")


async def followup_edit(interaction_token: str, embed: dict) -> None:
    """Replace a deferred interaction's response with the final embed.

    Targets the interaction webhook's @original message, so it lands in exactly
    the channel/thread the command was invoked in. The interaction token alone
    authorises this — no bot auth needed — so it works even when the notifier
    client isn't running.
    """
    url = (f"{DISCORD_API_BASE}/webhooks/{DISCORD_APPLICATION_ID}/"
           f"{interaction_token}/messages/@original")
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.patch(url, json={"embeds": [embed],
                                            "allowed_mentions": {"parse": []}})
        if resp.status_code >= 300:
            log.warning("discord followup -> %s: %s", resp.status_code, resp.text[:200])
    except Exception as e:
        log.warning("discord followup failed: %s", e)
