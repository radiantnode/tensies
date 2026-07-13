# Post-Review Fixes

*Written 2026-07-05 by Claude Fable 5, after implementing the review's fix list. The review (files 01–07) found the problems; this file records what was done about them.*

All fixes landed on branch `fix/fable5-review-fixes` → **[PR #58](https://github.com/radiantnode/tensies/pull/58)** (separate from this docs branch). One concern per commit, verified as each went in, all seven CI checks green.

## What was fixed

Ordered by the priority table in [07-observations-and-advice.md](07-observations-and-advice.md), grouped by commit.

### 1. Reaper index leak + post-resume reconnect grace — [`bbe70f9`](https://github.com/radiantnode/tensies/commit/bbe70f94cc56f2b00293881830fba6645b956b10)
`server/reaper.py`, `server/gamestore.py`, `server/ws.py`

The two real backend bugs from [01-technical-soundness.md](01-technical-soundness.md), both in the multi-instance backstop layer:

- **`games:index` leak.** When a game hash TTL-expired (its instance died with players still connected), the index entry survived forever — inflating the active-games gauge and permanently consuming `MAX_GAMES` capacity. The reaper now reclaims the index entry when the snapshot is gone (`delete_game` is idempotent).
- **Post-resume grace.** On pause-resume, `disconnected_at_ms` still held the mid-pause timestamp, so the reaper (or the drop Lua) treated an offline player as past-grace within one sweep instead of granting the documented 60 s. Resume now re-stamps via a new conditional Lua helper `restamp_disconnect` that can't flip a just-reconnected player back to disconnected.

*Proven in the live integration flow: pause 03:05:29 → resume 03:07:20 → drop 03:08:21 — exactly 61 s after resume, not the old ~15 s.*

### 2. Reaper covers paused games; pause-cap ending is exactly-once — [`5bed427`](https://github.com/radiantnode/tensies/commit/5bed42799eaa87ba28c3f2633183ab6bb506b064)
`server/reaper.py`, `server/broadcast.py`, `server/gamestore.py`

- The reaper's paused branch now runs the host-handover check, so a dead host instance no longer freezes a paused table until `PAUSE_MAX` (1 h) — it hands the resume control to a connected player.
- `end_if_paused_over` now claims the ending via an atomic Lua CAS (`try_end_paused`), so N racing reapers can't double-broadcast the fatal frame or double-count `game_ended` telemetry.

### 3. `legacy_pid` already-assigned guard — [`0bb914a`](https://github.com/radiantnode/tensies/commit/0bb914abe8e58e1b0add664417c669500be05519)
`server/auth.py`

Per your decision, open claiming of *unclaimed anonymous* pids stays — whoever played the games locks them in, first come first served. The fix is the narrower one: a pid that is already an account UUID (they share the pid namespace and are broadcast in `state_msg`) or already claimed by another account can no longer move stats. Registration still succeeds either way; the existing `users_legacy_pid_key` constraint is the race backstop, with a savepoint retry. *Guard SQL verified against live Postgres (claimed-pid / account-UUID / fresh-pid cases).*

### 4. Rate-limit `/auth/*` — [`8322587`](https://github.com/radiantnode/tensies/commit/832258764fe67a5dec98c09ddf70bf61f067404e)
`server/auth.py`, `server/config.py`, `server/security.py`, `server/ws.py`

The four passkey handlers now share the Redis window limiter (`AUTH_RATE_MAX`, default 20/60 s/IP). The 404-vs-409 username distinction is **kept on purpose** — the double-duty sign-in button (1.23.0) depends on it — so this caps how fast the oracle can be read rather than removing it. `_client_ip` moved from `ws.py` to `security.py` as `client_ip()` (shared by HTTP + WS). *Verified live: 20×404 then 429.*

### 5. Roll-pacing fairness — [`f7188ff`](https://github.com/radiantnode/tensies/commit/f7188ff681a3ad16b0f4fa755e665267ca91973f)
`server/config.py`, `static/js/animations.js`

The two exploits from [04-gameplay.md](04-gameplay.md): `prefers-reduced-motion` skipped the shake wait entirely (~70 % win rate vs a normal client) — it now waits 700 ms, the midpoint of the normal window, so it's motion-free but pace-identical. And `MIN_ROLL_INTERVAL` went 0.25 → 0.75 s so the server, not the animation, is the effective rate limiter. *Honest play unaffected: a full round won with a minimum inter-roll gap of 1086 ms.*

### 6. Profile markup + XSS escaping — [`734c466`](https://github.com/radiantnode/tensies/commit/734c466af0efc12dd3a6080cec2a0c38150724cb)
`static/js/components/profile-screen.js`, `static/js/components/game-detail-screen.js`, `static/js/dom.js`

Closed the missing `>` in the recent-game row (it was eating the score span's styling), and added an `esc()` helper applied to every server-string interpolation on the profile and game-detail screens — closing the latent stored-XSS trap *before* any profile-edit feature ships. *Verified with `<img onerror>` / `<b onmouseover>` probes: rendered inert, no handlers fired.*

### 7. Client resilience — [`5ade06c`](https://github.com/radiantnode/tensies/commit/5ade06c5994acc96b41eac98e65b9ee1b8bd3efa)
`static/js/animations.js`, `static/js/net.js`, `static/js/touch.js`, `static/js/components/lobby-screen.js`

Four smaller frontend fixes: a `tryReveal` deadline (no more infinitely-spinning roll button), in-game error frames now surfaced instead of silently dropped, the touch guard synthesizes a click for any tappable control (fixing End Game's "Tap to confirm"), and the lobby list uses the same guarded `insertBefore` as the players bar so re-renders don't kill row entrance animations. *The error-surface + deadline pair verified: a rate-limited raw roll unsticks the button.*

### 8. Types + CI gate — [`6439ba6`](https://github.com/radiantnode/tensies/commit/6439ba642d8d4978039ca82ded4be35a9f5dfdcc)
`static/js/*`, `package.json`, `.github/workflows/ci.yml`

All 31 `tsc` errors fixed at the source (declared `state.gameJustEnded`, added `AuthOkMessage` + a `PlayerStats` typedef to `types.js`, removed a colliding typedef, narrowed casts), and a `npm run typecheck` step added to the frontend CI job so the "strict JS" claim can't silently rot again. This was the highest-leverage fix — the one repo invariant with no enforcement was the one that had drifted.

### 9. Dev restart-killer — [`1bf42aa`](https://github.com/radiantnode/tensies/commit/1bf42aa7a4785ae70dcd118e12b9152f556d59f7)
`server/assets.py`, `server/routes.py`, `main.py`

The 125-`restart`-messages problem, fixed at the root. A new `DevAssets` helper recomputes the cache-busted index template + JS module cache lazily, rebuilding only when a static file's mtime actually moves. Dev edits now show on the next reload with no `restart web`. The prod path (nginx serving prebuilt `dist/`) is untouched. *Verified: appended a marker to a module with no restart; the served `?v=` hash changed and the new body served; git-revert restored it.*

Pre-merge verification log: `docs/test-runs/game/2026-07-05T22-29-15.md` on the fixes branch (21/21 over the changed surfaces + prod bundle).

## Production rollout notes

- **No migration, no schema change, no new required env var.** The `legacy_pid` guard reuses the existing `users_legacy_pid_key` constraint. `AUTH_RATE_MAX`/`AUTH_RATE_WINDOW` have safe defaults (20/60 s). Nothing needs to be set before deploy that wasn't set before.
- **`MIN_ROLL_INTERVAL` is now player-visible.** It went 0.25 → 0.75 s. This is intentional (it's the fairness fix) but it *is* a gameplay change — the fastest legitimate roll cadence is now ~0.8–1.3 rolls/s. It's env-tunable if you want to soften it in prod. Nothing else in this PR changes game feel.
- **Deploy order is irrelevant, but drain matters for one fix.** The reaper/restamp changes are safe to roll out instance-by-instance (the Lua is idempotent and the CAS is race-safe across mixed old/new instances). The one subtlety: during a rolling deploy, an *old* instance's reaper will still use the pre-fix drop logic until it's replaced — so the post-resume-grace fix is only fully in effect once every instance is on the new build. No correctness risk, just partial coverage mid-deploy.
- **`.env.prod` gap surfaced during the smoketest.** The local `.env.prod` (dated Jun 15) is missing `JWT_SECRET` and `WEBAUTHN_RP_ID` — the prod compose hard-fails without them (correctly). The `.env.prod.example` already lists both, so real deploys that copy the example are fine; just make sure your actual `.env.prod` has them before the next prod up. A stale Postgres volume also needed a `down -v` during testing — environmental, not code.
- **CI got stricter.** The frontend job now runs `tsc`. Any future PR that introduces a type error will fail CI — that's the point, but it means the type annotations are now load-bearing, not decorative.

## Anything to look out for

- **The "Paused button" ghost.** During testing, the host's roll button read "Paused" for ~1 s after resume. This looked like a regression but is the documented fanout round-trip latency — the host receives its own resume broadcast via Redis pub/sub, polled at up to 1 s (`fanout.get_message(timeout=1.0)`). It self-corrects. If you ever see a *persistent* stuck-Paused button, that's different and worth investigating; a one-second flicker is expected and unchanged by this PR.
- **Reconnect timing in manual testing.** The restamped grace is a real 60 s from resume. If you close a client during a pause, resume, and then take more than a minute to reconnect, the player will be legitimately dropped — that's correct, not a bug. It bit me once during the test pass (my between-step analysis took >60 s).
- **The `esc()` helper is now the XSS backstop for profiles.** It's applied everywhere server strings hit `innerHTML` on the profile/game-detail screens today. When the profile-edit feature ships (letting users write `bio`/`location`), that's the moment the trap the review flagged would otherwise spring — the escaping is already in place, but double-check any *new* interpolation site added for that feature goes through `esc()` too.
- **Unverified this pass.** The full WebAuthn UI matrix (sign-up-with-stats-transfer end to end) wasn't re-driven — the `legacy_pid` SQL was verified directly against Postgres, but the browser sign-up path that exercises it wasn't. Worth one manual run before relying on the stat-transfer in anger. Steps 13 (sticky overlay) and 22 (multi-round flash) also weren't re-run; they're unaffected by this branch and were green on 2026-07-03.

## Reflecting on the feedback → fix loop

A few honest observations about how this went, because the loop itself is worth examining.

**The review predicted its own most important fix.** The `legacy_pid` hole was found *twice*, independently, by two separate review passes — and both noted that the repo's own `game.py` design comment already described the exact threat ("a leaked game snapshot carries pids"). The codebase had written down the correct threat model and then not applied it in one place. That's the most useful kind of finding: not "you didn't know," but "you knew, and here's the one spot it didn't reach." Fixing it was almost mechanical because the correct pattern was already in the tree.

**Your one decision changed the shape of a fix, and it was the right call.** When I flagged `legacy_pid`, the obvious fix was "require proof of possession." You said no — keep it open, just stop the double-claim. That was a better product decision than my default security instinct: frictionless onboarding matters more than bar-stakes stat theft, and the *actual* vulnerability (moving a registered account's stats) is closed by a much smaller change. The lesson for me: "make it secure" and "make it right" aren't the same, and the person who knows what the feature is *for* should get the veto. I'd have shipped a heavier fix that made sign-up worse.

**Verifying as I went caught two things that would have read as failures.** The "Paused button" and the "reconnect landed on landing" both looked like regressions mid-test. Neither was — one was fanout latency, one was the grace correctly expiring. If I'd batched all the verification to the end, or trusted a single screenshot, I'd have either chased a phantom bug or (worse) filed a false all-clear. The habit that saved it was the one your own memory files enforce: reproduce it, measure the actual thing, don't infer from a snapshot. The restamp fix in particular is only *provable* because I read the drop timestamp out of the server logs — "61 s, not 15 s" is a fact; "seems fine" would not have been.

**The commit-per-concern structure paid off under CI.** Ten small commits meant that when CI ran, a failure would have pointed at one concern, not a 900-line blob. It also made the two things that *aren't* pure fixes — the `MIN_ROLL_INTERVAL` gameplay change and the CI-gets-stricter change — visible as their own decisions rather than buried. If I were doing this again I'd change little; the one thing I'd front-load is the prod-env check, since the `.env.prod` gap only surfaced at the very end when I switched to the prod stack, and it's exactly the kind of thing that should be caught before the smoketest, not during it.

**What the loop was actually good at.** The strongest part wasn't any single fix — it was that the review, the decision, and the verification formed a closed circuit. The review said "here's a hole, and here's the threat analysis." You said "here's what the feature is for." I implemented the intersection and then *proved* it against live Redis, live Postgres, and two real browsers. Each stage checked the one before it. That's the version of this loop worth keeping: findings that cite the code, decisions that cite the product, and fixes that cite a measurement — not a review that asserts, a fix that assumes, and a green checkmark that hopes.

*— Fable 5*
