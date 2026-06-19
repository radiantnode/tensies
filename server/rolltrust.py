"""Roll Trust verification — shared logic.

Batch-verifies every drand-backed roll of a completed game: pull the roll
events (with their beacon round) from the Postgres telemetry log, fetch the
public drand beacons, re-derive each roll via HMAC-SHA256, and compare to the
stored values. Used by the HTTP route (GET /api/game/{code}/verify) and the
Discord /verify slash command, so both share one implementation.

See docs/ROLL_TRUST.md for the full scheme.
"""
import json

import httpx

from server.config import DRAND_BASE_URL, DRAND_CHAIN_HASH
from server.drand import derive_dice
from server.telemetry import store


async def verify_game(code: str) -> dict:
    """Return {game_code, total, verified, failed, no_beacon, players:{pid:{...}}}.

    Caller is responsible for checking TELEMETRY_ENABLED — without the event log
    there is nothing to verify.
    """
    code = code.upper().strip()
    async with store.pool().acquire() as con:
        rows = await con.fetch(
            """
            SELECT e.user_id,
                   COALESCE(u.username, ps.name_last, e.user_id) AS name,
                   payload->>'drand_round' AS drand_round,
                   payload->>'round_roll_num' AS roll_count,
                   payload->'rolled_values' AS rolled_values
              FROM events e
              LEFT JOIN users u ON u.id::text = e.user_id
              LEFT JOIN player_stats ps ON ps.user_id = e.user_id
             WHERE e.game_code = $1 AND e.type = 'roll'
               AND payload->>'drand_round' IS NOT NULL
             ORDER BY e.ts
            """,
            code,
        )
    if not rows:
        return {"game_code": code, "total": 0, "verified": 0, "failed": 0,
                "no_beacon": 0, "players": {}}

    unique_rounds: set[int] = set()
    rolls = []
    for r in rows:
        dr = int(r["drand_round"])
        rc = int(r["roll_count"])
        vals = r["rolled_values"]
        if isinstance(vals, str):
            vals = json.loads(vals)
        rolls.append({"user_id": r["user_id"], "name": r["name"],
                      "drand_round": dr, "roll_count": rc, "rolled_values": vals})
        unique_rounds.add(dr)

    # Batch-fetch beacons from the public drand API.
    beacons: dict[int, str | None] = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        for rnd in sorted(unique_rounds):
            try:
                resp = await client.get(f"{DRAND_BASE_URL}/{DRAND_CHAIN_HASH}/public/{rnd}")
                beacons[rnd] = resp.json()["randomness"] if resp.status_code == 200 else None
            except Exception:
                beacons[rnd] = None

    verified = failed = no_beacon = 0
    players: dict[str, dict] = {}
    for roll in rolls:
        pid = roll["user_id"]
        p = players.setdefault(pid, {"name": roll["name"], "total": 0, "verified": 0, "failed": 0})
        p["total"] += 1
        randomness = beacons.get(roll["drand_round"])
        if randomness is None:
            no_beacon += 1
            continue
        derived = derive_dice(randomness, pid, roll["roll_count"], code, num_dice=10)
        actual = roll["rolled_values"]
        if derived[:len(actual)] == actual:
            verified += 1
            p["verified"] += 1
        else:
            failed += 1
            p["failed"] += 1

    return {"game_code": code, "total": len(rolls), "verified": verified,
            "failed": failed, "no_beacon": no_beacon, "players": players}
