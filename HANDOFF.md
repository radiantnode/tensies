# Handoff — Discord integration

Working branch: **`claude/quirky-newton-vnemf7`** (all work committed + pushed).
Scope: a Discord integration for Tensies — live game-status cards in an
`#operations` channel, plus a `/verify` slash command. Built for internal use.

## TL;DR of current state

- **Notifier (game cards):** ✅ built, tested, **working against the real Discord
  channel.** One live-updating embed per game (post on start → edit per round
  win → finalise on end). Verified end-to-end, including 5 concurrent games.
- **`/verify` slash command:** ✅ built, logic + endpoint tested. **Dormant until
  3 env vars are set** (`DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`,
  `DISCORD_GUILD_ID`) and the Interactions Endpoint URL is registered in the
  Discord Developer Portal. The live Discord→app round-trip is the one thing not
  yet exercised (needs a public HTTPS URL — see "Pending").
- No PR opened yet (waiting on the user's go-ahead).

## Commits on this branch (newest last)

1. `Add optional Discord game-status notifier` — the live cards.
2. `Add /verify Discord slash command (Roll Trust verification)`.

## What's built

### 1. Game-status cards (`server/discord.py`)
A bus subscriber (sibling of `server/telemetry/live.py`) that turns
`game_started` / `round_won` / `game_ended` into **one editable embed per game**.
Posts via the bot REST API (`Authorization: Bot …`, no gateway). Per-game state
(message id + win tally) lives in Redis `discord:card:{code}` (atomic
HSET/HINCRBY) so it's correct across instances and final standings survive game
deletion. Edits coalesced over a 0.4 s window; 429s honour `retry_after`. All
failures swallowed + metered — gameplay never affected.

### 2. `/verify` slash command (`server/discord_interactions.py`)
Run inside a game's **card thread**; replies in-thread with that game's
[Roll Trust](docs/ROLL_TRUST.md) results (drand-backed rolls re-derived from the
public beacon, per-player ✅/❌/⚠️ breakdown).

- Transport: **HTTP interactions endpoint** `POST /discord/interactions` (NOT the
  gateway) — stateless, multi-instance-safe. Verifies Discord's Ed25519 signature
  on every request (`cryptography`, already in the tree via webauthn — no new
  dep), ACKs pings, defers `/verify` (beacon fetch can exceed Discord's 3 s
  budget) then edits the response in-thread.
- **How it resolves to a game:** on game end the notifier opens a thread on the
  card (`Roll Trust — {code}`). A thread started from a message shares that
  message's id (verified live), and a durable Redis map
  `discord:game_by_msg:{message_id}` (30-day TTL, NOT deleted on game end) ties
  it back to the code. So the interaction's `channel_id` resolves straight to the
  game — no arguments.
- Shared logic: `server/rolltrust.py::verify_game()` was extracted from the
  existing `GET /api/game/{code}/verify` route so the route and the command share
  one implementation.

## Key files

| File | Role |
|------|------|
| `server/discord.py` | Notifier (cards) + durable msg→game map + auto-thread + command registration + follow-up helper |
| `server/discord_interactions.py` | `POST /discord/interactions` — signature verify, dispatch, `/verify` embed |
| `server/rolltrust.py` | `verify_game(code)` — shared Roll Trust logic |
| `server/routes.py` | `GET /api/game/{code}/verify` now just calls `verify_game` |
| `server/config.py` | All `DISCORD_*` settings |
| `server/telemetry/metrics.py` | `tensies_discord_messages_total`, `_failures_total`, `_interactions_total` |
| `main.py` | Boots notifier in lifespan; includes the interactions router |
| `docs/DISCORD.md` | Full setup docs (bot, cards, `/verify`) |

## Config / env vars

Set in the environment (secrets stay out of git). Notifier needs the first three;
`/verify` needs all six.

| Var | For | Notes |
|-----|-----|-------|
| `DISCORD_ENABLED=1` | both | master switch (default off) |
| `DISCORD_BOT_TOKEN` | both | secret |
| `DISCORD_CHANNEL_ID` | cards | target channel |
| `DISCORD_PUBLIC_KEY` | `/verify` | Dev Portal → General Information |
| `DISCORD_APPLICATION_ID` | `/verify` | Dev Portal → General Information |
| `DISCORD_GUILD_ID` | `/verify` | right-click server → Copy Server ID |

Compose files forward all of these to `web`. Bot identity confirmed as **Tensies**
in the **operations** channel.

## Running & testing locally

```bash
docker compose up -d           # web on :8888, redis, telemetry stack
docker compose logs -f web
```

Look for `discord notifier started  channel=…` and (once the `/verify` vars are
set) `discord /verify registered to guild …`.

**Sandbox-only caveat (does NOT apply on a normal machine):** Claude Code on the
web routes outbound HTTPS through a TLS-intercepting proxy whose CA isn't in
certifi, so the app's httpx couldn't verify `discord.com`. In the sandbox we
appended the proxy CA to the container's certifi bundle at runtime (lost on
container *recreate* — re-append if needed). **Locally you don't need this** —
Discord verifies against certifi normally. Nothing in the committed code touches
TLS.

## Verified vs pending

**Verified:**
- Cards: full lifecycle (start→per-round→final) against the real channel; 5
  concurrent games each as an isolated single message; 0 API failures.
- `/verify` endpoint (in-process): bad sig→401, ping→PONG, in-thread→deferred +
  correct embed, out-of-thread→ephemeral, all embed shapes.
- Real Discord: card post, durable map + `game_for_message` lookup, and the
  auto-thread whose id == card message id (the resolution lynchpin). Bot has
  Create Public Threads.

**Pending / not yet done:**
1. **Live `/verify` round-trip in Discord.** Needs the 3 slash-command env vars +
   the Interactions Endpoint URL set to `https://<host>/discord/interactions`.
   Discord must reach the app over **public HTTPS** — `localhost` won't work, so
   this needs a **deploy** (e.g. `tensies.app`) or a **tunnel** (cloudflared).
   Discord won't even save the endpoint URL until it can ping it successfully.
2. **Verify against a game with real drand rolls.** `/verify` only returns
   meaningful results for games played with `ENABLE_DRAND_ROLLING=1` and
   `TELEMETRY_ENABLED=1`; forced/synthetic test games have no beacon-backed
   rolls and report "no beacon data".
3. **Open a PR** (not done — user hadn't asked yet).

## Offered-but-not-built (open ideas)

- `round_started` polish so the active card's "Round N · target" tracks the
  *current* round exactly (today it shows the last *won* round).
- Per-player avatars/thumbnails, join/leave lines on the card.
- More slash commands (this is the foundation; the gateway/interactions pattern
  generalises).

## Leftover demo artifacts in the channel

The real-Discord tests left a few finished game cards (and a `Roll Trust — TVERI`
thread) in `#operations`. Harmless; delete if you want a clean channel.
