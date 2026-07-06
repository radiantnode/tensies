# Technical Soundness — Backend & Distributed Systems

## Verdict

This is an unusually well-reasoned backend for a side project. The core architectural bet — all durable game state in Redis hashes with disjoint per-player fields, the three genuinely contended operations (create/join/drop) and the one hot CAS (round win) in atomic Lua, everything else process-local and explicitly backstopped — is correct. More importantly, the *reasoning* is written down next to the code and almost always matches what the code does. The idempotency discipline (timestamp re-checks in the drop Lua, deadline re-checks in the pause cap) means stale timers on dead or lagging instances are safe by construction rather than by luck.

I found no way to corrupt game state under multi-instance operation. What I did find: two real bugs in the backstop layer, one gap where the reaper doesn't cover a documented pause invariant, and a cluster of small races that are all either self-healing or gated by per-connection serialization. Nothing here threatens a single-instance deploy; the bugs live exactly where multi-instance edge cases live.

## The bugs

### 1. The reaper defeats the post-resume reconnect grace — **bug**

`server/ws.py:398-406`, `server/reaper.py:58-61`, `server/gamestore.py:124-125`

On resume, `handle_pause` schedules fresh `drop_player` tasks so players who went offline during the pause "get the normal grace to return." That grace exists only as the local task's 60 s `asyncio.sleep` — `disconnected_at_ms` is never re-stamped, so it still holds the timestamp from mid-pause, possibly 30+ minutes ago. Within `REAP_INTERVAL` (15 s) of resume, any instance's reaper sweeps the now-unpaused game, sees `disconnected=1`, calls `do_drop`, and the Lua freshness check `now - dat >= grace_ms` passes trivially.

Result: the documented ~60 s post-resume grace (and the client's extended paused-reconnect window) is actually 0–15 s. This happens even single-instance — the scheduling instance's own reaper does it.

**Fix:** re-stamp `disconnected_at_ms = now` for still-disconnected players in the resume path.

### 2. `games:index` leaks entries when a game key TTL-expires — **bug**

`server/reaper.py:49-52`, `server/gamestore.py:73-81`

If an instance dies while its players are connected, nobody marks them disconnected; the game hash idles until `GAME_TTL` (7200 s) expires it. Expiry deletes only `game:{code}` — the `games:index` SADD member survives forever. The reaper hits exactly this state (`snap is None`) and does `continue` without an `SREM`.

The consequences compound: the active-games gauge is permanently inflated, and `_CREATE_LUA` gates creation on `SCARD(games:index) >= MAX_GAMES`, so orphaned entries permanently consume creation capacity — a slow, unrecoverable march toward "Server is at capacity."

**Fix:** one line — `SREM` in the reaper when the snapshot is gone.

## The concerns

### 3. Fanout has no ordering or versioning across publishers

`server/fanout.py`, `server/game.py:96-125`

Redis pub/sub preserves per-publisher order only. Two state broadcasts originating on different instances can arrive at clients in either order, and snapshot-read → publish is not atomic — a snapshot taken earlier can be published later. `state_msg` carries no monotonic sequence number, so clients can't discard a stale snapshot; visible state can briefly regress (another player's dice reverting one roll) until the next broadcast repairs it. Full-snapshot messages make this self-healing, which is why it's a concern and not a bug. A `round_seq`-style version stamp in `state_msg` plus a client-side "ignore older" check would close it cheaply — the counter already exists in the game hash.

### 4. Paused-host transfer has no cross-instance backstop

`server/reaper.py:53-57`, `server/broadcast.py:169-185`

The pause docs promise a paused game can't be held hostage by an absent host: when the host is gone past grace during a pause, `do_drop` hands host to a connected player. But that branch is reached only via the *local* grace task on the instance that owned the host's socket — the reaper explicitly `continue`s past paused games, never calling `do_drop` for their disconnected players. If the host's instance dies while the game is paused, no surviving instance ever performs the handover; the table is frozen until `PAUSE_MAX` (1 h) kills the game — precisely the outcome the mechanism exists to prevent.

**Fix:** the reaper's paused branch should also run the host-handover check.

### 5. Concurrent reapers double-fire the pause-cap ending

`server/broadcast.py:125-143`

`end_if_paused_over` is snapshot → broadcast fatal error → `delete_game`, with no CAS. With N instances, up to N reapers can pass the paused+deadline check in the same sweep window: clients receive duplicate fatal `error` frames, and `game_ended` telemetry / `games_ended_total` / `game_duration_seconds` are double-counted. Note `do_drop` does *not* have this problem — its emit is gated on the Lua result (`broadcast.py:188-190`), which is the pattern to copy.

### 6. One Redis hiccup on any action tears down the socket

`server/ws.py:557-582`

Every handler awaits Redis with no per-handler exception handling; the endpoint's blanket `except Exception` converts any transient gamestore error into a full disconnect. Under a brief Redis blip, every connected client on every instance drops simultaneously and reconnect-storms back (each reconnect also hitting Redis). The reconnect-token machinery makes recovery *correct*; a narrow retry-or-error-frame wrapper around handler dispatch would make it *graceful*. Relatedly, the disconnect `finally` block itself awaits Redis four times (`ws.py:605-625`) — during shutdown or the same outage, those raise out of `finally` and the disconnect bookkeeping (including `conn_decr`) is skipped.

### 7. Two devices on one account breaks two process-local assumptions

`server/gamestore.py:84-99`, `server/state.py:28`

After passkey auth, `session.pid` is the account UUID, so two devices signed into one account share a pid. (a) `_JOIN_LUA` has no membership check, so the same pid can be appended to `order` twice — `snapshot()` silently dedupes and `_DROP_LUA` strips all occurrences, so it self-heals, but the roster count and `connections[code][pid]` (last socket wins) are briefly wrong. (b) `ack_events` is keyed by pid alone, so concurrent rolls from two sessions of one account overwrite each other's events. Both are cosmetic today, but the "roller and its roll_done are always on the same instance" invariant in `state.py:26-28` is quietly weaker than stated once pids stopped being per-connection.

## The nits

- **`auth` after `join` silently desyncs the session** (`server/ws.py:98-127`). `handle_auth` rebinds `session.pid` unconditionally; if a client authenticates after joining, the game hash holds the old pid and rolls are silently swallowed. A one-line guard (`if session.code: return error`) would make the invariant explicit.
- **Overlapping rolls within the ack window cross wires** (`server/state.py:28`, `server/broadcast.py:76-87`). `MIN_ROLL_INTERVAL` (0.25 s) is far below `ROLL_ACK_TIMEOUT` (2 s), so a fast roller can have two `delayed_broadcast` tasks in flight; the second overwrites `ack_events[pid]`, the first waits out its full timeout, and roll 1's ack releases roll 2's broadcast early. The `is ev` cleanup guard correctly prevents registry corruption — someone clearly thought about it — but the ack silently degrades. Purely an animation-timing blemish, consistent with the ack being best-effort by design.
- **The pause toggle is read-then-write, safe only by per-connection serialization** (`server/ws.py:374`, `server/gamestore.py:389-396`). `new_paused = not meta["paused"]` and `pop_round_advance_pending`'s GET-then-SET are non-atomic; safe today because a single WS receive loop serializes the host's actions — but that invariant lives three files away, and the paused-host-transfer path means two different sessions can legitimately hold host across a transfer. A double-resume racing a host transfer could pop `round_advance_pending` twice and advance the round twice. Very narrow, but this is the one piece whose correctness rests on an implicit serialization rather than on Redis.
- **A dead-in-practice roll-vs-advance race worth a comment** (`server/ws.py:260-304`). `handle_roll` checks `round_over` at entry, then writes dice several awaits later with no re-check. Unreachable in practice — `round_over` stays 1 for the entire `ROUND_WIN_DELAY` — but "the win delay is what makes the unguarded write-back safe" is exactly the kind of invariant the working agreement says to write down.
- **INCR-then-EXPIRE races in the abuse limiters** (`server/gamestore.py:443-457`). If the process dies between `INCR` and `EXPIRE` in `rate_allow`, the key persists forever and that IP is rate-limited until manual intervention. Low probability, annoying blast radius. A tiny Lua script closes it.
- **`delayed_broadcast` tasks are fire-and-forget with no stored reference** (`server/ws.py:356,363`). CPython holds tasks only weakly; the docs explicitly warn tasks can be GC'd mid-execution unless referenced. In practice the pending waits keep these alive, but a module-level `set()` with a done-callback discard is two lines.
- **Shutdown paths are close-but-not-clean** (`server/fanout.py:35-43`, `server/telemetry/writer.py:29-35`). `fanout.stop()` cancels the subscriber without awaiting it before closing the connections it uses; `writer.stop()` cancels without a final drain, so up to 250 ms of tail events are lost per deploy.
- **Housekeeping** (`server/assets.py:107-108`, `server/routes.py:70-72`, `server/gamestore.py:171-187`). `build_js_cache` calls `_collect_assets()` three times to build one hash; `stats_leaderboard` has its docstring *after* the first statement (dead string literal); `create_game` maps the Lua `-1` code-collision result onto the same `None` as the capacity cap, so a one-in-11-million collision surfaces as "Server is at capacity" with no retry.

## What's genuinely excellent

- **The single-delivery-path fanout** (`server/fanout.py:1-8,46-50`). `broadcast()` never touches local sockets; it publishes to `bcast:{code}` and every instance — including the publisher — delivers via its own subscription. This eliminates the classic "local fast-path plus remote slow-path" duplication bug entirely: one delivery code path, so exclude-handling, dead-socket cleanup, and metrics behave identically everywhere. The comment explaining why `listen()` was rejected in favor of `get_message(timeout=1.0)` shows the failure mode was actually hit and understood.
- **Timestamp-based idempotency in the drop Lua** (`server/gamestore.py:113-145`). `_DROP_LUA` re-verifies *inside Redis* that the player is still disconnected and past grace before removing anyone. Every stale timer is safe: a drop task firing after the player reconnected elsewhere no-ops; the reaper and the local task can run concurrently and exactly one wins. This is the right way to do cross-instance timers.
- **Stale pause-cap timers are defused by the deadline re-check** (`server/broadcast.py:125-131`). The nastiest cross-instance sequence — pause on A, host reconnects to B, resumes, re-pauses (A's timer can't be cancelled) — is harmless: A's orphaned timer fires, sees the new deadline is in the future, returns. Redis is the source of truth; process-local timers are mere hints.
- **`try_finish_round` is the right — and only — CAS** (`server/gamestore.py:102-111`, `server/ws.py:331-336`). Distinct players write distinct hash fields, so N simultaneous rollers never contend; the single contended decision (who won) is a Lua flip of `round_over` 0→1, and the loser's path degrades gracefully. Minimal, correct, and the written analysis of why nothing else needs a lock is sound.
- **`game.py` is genuinely pure and `broadcast.send()` is a genuine choke point** (`server/game.py:50-93`, `server/broadcast.py:14-39`). `apply_roll` mutates only its argument, takes optional injected dice (which keeps the drand path replayable and the verify endpoint honest), and returns the full before/after dict so the handler owns telemetry — zero imports of gamestore, telemetry, or asyncio. Every outbound frame flows through `send()`, so the per-session `send_lock` and byte/latency metrics can't be bypassed. Both invariants claimed in CLAUDE.md hold in the code.
- **The telemetry non-blocking invariant holds end to end** (`server/telemetry/`). `emit()` is sync, per-subscriber bounded queues drop-oldest-and-count on overflow, and with `TELEMETRY_ENABLED=0` the subscriber list is simply empty so `emit()` degrades to an O(0) loop. Writer and Live pusher each own their queue so a slow Grafana never backs up Postgres.
- **The FRONTEND_DIST split and the security middleware earn their keep** (`main.py:47-75`, `server/security.py:67-102`). Dev mode's transitive ES-module `?v=` rewriting solves a real problem (script-tag cache-busting doesn't bust imported modules) without a build step; prod removes the app from the static path entirely while keeping the document flowing through the CSP middleware so the policy stays single-sourced. The `Cache-Control: no-cache` on HTML with the PWA version-skew rationale written inline is the kind of comment that saves a future debugging week.

## Summary table

| # | Severity | Finding |
|---|----------|---------|
| 1 | **bug** | Reaper drops mid-pause disconnectors ~0–15 s after resume, not 60 s — re-stamp `disconnected_at_ms` on resume |
| 2 | **bug** | `games:index` orphans on game-key TTL expiry permanently consume `MAX_GAMES` capacity |
| 3 | concern | No sequence/version on fanout snapshots → transient cross-instance state regression |
| 4 | concern | Paused-host handover only runs on the owning instance; reaper skips it |
| 5 | concern | Pause-cap ending isn't CAS'd → duplicate fatal frames / double-counted metrics |
| 6 | concern | Any Redis hiccup in a handler or the disconnect `finally` tears down / skips cleanup |
| 7 | concern | Two devices on one account: duplicate `order` entries, colliding `ack_events` |
| — | nits | Auth-after-join guard, ack overlap, non-CAS pause flip, limiter INCR/EXPIRE gap, unreferenced tasks, shutdown drains, housekeeping |
