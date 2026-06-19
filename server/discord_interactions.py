"""Discord interactions endpoint — slash commands over HTTP.

Discord delivers each slash-command use as an Ed25519-signed POST to this route.
We verify the signature (Discord's hard requirement — it probes the endpoint
with good and bad signatures when you register the URL), ACK pings, and dispatch
commands.

v1 command: /verify — Roll Trust verification for the game whose card-thread the
command was invoked in. A thread started from a message shares that message's
id, and we keep a durable message_id → game_code map, so the interaction's
channel_id resolves straight to the game. The drand beacon fetch can exceed
Discord's 3-second response budget, so we DEFER and then edit the response via
the interaction token — which makes the reply land in the invoking thread.

Multi-instance safe: a plain stateless route, so any instance behind the load
balancer can serve any interaction.
"""
import asyncio
import json
import logging

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from server import discord
from server.config import DISCORD_PUBLIC_KEY, TELEMETRY_ENABLED
from server.rolltrust import verify_game
from server.telemetry import metrics

log = logging.getLogger("tensies.discord")

router = APIRouter()

# Discord interaction + response type numbers.
PING = 1
APPLICATION_COMMAND = 2
PONG = 1
CHANNEL_MESSAGE = 4
DEFERRED_CHANNEL_MESSAGE = 5
EPHEMERAL = 1 << 6  # 64 — visible only to the invoking user

COLOR_OK = 0x57F287    # green — all verified
COLOR_WARN = 0xFEE75C  # yellow — nothing to verify / missing beacons
COLOR_FAIL = 0xED4245  # red — a roll didn't match


def _verify_signature(public_key_hex: str, signature: str, timestamp: str, body: bytes) -> bool:
    try:
        key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex))
        key.verify(bytes.fromhex(signature), timestamp.encode() + body)
        return True
    except (InvalidSignature, ValueError):
        return False


@router.post("/discord/interactions")
async def interactions(request: Request) -> Response:
    if not DISCORD_PUBLIC_KEY:
        return JSONResponse({"error": "interactions not configured"}, status_code=503)
    sig = request.headers.get("X-Signature-Ed25519")
    ts = request.headers.get("X-Signature-Timestamp")
    body = await request.body()  # RAW bytes — signature is over the unparsed body
    if not sig or not ts or not _verify_signature(DISCORD_PUBLIC_KEY, sig, ts, body):
        return Response("invalid request signature", status_code=401)

    data = json.loads(body)
    itype = data.get("type")
    if itype == PING:
        return JSONResponse({"type": PONG})
    if itype == APPLICATION_COMMAND:
        return await _handle_command(data)
    return JSONResponse({"type": PONG})


async def _handle_command(data: dict) -> Response:
    name = (data.get("data") or {}).get("name")
    if name != "verify":
        return _ephemeral("Unknown command.")

    # The command's channel_id is the thread it was run in; a thread opened from
    # a card shares the card's message id, which we mapped to the game code.
    channel_id = data.get("channel_id")
    code = await discord.game_for_message(channel_id) if channel_id else None
    if not code:
        metrics.discord_interactions_total.labels(command="verify", outcome="no_game").inc()
        return _ephemeral(
            "Run `/verify` inside a game's thread — open a thread on a Tensies "
            "game card (or use the one created when the game ends) and try there."
        )
    if not TELEMETRY_ENABLED:
        metrics.discord_interactions_total.labels(command="verify", outcome="no_telemetry").inc()
        return _ephemeral("Roll Trust needs the telemetry event log, which is currently off.")

    # Defer now (ACK within 3s), then compute + edit the response in the thread.
    asyncio.create_task(_run_verify(code, data["token"]))
    metrics.discord_interactions_total.labels(command="verify", outcome="deferred").inc()
    return JSONResponse({"type": DEFERRED_CHANNEL_MESSAGE})


async def _run_verify(code: str, token: str) -> None:
    try:
        embed = _verify_embed(code, await verify_game(code))
    except Exception:
        log.exception("verify failed for %s", code)
        embed = {"title": f"Roll Trust — game {code}", "color": COLOR_FAIL,
                 "description": "Verification hit an error. Try again shortly."}
    await discord.followup_edit(token, embed)


def _verify_embed(code: str, res: dict) -> dict:
    total = res.get("total", 0)
    if total == 0:
        return {"title": f"Roll Trust — game {code}", "color": COLOR_WARN,
                "description": "No beacon-backed rolls recorded for this game "
                               "(it may predate Roll Trust, or ran with drand off)."}
    verified, failed, no_beacon = res.get("verified", 0), res.get("failed", 0), res.get("no_beacon", 0)
    clean = failed == 0
    color = COLOR_OK if clean and no_beacon == 0 else (COLOR_FAIL if failed else COLOR_WARN)
    head = ("✅ Every roll re-derives from the drand beacon" if clean
            else f"❌ {failed} roll(s) did NOT match the beacon")
    embed = {
        "title": f"Roll Trust — game {code}",
        "color": color,
        "description": head,
        "fields": [{"name": "Rolls", "value": f"{verified}/{total} verified", "inline": True}],
        "footer": {"text": "Re-derived from the public drand beacon"},
    }
    if no_beacon:
        embed["fields"].append({"name": "No beacon", "value": str(no_beacon), "inline": True})
    rows = sorted(res.get("players", {}).values(), key=lambda p: -p["total"])
    if rows:
        lines = []
        for p in rows:
            mark = "✅" if p["failed"] == 0 else "❌"
            extra = f" · {p['failed']} failed" if p["failed"] else ""
            lines.append(f"{mark} **{p['name']}** — {p['verified']}/{p['total']}{extra}")
        embed["fields"].append({"name": "Players", "value": "\n".join(lines), "inline": False})
    return embed


def _ephemeral(text: str) -> Response:
    return JSONResponse({"type": CHANNEL_MESSAGE, "data": {"content": text, "flags": EPHEMERAL}})
