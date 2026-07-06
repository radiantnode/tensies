# Security Review

## Verdict

This is, genuinely, an unusually well-secured hobby codebase — and I went looking to disprove that reputation, not confirm it. The security work is not cosmetic: it is threaded through the design with visible intent and cross-referenced audit tags (H1/M1/M2/M3/L1/L2/L4/C1) that map to concrete mitigations in code. WebAuthn is implemented correctly, JWTs pin HS256 and enforce expiry, the reconnect-token scheme is textbook, every SQL statement is parameterized, the racy Redis mutations are Lua compare-and-set, abuse limits live in Redis so they hold across instances, the CSP is strict same-origin with no `unsafe-inline`, and the prod compose is meaningfully hardened versus dev.

The findings below are refinements and a couple of real-but-low-impact gaps, not structural problems. Nothing rises to high severity in a correctly-configured prod deployment.

## Findings

### 1. `legacy_pid` stat-transfer is unauthenticated — **low, fix first**

`server/auth.py:114-118, 246-252` (client side: `static/js/auth.js:164`)

`register/verify` accepts a client-supplied `legacy_pid` and runs `UPDATE player_stats SET user_id = <new account> WHERE user_id = <legacy_pid>`. There is no proof the registrant ever owned that anonymous pid — and pids are not secret: `state_msg()` keys the `players` map by pid, so every opponent you've ever played sees your anonymous pid. This is the exact leak the reconnect-token design in `game.py:8-16` was built to defend against; the auth path didn't get the same treatment.

**Exploit:** share a game with a victim, capture their pid from the WS `state` frame, register a new account passing `legacy_pid=<victim pid>`, permanently absorb their lifetime games/wins/rolls (the UPDATE moves the row; the victim can't later claim it).

**Decision (Michael, 2026-07-05):** open claiming of *anonymous* pids is intentional — whoever played the recent games can lock them in, first come first served. The fix is therefore not proof-of-possession but an **already-assigned check**: before the UPDATE (same transaction), reject any `legacy_pid` that is an existing account's `users.id` or already recorded in `users.legacy_pid`, plus a unique index on `users.legacy_pid` as a race guard. This closes the serious variant — account UUIDs share the pid namespace and are broadcast in `state_msg`, so without the check a registered user's stats can be moved onto a fresh account. The double-claim of a stats row is already a no-op (the UPDATE's WHERE matches nothing once claimed). Residual, accepted: two people racing to claim a shared-device anonymous pid.

*Two independent review passes (security and backend) each found this without knowledge of the other. Treat that convergence as a priority signal.*

### 2. No rate limiting on `/auth/*` — **low**

`server/auth.py` (all four POST handlers)

The per-IP connection cap and create/join limiters live on the WebSocket path. The auth HTTP endpoints have none. `login/options` returns 404 "No account with that username" while `register/options` returns 409 "Username already taken" — a clean username-enumeration oracle — and registration can be scripted to spam accounts and challenge writes to Redis.

**Fix:** apply the existing `gamestore.rate_allow` limiter (keyed on `_client_ip`) to the auth routes; consider making the presence/absence responses less distinguishable.

### 3. `/metrics` + `/stats` bearer check is not constant-time — **low**

`server/routes.py:49` — `if authorization != f"Bearer {expected}":`

Plain `!=` on a secret is theoretically timing-observable. In prod these endpoints sit on the internal network, so exploitability is marginal, but the fix is one line: `secrets.compare_digest(authorization or "", f"Bearer {expected}")`.

### 4. Grafana `GF_PANELS_DISABLE_SANITIZE_HTML: "true"` in prod — **low (residual)**

`docker-compose.prod.yml:183`

Deliberate and documented: the stored-XSS vector is closed at intake instead (`sanitize_name` strips `<>&"'` backtick and control chars; usernames are regex-constrained). The residual risk is fragility — any *future* user-controlled string that reaches a Grafana panel without passing `sanitize_name` becomes live XSS in the admin dashboard. It holds today; it is one missed sanitizer away from not holding.

### 5. `innerHTML` interpolation on profile fields relies entirely on source-sanitization — **low/info, but a trap**

`static/js/components/profile-screen.js:145-152` (location pill), `:214-222` (recent-game avatars: `alt="${name}"`, `src="${src}"`); also `game-detail-screen.js:109,213`

`data.location`, opponent `name`, and photo `src` are interpolated into `innerHTML` template strings with no HTML-escaping. Safe today only because `location`/`bio`/`profile_photo_url` have **no user-facing write endpoint** (set only via direct SQL), names are `sanitize_name`-cleaned, and usernames are regex-limited. The pattern is output-unsafe: the moment a profile-edit endpoint ships — and the onboarding screen is the natural place — `location` and `bio` become stored-XSS sinks.

**Fix:** escape at the interpolation site, or use `textContent`/`setAttribute` as the rest of the codebase already does (lobby, game, player-card all do this correctly). Do it *before* any profile-write API ships.

### 6. `JWT_SECRET` has a dev default and no startup warning — **info**

`server/config.py:227`. `METRICS_TOKEN`/`STATS_TOKEN` get loud startup warnings when unset; `JWT_SECRET="dev-secret-change-in-prod"` — which makes every session forgeable and, via `handle_auth`'s pid rebinding, lets an attacker act as any account in-game — gets none. Prod compose does hard-fail when it's unset (`docker-compose.prod.yml:66`), which is why this is info and not medium; but a bare-uvicorn deploy outside compose would run silently forgeable. Add the same warning the metrics tokens get.

### 7. Small notes — **info**

- `MAX_WS_MESSAGE_BYTES` bounds characters, not bytes (`server/ws.py:560` — `len()` on the decoded `str`); a 4096-"byte" cap admits up to ~4× that in UTF-8. Immaterial at this size.
- User-controlled pid becomes part of the Redis hash-field name on reconnect (`server/ws.py:224`, `gamestore.py:314`). Redis is binary-safe and forging is blocked by the token compare, so no path to hijack — but a cheap shape check (UUID / `[A-Z]{5}`) would make intent explicit.
- `register_verify` trusts `cred.get("user_id")` from the client (`auth.py:209-212`); the PK constraint prevents takeover, but the surviving error path surfaces as a misleading 409 "Username already taken."

## What's done well (all verified in code)

- **WebAuthn ceremony is correct.** Challenges generated server-side, stored in Redis with a 120 s TTL and consumed with `GETDEL` — single-use, no replay (`auth.py:95-106`). Registration and authentication both pin `expected_rp_id` + `expected_origin` + `expected_challenge`. Login verifies against the stored public key and threads `sign_count` through with write-back (`auth.py:361-380`) — proper authenticator-clone detection. Most production codebases get at least one of these wrong.
- **JWT handling is sound.** `algorithms=["HS256"]` explicitly pinned on every decode (no alg-confusion); expiry enforced on both the HTTP and WS paths; secret env-injected with prod hard-fail.
- **Reconnect tokens are textbook.** `secrets.token_urlsafe(32)` (256-bit), only the SHA-256 hash stored on the slot, `secrets.compare_digest` verification — and the design note correctly reasons that pids can't be the credential because snapshots leak them (`game.py:8-24`).
- **Host-only actions** (`start`/`pause`/`end_game`) all re-check `meta["host"] == session.pid` server-side against Redis, never trusting client claims (`ws.py:206, 372, 420`).
- **SQL is uniformly parameterized** — every query in `auth.py`, `db.py`, `routes.py` uses `$1..$n` placeholders, including the big profile aggregation. No string interpolation into SQL anywhere.
- **Race-safe Redis** — round-win crowning is atomic Lua CAS; create/join/drop are Lua with cap checks inside the script.
- **Abuse limits are enforced in Redis** (cross-instance): per-IP connection cap, create/join sliding windows, per-player min roll interval, global MAX_GAMES, oversized-frame rejection, WS origin allowlist.
- **XFF handling is thoughtfully defensive** — takes the entry `TRUSTED_PROXY_HOPS` from the *right* so client-prepended values are ignored, off by default, and the nginx config sets exactly one authoritative `X-Forwarded-For` from `$http_cf_connecting_ip` to match (`ws.py:492-507`, `ops/nginx.conf:48`).
- **Discord interactions verify Ed25519 signatures** over `timestamp + raw_body` using the unparsed bytes, 401 on failure (`discord_interactions.py:49-66`); the notifier sets `allowed_mentions: {"parse": []}` on every post, preventing embed-driven mention injection.
- **CSP is strict**: `default-src 'self'`, no `unsafe-inline`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, single-sourced in middleware so it covers dev-served and prod-nginx-proxied HTML alike; `upgrade-insecure-requests` only when HSTS is on.
- **Prod hardening is real** — non-root uid 10001, datastores on an internal network with no published ports, only nginx exposed (defaulting to loopback), digest-pinned service images, anonymous Grafana off, `:?set X` guards aborting startup on any missing secret, secrets gitignored with `change-me` placeholders in the example.
- **Fail-loud-not-closed** — a bare uvicorn run *warns* that `/metrics`/`/stats` are unauthenticated rather than silently exposing them.

## Priority

Fix #1 (authenticate `legacy_pid`) and #2 (rate-limit + de-oracle the auth routes) when convenient; fix #5 (escape the profile interpolations) *before* shipping any profile-edit feature — that one is a trap with a tripwire attached to your roadmap.
