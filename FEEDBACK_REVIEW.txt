# Tensies — Review of the External Feedback

A second opinion on the "Tensies Repo Analysis" feedback, after verifying every
specific technical claim against the actual code in this repository.

---

## Overall verdict

The external feedback is fair and well-calibrated. It is not generic AI fluff —
almost every concrete claim checks out against the code. The scores feel right,
and it draws the correct top-level distinction:

> An excellent prototype with unusually mature observability — **not** a hardened
> internet-facing service.

I agree with that framing and with essentially all seven "biggest issues." A few
I would sharpen, one the review missed, and a couple I would soften.

---

## Claims I verified as CORRECT

### 1. Reconnect identity can be hijacked  — REAL, highest priority
`handle_reconnect` (`server/ws.py:130`) authenticates on nothing but
`player_id` + `game_code` + the `disconnected` flag. And `state_msg`
(`server/game.py:114`) keys the `players` dict by pid and ships `host` as a pid,
so every connected client already knows every opponent's "credential." Any client
who has seen a state snapshot can reconnect as another player during the grace
window.
Proposed fix (private, hashed reconnect token) is exactly right.

### 2. Single-process only — CONFIRMED
Module-level dicts in `server/state.py`. Worth sharpening: it is not merely
"can't scale to multiple pods" — you **cannot even run `uvicorn --workers >1`**.
Single worker is a hard, undocumented requirement.

### 3. Docker/deployment is dev-oriented — CONFIRMED
`--reload`, full-repo bind mount, `:latest` tags, `admin/admin`, anonymous
Grafana viewer, container runs as root, Postgres published on `5432`.

### 4. Public endpoints leak data — CONFIRMED
`/metrics` and all `/stats/*` routes (`server/routes.py`) are unauthenticated and
expose user_ids, names, and game codes.

### 5. WebSocket input is loosely validated — CONFIRMED
`json.loads` with no schema, no message-size cap, no Origin check. Rate limiting
is per-player-per-roll only; nothing throttles create/connection flooding.

### 6. Telemetry writer transaction trap — CONFIRMED, and WORSE than stated
`_flush` (`server/telemetry/writer.py:80`) runs the `executemany` event insert
AND every rollup handler inside a single `con.transaction()` with no per-statement
savepoints. When a handler raises, asyncpg aborts the whole transaction; the
`try/except` around each handler swallows the exception but cannot heal the
transaction, so every later handler fails AND the commit rolls back the event
insert too. This directly contradicts the documented promise that "events without
a handler still land in the events table." One rollup bug can lose the entire
batch, including the append-only log.

### 7. Stats semantics wrong/unfinished — CONFIRMED
- `total_rounds` is incremented only in `_h_round_won`, in lockstep with
  `total_wins` — the two columns are always equal. The name is misleading; it
  means "rounds won."
- `total_games` is declared in the schema (`migrations/001_init.sql:102`) and is
  **never written by any handler.**

### Duplicate `player_left` — CONFIRMED
Emitted once on disconnect (`reason="disconnect"`, `ws.py`) and again from
`drop_player` (`reason="drop"`, `broadcast.py`). The handler branches on reason so
it is intentional, but two events sharing one `type` with opposite semantics is a
footgun.

### Client-side XSS posture — CONFIRMED, fair
`renderLobby` wraps names in `esc()`; everything else uses `textContent` or
numbers. Good enough for current usage.

### Missing README / CI / tests / lockfile / .dockerignore — ALL CONFIRMED

---

## What the review MISSED

It separately flags `GF_PANELS_DISABLE_SANITIZE_HTML: "true"` and notes that
player names are user-controlled, but never connects the two. Player names flow
into telemetry (`leader_name`, `live_players.name`) and are rendered on Grafana
dashboards. Disabled HTML sanitization + attacker-controlled names =
**stored XSS into the Grafana admin's browser.** That is a more concrete attack
than "sanitization is off."

---

## Where I would push back / soften

- **"Single-process is not fine for production."** For this product it is a
  legitimate design choice, not a defect. Games are ephemeral and intentionally
  die when everyone leaves; there is no active state worth persisting. The honest
  ask is "pin to one worker and document the ceiling," not "move to Redis." The
  review offers exactly this as its option (a), so we agree — I would just lead
  with it rather than frame single-node as a failing.

- **Severity of the reconnect hijack.** Technically correct, but the blast radius
  is griefing a disconnected player mid-round, not account/data theft (there are
  no accounts). Still the #1 thing to fix before any public exposure, but it is
  "don't ship publicly like this," not a five-alarm fire.

---

## Recommended priority order

1. **Reconnect token** — small, self-contained; closes the one genuine security
   hole. (`ws.py`, `game.py`)
2. **Split the writer transaction** — commit the append-only event insert, then
   run rollups best-effort (savepoint per handler, or separate transactions).
   Protects the source-of-truth log. (`telemetry/writer.py`)
3. **Fix telemetry semantics** — rename `total_rounds` -> `rounds_won` (or
   actually count rounds played) and either populate or drop `total_games`.
4. **`docker-compose.prod.yml`** + non-root Dockerfile + pinned image digests +
   auth on `/metrics` and `/stats/*`.
5. **Minimal CI** — ruff + a handful of `game.py` / `apply_roll` unit tests + one
   WS create/join/roll/reconnect integration test. The repo already has rich
   manual test logs; codifying a fraction prevents regressions.
6. Resource caps (max players/game, connections/IP, create rate limit) + README.

---

## Bottom line

The reviewer clearly read the code, not just the docs — the writer-transaction and
`total_rounds` findings are the kind of thing you only catch by reading the SQL. I
would trust this assessment and work the list top-down. The reconnect token (#1)
and the writer transaction split (#2) are the two highest-value, lowest-risk
changes.
