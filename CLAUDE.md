# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the server

```bash
docker compose up -d          # local dev: starts web + redis + the telemetry stack
docker compose logs -f        # tail server logs
docker compose down           # stop
```

The volume mount in `docker-compose.yml` means edits to any file are live immediately — no rebuild needed unless `requirements.txt` changes. **`docker-compose.yml` is local-dev-only** (default creds, published admin ports, bind mount, `--reload`). For any shared/public deploy use **`docker-compose.prod.yml`** (built image, non-root, internal network, secrets from env, gated `/metrics`+`/stats`). See `.env.prod.example`.

**Redis is required** — game state and cross-instance fan-out live in Redis (`REDIS_URL`), so the app can run as multiple instances behind a plain round-robin load balancer (no sticky sessions). Postgres/Grafana telemetry is **optional**: set `TELEMETRY_ENABLED=0` for a lightweight run (Prometheus `/metrics` still works in-process).

```bash
# scale to N instances (they share Redis; any instance serves any game)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --scale web=3
```

## Git submodules

The [humanizer](https://github.com/blader/humanizer) writing skill is vendored as a **git submodule** at `.claude/skills/humanizer/` (the changelog skill runs it as a final pass). A fresh clone leaves that directory empty until the submodule is fetched:

```bash
git clone --recurse-submodules <repo-url>   # clone with submodules, or…
git submodule update --init --recursive      # …populate them after a plain clone
```

If `.claude/skills/humanizer/SKILL.md` is missing, the skill won't load — run the `update --init` above. To pull upstream humanizer changes, `git submodule update --remote .claude/skills/humanizer`, then commit the bumped pointer.

## Architecture overview

Tensies is a real-time multiplayer dice game. Game state lives in **Redis** (`server/gamestore.py`) so any instance can serve any game. Per-process state in `server/state.py` is strictly local: the sockets this instance terminates plus registries of live asyncio objects that can't be serialised.

```python
# Redis (shared across instances) — server/gamestore.py
#   game:{code}      hash: game scalars + namespaced per-player fields (p:{pid}:*)
#   games:index      set of live codes (reaper + active-games gauge)
# Process-local — server/state.py
connections: dict[str, dict[str, WebSocket]]  # local sockets only; cross-instance
                                              # fan-out via server/fanout.py (Redis pub/sub)
sessions, ack_events, drop_tasks, pause_tasks # live asyncio objects, owned by this instance
```

Games are destroyed when the last player disconnects. Distinct players write distinct hash fields (atomic `HSET`/`HINCRBY`, no contention), so simultaneous rolling stays parallel; the one contended write — crowning the round winner — is an atomic Lua compare-and-set (`try_finish_round`). A periodic **reaper** (`server/reaper.py`) is the cross-instance backstop for grace-drops / pause-caps whose owning instance died, and publishes the global active-games gauge (aggregate it with `max()` across instances, not `sum()`).

Key env vars (`server/config.py`): `REDIS_URL`, `TELEMETRY_ENABLED`, `ALLOWED_ORIGINS` (WS origin allowlist), `METRICS_TOKEN`/`STATS_TOKEN` (bearer-gate `/metrics`+`/stats`), `MAX_GAMES`, `MAX_PLAYERS_PER_GAME`, `MAX_CONNECTIONS_PER_IP`, `CREATE_RATE_*`/`JOIN_RATE_*`, `MAX_WS_MESSAGE_BYTES`.

### Code layout

```
main.py                  FastAPI entry — lifespan boots gamestore + fanout +
                         telemetry + reaper, then wires the routers together
server/
  config.py              constants (gameplay, Redis, abuse caps, origin
                         allowlist, endpoint tokens, telemetry flag) + logging
  state.py               process-local connections + sessions + ack/timer registries
  gamestore.py           Redis-backed game state: pool, Lua (create/join/finish/
                         drop), snapshot rebuild, abuse limiters, make_code
  fanout.py              cross-instance broadcast over Redis pub/sub (bcast:*)
  reaper.py              periodic backstop for grace-drops/pause-caps + active gauge
  assets.py              cache-busting: globs static/css and static/js, appends
                         ?v=<sha1[:8]> to every /static/*.css|js href in index.html
  game.py                pure game logic — apply_roll, next_target, state_msg,
                         sanitize_name, reconnect-token mint/verify
  broadcast.py           send, broadcast (→ fanout), delayed_broadcast,
                         advance_round, drop_player/do_drop, pause_timeout
  routes.py              GET / + bearer-gated /metrics and /stats/*
  ws.py                  @app.websocket("/ws") — Session, security guards
                         (origin/size/caps/rate-limit), handle_<action>() dispatch

The frontend is vanilla **web components + a native History-API router**, no
build step. Each screen is a light-DOM custom element whose host element *is*
the `#id.screen` (so global CSS applies); `index.html` is a thin shell. First
paint is the inline `#loading` section, which renders from inline critical CSS
with no JS in the path.

**Tensies is mobile-only — always test the frontend at a mobile resolution**
(the pixel harness baselines are **390×844** @2× dpr). When driving the app in a
browser (Playwright/manual), set a mobile viewport first; never validate a
frontend change at desktop width.

```
static/
  index.html             thin shell: inline critical CSS (tokens + reset + logo +
                         the #loading screen), async-loaded CSS, the <*-screen>
                         component tags, and the pause/winner <dialog> overlays.
  css/                   (tokens, document reset, and #loading are inline-critical
                         in index.html; the rest load async, non-render-blocking)
    controls.css         inputs, .btn variants, .error-msg
    shell.css            shared .game-topbar / app-header / .screen-body
    landing.css          landing + join screens, logo, tagline, form-stack
    lobby.css            #lobby, code display, SMS button, player list, badges
    game.css             #game layout, round header, my-area, dice zones, roll button
    players-bar.css      top-bar mini cards (.player-mini-*)
    dice.css             .die-scene / .die-3d / .face / tumble + pop animations
    menu.css             game menu + nav menu (about / changelog) + pause status
    overlays.css         winner + pause <dialog> styling
  js/
    app.js               entry: register components, seed name, bootstrap router
    router.js            History-API router (permalinks), bootstrap, showJoin
    transitions.js       showScreen (View Transitions), showLoading, leaveLoading
    state.js             single mutable bag shared across modules
    util.js              esc, nextTarget, setError, setJoinError
    net.js               WebSocket: connect, dispatch, create/join/start intents,
                         showFor (lobby / game / pause / disconnect routing)
    names.js             ADJECTIVES (50) × NOUNS (50) → makeName()
    pips.js              PIP_POSITIONS — die-face pip layout (shared by the dice)
    dice.js              FACE_ROTATIONS, makeDie, placeGrid, myDiceKey
    dice-positions.js    localStorage persistence for the unmatched-zone layout
    game-render.js       renderGame / renderPlayersBar / renderMyArea / renderMenu
    animations.js        startShake, updateDiceInPlace, tryReveal, resetRollState
    roll.js              roll() — send intent, shake, schedule reveal
    overlays.js          winner + pause dialogs (showWinner / showPaused / …)
    title-row.js         shared top-bar title row markup (app-header + game header)
    components/          light-DOM custom elements; the host IS the #id.screen
      app-header.js      <app-header> shared top bar (hamburger → nav menu)
      landing-screen.js  <landing-screen>  (#landing)
      join-screen.js     <join-screen>     (#join)
      lobby-screen.js    <lobby-screen>    (#lobby) — render(snap)
      game-screen.js     <game-screen>     (#game) + in-game pause menu
      nav-menu.js        <nav-menu> about blurb + "What's New" changelog
      player-card.js     <player-card> players-bar mini card
      round-target.js    <round-target> round-header die
```

(The loading screen is inline HTML in `index.html`, not a component, so it
paints before JS. The old single-file modules — `main.js`, `ws.js`, `screens.js`,
`menu.js`, `landing.js`, `loading.css`, `base.css` — were replaced in the
component rewrite; behaviour is unchanged.)

### WebSocket message protocol

**Client → server** (`action` field):
| action | description |
|--------|-------------|
| `create` | create new game; payload: `name` |
| `join` | join existing game; payload: `name`, `code` |
| `start` | host starts the game (host only) |
| `pause` | host-only toggle that freezes/unfreezes rolling for everyone |
| `roll` | roll unlocked dice |
| `roll_done` | client signals its reveal animation has completed |

**Server → client** (`type` field):
| type | description |
|------|-------------|
| `welcome` | connection established; contains `player_id` |
| `state` | full game state snapshot |
| `round_won` | state snapshot with `winner_name`; triggers overlay |
| `error` | `msg` field with human-readable reason |

The full state snapshot shape is defined by `state_msg()` in `server/game.py`. It includes `target`, `round_num`, `started`, `paused`, `host`, and a `players` dict with `name`, `dice`, `wins`, `has_rolled`, and `roll_count` per player.

A terminal `error` frame carries `fatal: true` (the only producer today is the pause cap below). The client clears its saved session and returns to the landing screen instead of treating it as an in-game error.

### Pause (host-only)

The host toggles `pause` (first feature in the in-game menu, `static/js/components/game-screen.js`). `handle_pause` flips `game["paused"]` and broadcasts. While paused:

- **Rolls are rejected** (`handle_roll` guards on `paused`; the client also disables the roll button and guards `roll()`).
- **Non-host players see the `#loading` screen** ("Waiting for &lt;Host&gt; to resume the game") via `showFor()`; the host keeps the board — even with players offline — so the menu stays reachable. The paused branch in `showFor` precedes the disconnect-loading branch precisely so a paused host isn't bounced to a "waiting to reconnect" screen.
- **The host's menu shows live status while paused.** `state_msg` adds `pause_remaining_ms` (from `pause_deadline_mono`); `renderMenu()` runs a local 1 Hz countdown plus an "X of Y connected" count so the host can wait for stragglers. A host returning from reconnect lands on `#loading`, so `showFor` calls `openMenu()` on the swap to surface the resume toggle. Resuming closes the menu; pausing leaves it open.
- **Players are never dropped — but the host isn't a single point of failure.** `drop_player` returns early when paused, so a disconnect (host backgrounding their phone) doesn't end the game. The client extends its reconnect window to ~1 h (`PAUSED_RECONNECT_WINDOW_MS`) when its last-known state was paused. The one exception: if the *host* is the one who's been gone past `DISCONNECT_GRACE`, `drop_player` hands the host role (and the resume control) to a still-connected player instead of dropping anyone — so an absent host can't freeze the table until the cap.
- **A round won during the pause window doesn't slip past it.** `delayed_broadcast` advances the round after `ROUND_WIN_DELAY`; if a pause landed in that window it sets `round_advance_pending` and freezes instead, and `handle_pause` calls `advance_round()` on resume.
- **A pause that lands mid-reveal on a roller isn't lost.** A non-host who is mid-roll when the host pauses holds the pause snapshot in `state.postRevealState`; `tryReveal` re-routes through `showFor()` once the reveal finishes, so the roller lands on the wait screen instead of being stranded on the board.
- **A cap backstops abandonment.** `handle_pause` schedules `pause_timeout()` for `PAUSE_MAX` (1 h); if still paused then, the game is ended (fatal `error` broadcast + cleanup). Resume cancels the watchdog and reschedules a normal `DISCONNECT_GRACE` drop for anyone still offline. Re-pausing starts a fresh `PAUSE_MAX` — intentional, since an actively-toggling host isn't an abandoned game.

### Delayed broadcast (key design detail)

When a player rolls, the server immediately sends the result back to **only that player** so their reveal animation can start. It then waits for a `roll_done` ack (or a `ROLL_ACK_TIMEOUT`-second timeout) before broadcasting the new state to everyone else. This ensures other players don't see the dice change until the roller's animation completes.

This is implemented in `delayed_broadcast()` (`server/broadcast.py`) via an `asyncio.Event` stored on the player dict as `ack_event`. The client fires `roll_done` when its reveal animation ends, handled by `handle_roll_done()` in `server/ws.py`.

### Round lifecycle

1. Host clicks Start → `handle_start` calls `deal_round()` (10 fresh dice each), sets `started=True`
2. Players roll; `apply_roll()` re-randomises unlocked dice and auto-locks any that match `target`
3. First player to lock all 10 wins the round → `handle_roll` sets `round_over=True`, sends `round_won` privately and schedules a `delayed_broadcast`
4. After `ROUND_WIN_DELAY` seconds, `delayed_broadcast` advances `target` (cycles 6→5→4→3→2→1→6), increments `round_num`, calls `deal_round()` again to clear per-round state

### Cache-busting

At import time, `server/assets.py` hashes every CSS/JS file under `static/css/` and `static/js/`, then rewrites every `/static/*.css|.js` URL in `index.html` to append `?v=<sha1[:8]>`. No build step needed — changing any static file changes the hash on the next server restart.

### Client-side animation state

The roll animation is sequenced across several flags on the shared `state` object exported by `static/js/state.js`:
- `rolling` — true while the shake animation is running
- `awaitingAck` — true while waiting for the server's roll response after the shake ends
- `pendingRollState` — holds the server's state response until the shake finishes
- `pendingWinName` / `pendingWinTarget` — held until the reveal completes, then the winner overlay is shown

`myDiceKey()` (in `dice.js`) includes `roll_count` in its fingerprint so a re-roll that lands on identical values still triggers a re-render (fixes a hang where the client couldn't detect that a new roll had arrived).

The roll button is rebuilt by `renderMyArea()` on every render, so its click handler is attached via event delegation on `#my-area` in `components/game-screen.js` rather than per-render.

### Host transfer

When the host disconnects, `drop_player()` (in `server/broadcast.py`) promotes the first remaining player in the `players` dict to host and broadcasts the updated state. No explicit vote or confirmation.

## Telemetry

Every meaningful game event flows through `server.telemetry.emit()` to a Postgres event log + rollup tables, a Prometheus `/metrics` surface, and Grafana Live channels for sub-second dashboards. `emit()` is sync and non-blocking — the roll handler never awaits I/O. Full reference: [`docs/TELEMETRY.md`](docs/TELEMETRY.md).

Compose adds four services beside `web`: `postgres`, `prometheus`, `grafana` (anonymous viewer on **port 8889** to avoid colliding with other local Grafanas), and `postgres_exporter`. The web app itself is on **port 8888**.

Key invariants when touching the server modules:

- **Never `await` on the telemetry path.** `emit()` and Prometheus `.inc()`/`.observe()` are synchronous and safe to call from any hot path (the roll handler, `apply_roll`, broadcast). Postgres writes happen on a background task draining the queue.
- **All outbound WS frames go through `server.broadcast.send()`.** It handles JSON encoding, the per-Session `send_lock` (which prevents the Pinger task from interleaving frames with the receive-loop handler), and the outbound metric counters. Never call `ws.send_text` directly.
- **When you add a new event type or game state transition,** emit it from the relevant handler in `server/ws.py` or `server/broadcast.py` and (optionally) add a rollup handler in `server/telemetry/writer.py` keyed by the event type. Events without a handler still land in the `events` table; they just don't update rollups.
- **When you add a new metric,** define it in `server/telemetry/metrics.py` so there's one source of truth. Keep label cardinality low — never label by `user_id` or `game_code` (those go to Postgres).
- **`apply_roll()` returns a result dict** (`matched`, `newly_locked`, `rolled_values`, `dice_before/after`, `locked_before/after`). `server/game.py` stays telemetry-free; `handle_roll` consumes the rest for the `roll` event payload.
- **Dashboards live in `ops/grafana/dashboards/*.json`** and are provisioned automatically; edits in the UI don't persist across `docker compose down`.
