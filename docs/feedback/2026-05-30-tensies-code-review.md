# Tensies — Code Review Transcript

**Date:** 2026-05-30

A three-turn exchange reviewing the Tensies codebase. An external reviewer
produced an initial repo analysis; Claude Code verified each claim against the
actual code and returned a second opinion; the external reviewer then agreed and
revised their priorities.

Content is reproduced verbatim from each turn — only organization and
attribution have been added.

**Participants:**
- **External reviewer** — original repo analysis (received via a ChatGPT share link)
- **Claude Code** — second-opinion review, verified against the repository

---

## Turn 1 — External reviewer

> ### Tensies Repo Analysis
>
> #### Verdict
>
> Yes, it's good. More specifically: it's a very solid prototype / hobby production app, especially for a real-time dice game. The architecture is clean, the code is understandable, the UX edge cases have clearly been worked through, and the telemetry stack is much more thoughtful than I expected.
>
> But I would not call it production-ready yet. The main gaps are security, deployment hardening, persistence/scaling, and formal automated tests/CI.
>
> Rough score:
>
> | Area | Score |
> |------|-------|
> | Game logic / UX flow | 8/10 |
> | Code organization | 8/10 |
> | Observability | 8.5/10 |
> | Security | 4.5/10 |
> | Production deployability | 4/10 |
> | Test maturity | 6/10 |
> | **Overall** | **7/10** |
>
> #### What's strong
>
> The repo is nicely split. main.py is just app wiring, with FastAPI lifespan startup/shutdown, static file handling, and router registration separated cleanly. Game logic is isolated in server/game.py, with separate functions for game creation, round dealing, rolling, target progression, and state snapshots.
>
> The game is server-authoritative, which is the right call. The client sends "roll intent," but the server owns the RNG and updates the dice state. The actual roll logic is simple and easy to reason about: unlocked dice are randomized, matching dice are locked, and the player wins when all 10 are matched.
>
> The WebSocket flow has some real care behind it. Outbound sends go through a shared send() helper with a per-session lock, which avoids interleaving frames between the pinger and normal game messages. The delayed broadcast design is also smart: the roller sees their result immediately, then the server waits for a roll_done ack or timeout before broadcasting to everyone else. That makes the animation model much cleaner.
>
> The reconnect flow is better than most prototypes. The client stores player/game identity locally, retries reconnects, and the server keeps disconnected players around during the grace window.
>
> The telemetry subsystem is probably the best part technically. There's an in-process event bus with bounded queues, non-blocking emit calls, a Postgres writer, Prometheus metrics, and Grafana Live push. The schema is also well thought out: append-only event log, rollups, live tables, monthly partitions, and useful indexes.
>
> There is evidence of real manual/system testing. The gameplay test log shows 19/19 passed, covering create/join/start/roll/rate-limit/reconnect/winner/round-transition flows. The telemetry test log shows 15/18 passed, 3 warnings, 0 failures, with roll events matching Prometheus exactly and no telemetry drops.
>
> #### Biggest issues
>
> **1. Reconnect identity can be hijacked**
>
> This is the most important security issue I saw.
>
> The server state message exposes player IDs because players is keyed by pid, and the host ID is also included in the state payload. Reconnect accepts a player_id and game_code, checks that the player is marked disconnected, and then assigns the new session to that old player ID.
>
> That means any client who has seen the game state knows the other players' IDs. If a player disconnects, another player could reconnect as them during the grace window.
>
> For a casual bar game, this may not matter much, but the fix is straightforward: use a separate private reconnect token that is only sent to that player, not exposed in the shared game state. Store {player_id, reconnect_token_hash} server-side and require both on reconnect.
>
> **2. It is single-process only**
>
> The current game state is module-level memory:
>
> ```python
> games: dict[str, dict] = {}
> connections: dict[str, dict[str, WebSocket]] = {}
> ```
>
> That means this app cannot safely run behind multiple workers, multiple pods, or multiple instances. A player connected to instance A and another connected to instance B would not share the same game state. App restarts also destroy active games, and the telemetry lifecycle explicitly truncates live rows on boot because in-memory game state does not survive restarts.
>
> That's fine for one container on one box. It's not fine for production scaling.
>
> **3. Docker/deployment config is very dev-oriented**
>
> docker-compose.yml mounts the whole repo into the container and runs Uvicorn with --reload, which is perfect for development but not production. Grafana and Prometheus use latest tags, Grafana has anonymous viewer access enabled, Grafana's admin password is admin, and HTML sanitization is disabled.
>
> The Dockerfile is minimal, but also not hardened: it uses a floating python:3.12-slim base, installs directly, copies the whole repo, and runs as root by default.
>
> For production, I'd add a separate docker-compose.prod.yml or actual deployment manifests with pinned image digests, non-root user, healthcheck, no reload, real secrets, no exposed Postgres, and no anonymous Grafana unless it's truly intended.
>
> **4. Public endpoints leak more than you probably want**
>
> /metrics is unauthenticated. The stats endpoints expose player IDs, names, game codes, recent rounds, and game/player summaries with no auth.
>
> That may be okay if this is intentionally public and casual. But if you put it on the internet, I'd at least think through whether leaderboards and player history should be public.
>
> **5. WebSocket input is loosely validated**
>
> The WS handler accepts raw JSON and dispatches based on action. Names are trimmed and capped, which is good. But there is no schema validation, origin check, IP/session-level throttling, max games per client, max players per game, or create/join rate limiting.
>
> The roll rate limit is per player and works for the game loop, but a bad actor could create lots of games or connections.
>
> **6. The telemetry writer has a transaction failure trap**
>
> The writer inserts a batch and then runs rollup handlers inside one transaction. It catches handler exceptions inside the transaction and continues. In Postgres, once a statement fails inside a transaction, the transaction is usually aborted until rollback. Catching the exception does not make the transaction healthy again.
>
> So one rollup bug can poison the whole batch. I'd either let the exception fail the transaction loudly, isolate rollups by event, or split append-only event insertion from best-effort rollup updates.
>
> **7. Some stats look semantically wrong or unfinished**
>
> player_stats has total_games and total_rounds. But from what I saw, total_rounds is incremented only for the round winner in _h_round_won, and total_games does not appear to be updated in the inspected writer path.
>
> If total_rounds means "rounds won," rename it. If it means "rounds played," this is wrong.
>
> #### Smaller quality notes
>
> There's no user-facing README.md; the repo has CLAUDE.md, which is useful for development but not ideal as the primary public project entrypoint.
>
> The dependencies are pinned, which is good, but there are no hashes or lockfile.
>
> The .gitignore is minimal. I also didn't find CI config, formal pytest tests, lint config, type checking config, Dependabot/Renovate config, or a .dockerignore.
>
> The client-side rendering generally avoids obvious XSS by using textContent in important places, and player card names are also rendered with textContent. The lobby uses innerHTML, but wraps the name in an escape helper first. That's good enough for the current usage, but I'd still prefer avoiding innerHTML entirely for user-controlled values.
>
> #### What I would fix first
>
> 1. Fix reconnect security by adding a private reconnect token and stop exposing usable player identity as an auth credential.
> 2. Add a production mode: no --reload, no repo volume mount, non-root container, pinned images, real secrets, healthcheck, no exposed Postgres, protected Grafana.
> 3. Add CI with at least: Python syntax/import check, Ruff, basic unit tests for game.py, WebSocket integration test for create/join/start/roll/reconnect, Docker build.
> 4. Add resource controls: max players per game, max active games per IP/session, create/join rate limits, WebSocket origin allowlist, max message size / malformed JSON handling.
> 5. Decide the scaling model: keep it single-node and document that clearly, or move active game state to Redis/Postgres and use pub/sub so multiple instances can run.
> 6. Clean up telemetry semantics: clarify total_rounds vs rounds_won, update total_games, harden the writer transaction behavior, decide whether duplicate player_left events are desired.
>
> #### Bottom line
>
> This repo is better than a throwaway prototype. The gameplay loop, WebSocket design, reconnect handling, asset cache busting, and telemetry show careful thinking.
>
> But it's currently built like a single-instance public demo with excellent observability, not a hardened internet-facing service. The most serious issue is reconnect hijacking. The most important operational issue is that active games live only in process memory.
>
> Fix those, add CI, and separate dev/prod deployment config, and this becomes a genuinely strong little real-time game app.

---

## Turn 2 — Claude Code

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

---

## Turn 3 — External reviewer

> Yep, I agree with this second opinion. It is a strong correction/expansion of my original review.
>
> The biggest thing I underweighted was this:
>
> Disabled Grafana HTML sanitization + user-controlled player names = plausible stored XSS path.
>
> That is more concrete than just "Grafana is loosely configured." Since player names flow into telemetry and dashboards, this should be called out as a real security issue, not just a deployment-hardening nit.
>
> I'd revise my top priorities to:
>
> 1. Reconnect token — prevent reconnect hijack; small change, high value.
> 2. Fix Grafana/dashboard XSS exposure — re-enable Grafana sanitization unless there is a hard reason not to; treat player names as hostile everywhere, including telemetry/dashboard paths; consider escaping/sanitizing before writing line protocol fields if any dashboard renders them as HTML.
> 3. Split telemetry writer transaction — append-only events should be committed first; rollups should be best-effort, isolated by savepoint or separate transaction; this is a data integrity issue, not just observability polish.
> 4. Fix stats semantics — rename total_rounds to rounds_won, or actually count rounds played; populate or drop total_games.
> 5. Document single-worker requirement — single-process can be fine for Tensies, but it must be explicit: do not run multiple workers, pods, or replicas unless active game state is externalized.
> 6. Production config / CI / resource caps — still important, but after the above.
>
> So the corrected bottom line is:
>
> Tensies is a strong single-node real-time game prototype with excellent observability. Before public exposure, fix reconnect auth, dashboard XSS risk, and telemetry transaction durability. After that, document the single-worker model and harden the deployment.

---

## Turn 4 — Claude Code (decision rationale & implementation notes)

This section is added after the fact to record *why* I took the positions I did,
and the design decisions behind the work that followed. The three turns above are
verbatim; this one is a reflective summary written from memory of the session.

### How I evaluated the original feedback

I did not take the feedback on trust. Before agreeing with anything I read the
actual modules it referenced — `server/ws.py`, `server/game.py`,
`server/broadcast.py`, `server/routes.py`, `server/state.py`, the telemetry
`writer.py`, `migrations/001_init.sql`, `docker-compose.yml`, the `Dockerfile`,
and the client `screens.js` / `util.js` / `ws.js`. Every "CONFIRMED" in my Turn 2
review means I traced the claim to specific lines, not that it sounded plausible.

### Where I agreed, and why

- **Reconnect hijack (#1).** I agreed this was the most important issue and rated
  it real. The proof is structural, not hypothetical: `state_msg()` keys the
  `players` dict by `pid` and also ships `host` as a `pid`, so every connected
  client already holds every opponent's identifier; `handle_reconnect()` then
  accepts `player_id` + `game_code` + the `disconnected` flag as sufficient to
  seize a slot. The "credential" is broadcast to everyone, which is the whole
  problem. The reviewer's proposed fix (a private hashed token) was exactly
  right, so I adopted it rather than inventing an alternative.

- **Writer transaction trap (#6).** I agreed *and escalated* it. The reviewer
  said a rollup bug could "poison the batch." Reading `_flush()` I concluded it
  was worse: because the event insert and all rollup handlers share one
  `con.transaction()` with no savepoints, an aborted transaction rolls back the
  append-only event insert too — which directly contradicts the project's own
  documented guarantee that unhandled events still land in the `events` table.
  That moved it, in my mind, from "observability polish" to "data-integrity bug,"
  which is why I ranked it #2 in Turn 2.

- **Stats semantics (#7).** Confirmed by reading the SQL: `total_rounds` is only
  ever incremented alongside `total_wins` in `_h_round_won`, so the two columns
  are always equal and the name is misleading; `total_games` is declared in the
  schema but written by no handler. These are the kind of findings you only get
  from reading the queries, which is why I credited the reviewer with having
  actually read the code.

- **Issues 2–5, duplicate `player_left`, client XSS, missing CI/README/lockfile.**
  All confirmed against the code; I had no material disagreement.

### Where I added something the review missed

The original review separately noted that Grafana ran with
`GF_PANELS_DISABLE_SANITIZE_HTML: "true"` *and* that player names are
user-controlled, but never joined the two facts. I connected them: player names
flow into telemetry (`leader_name`, `live_players.name`) and are rendered on
Grafana dashboards, so disabled HTML sanitization plus attacker-controlled names
is a **stored-XSS path into the Grafana admin's browser** — a concrete attack,
not just loose configuration. This is the point the external reviewer then
singled out in Turn 3 as the thing they had underweighted, and promoted to their
#2 priority.

### Where I pushed back or softened

- **Single-process framing.** I declined to treat single-process as a defect.
  Tensies games are intentionally ephemeral — they die when the last player
  leaves and there is no active state worth persisting — so "single worker is a
  legitimate design choice that must be documented" is the honest framing, not
  "move to Redis." I did sharpen the operational consequence, though: it is not
  just "won't scale to many pods," it's that you cannot even run
  `uvicorn --workers >1` safely, and that constraint is currently undocumented.

- **Severity of the hijack.** I agreed it was the #1 fix but argued the blast
  radius is griefing a disconnected player mid-round, not account or data theft
  (there are no accounts). "Don't ship publicly like this," not "five-alarm
  fire." This kept the priority without overstating the stakes.

### The one thing I was later told to drop

When discussing what to implement, the project owner directed me to **ignore the
Grafana XSS entirely** — despite it being my own addition and the reviewer's #2.
I recorded that decision and did not act on it. (The analysis above is preserved
because the transcript is a record of the exchange, not of the final build plan.)

### Token design decision (the fix I built)

The owner asked which token approach was more secure. I compared two:

- **Opaque random token, hash stored server-side** — mint
  `secrets.token_urlsafe(32)`, send the raw value only to the owning player,
  store its SHA-256 on the player record, and compare in constant time on
  reconnect.
- **Signed/stateless HMAC token** — sign `player_id + game_code` with a
  server-wide secret; no per-player storage.

I recommended and built the **opaque-token-with-stored-hash** option, for
reasons specific to this codebase:

- **Smaller blast radius.** A leaked opaque token compromises one player in one
  game. A leaked HMAC signing key forges *every* token in *every* game, forever.
- **Revocation is trivial.** The hash dies with the in-memory player record; an
  HMAC token stays valid until expiry and can't be individually revoked without
  rotating the key for everyone.
- **Statelessness buys nothing here.** HMAC's only real advantage is verifying
  without a state lookup — but reconnect must load the game anyway (to clear
  `disconnected`, cancel the grace task, re-key the connection), so the lookup
  happens regardless.
- **It externalizes cleanly for the owner's multi-process goal.** The owner said
  they eventually want multi-process. The token hash lives on the player record,
  so when game state later moves to a shared store (Redis/Postgres) the same
  `verify_token()` logic works across processes unchanged. I noted that the token
  is *not* the multi-process blocker — `disconnect_task`, the per-process
  `connections`/`sessions` dicts, and `delayed_broadcast`'s single-event-loop
  assumption are.

### What the implementation actually changed

- `server/game.py` — added `make_reconnect_token()` (opaque token → SHA-256) and
  `verify_token()` (constant-time `secrets.compare_digest`); added a `token_hash`
  field to the player record.
- `server/ws.py` — mint a token on `create`/`join`, deliver the raw value
  privately via a new `reconnect_token` server→client message, and require the
  raw token in `handle_reconnect()` (verified constant-time). The hash never
  appears in `state_msg()`, so a leaked snapshot is no longer a usable credential.
- `static/js/ws.js` — persist the token in `localStorage` next to pid/code,
  replay it on reconnect, and clear it on session expiry.

### How I verified it (telemetry stack was unavailable)

Docker image pulls were network-blocked in the environment, so the full Compose
stack (Postgres/Grafana/Prometheus) could not run and telemetry was left
untested. I ran the app telemetry-free and tested in two layers:

1. A headless WebSocket protocol driver (`ws_integration_test.py`, added to the
   repo) — 25/25 checks, covering create/join/start/roll/rate-limit/win/
   target-cycle/disconnect plus the full token auth matrix: private token frame
   sent, `token_hash` never leaked, and reconnect rejected for missing / wrong /
   another-player's token while accepted for the correct one.
2. Two isolated real browsers driving the actual UI — lobby sync, start,
   roll-to-win + overlay, round advance, and a token-authenticated reload
   reconnect (host reconnect ~602 ms, `isHost` preserved), with live attacker
   reconnect attempts rejected. 0 server exceptions, 0 console errors.

One honest correction surfaced during testing: a remaining player initially did
*not* show the "waiting" loading screen on a peer disconnect. Investigation of the
server log showed this was **correct self-healing** — a live client with a valid
stored token auto-reconnects within the same second, so the peer never sustains a
`disconnected` view. Suppressing auto-reconnect reproduced the documented
loading-screen state. Not a regression; a gap in the test's assumptions.

### Deferred (not done in this session)

In the reviewer's revised priority order, after the reconnect token came: Grafana
XSS (explicitly dropped by the owner), the writer-transaction split (#3), stats
semantics (#4), single-worker documentation (#5), and production config / CI /
resource caps (#6). Only the reconnect token (#1) was implemented and verified
here. Also still open: documenting the new `reconnect_token` message in the
WebSocket protocol table in `CLAUDE.md`.

---

## Status updates

### 2026-05-30

- **Reconnect token** — ✅ addressed in [bb7bb11](https://github.com/radiantnode/tensies/commit/bb7bb1105e7aa113deb2006d2f623b0a7a236f57) *(2026-05-30)*. `server/game.py` mints a `secrets.token_urlsafe(32)` token and stores its SHA-256 hash on the player record; `server/ws.py` sends the raw token privately via a new `reconnect_token` frame and requires it (constant-time `verify_token()`) in `handle_reconnect`; `static/js/ws.js` persists it as `tensies_token` in localStorage and replays it on reconnect. The hash is never included in `state_msg()`, so a leaked state snapshot is no longer a usable credential. Verified with 25/25 headless WS integration checks and a live two-browser session including a negative-auth rejection test.
- **Grafana XSS exposure** — ⛔ owner decision: won't fix. Noted and recorded in Turn 4 but explicitly dropped before implementation. The risk remains (disabled HTML sanitization + user-controlled player names in dashboard). Left open as a documented won't-fix, not a pending task.
- **Writer transaction split** — ⏳ still open. `server/telemetry/writer.py` still runs the event insert and all rollup handlers inside a single `con.transaction()` with no savepoints. One rollup bug can roll back the append-only log.
- **Stats semantics** (`total_rounds` / `total_games`) — ⏳ still open. `total_rounds` still equals `total_wins` in all rows; `total_games` is still declared in the schema but written by no handler.
- **Single-worker documentation** — ⏳ still open. No commit has added an explicit warning against `--workers >1` to `CLAUDE.md`, `docker-compose.yml`, or a README.
- **Production config / CI / resource caps** — ⏳ still open. No `docker-compose.prod.yml`, non-root Dockerfile, auth on `/metrics`/`/stats/*`, CI pipeline, or create/join rate limits.
