# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the server

```bash
docker compose up -d          # start (auto-reloads on file changes via uvicorn --reload)
docker compose logs -f        # tail server logs
docker compose down           # stop
```

The volume mount in `docker-compose.yml` means edits to any file are live immediately — no rebuild needed unless `requirements.txt` changes.

## Architecture overview

Tensies is a real-time multiplayer dice game. There is no database — game state lives in two in-memory dicts defined in `server/state.py`:

```python
games: dict[str, dict]               # game_code → game state
connections: dict[str, dict[str, WebSocket]]  # game_code → {player_id: ws}
```

Games are destroyed when the last player disconnects.

### Code layout

```
main.py                  six-line FastAPI entry — wires the routers together
server/
  config.py              constants (MIN_ROLL_INTERVAL, ROLL_ACK_TIMEOUT,
                         DISCONNECT_GRACE, ROUND_WIN_DELAY) and logging setup
  state.py               module-level games & connections dicts
  assets.py              cache-busting: globs static/css and static/js, appends
                         ?v=<sha1[:8]> to every /static/*.css|js href in index.html
  game.py                pure game logic — new_game, fresh_player, apply_roll,
                         deal_round, next_target, state_msg
  broadcast.py           broadcast, delayed_broadcast, drop_player
  routes.py              GET /  (the only HTTP route — everything else is /ws)
  ws.py                  @app.websocket("/ws") — Session class plus one
                         handle_<action>() per action, dispatched via ACTIONS dict

static/
  index.html             screens + winner-overlay markup, loads CSS and main.js.
                         First-paint screen is #loading (hardcoded .active);
                         JS bootstrap decides what to show next so there's no
                         landing flash before reconnect kicks in.
  css/
    base.css             vars, reset, html/body, .screen, input, .btn, .error-msg
    loading.css          #loading fullscreen + indeterminate progress bar
                         (matches .player-mini-progress aesthetic)
    landing.css          landing + join screens, logo, tagline, form-stack
    lobby.css            #lobby, code display, SMS button, player list, badges
    game.css             #game layout, round header, my-area, dice zones, roll button
    players-bar.css      top-bar mini cards (.player-mini-*)
    dice.css             .die-scene / .die-3d / .face / tumble + pop animations
    overlays.css         winner <dialog> only (disconnect/reconnect dialogs
                         became the #loading screen)
  js/
    main.js              entry: button + keyboard wiring, deep-link, auto-reconnect
    state.js             single mutable bag shared across modules
    util.js              esc, showScreen (View Transitions wrapper),
                         nextTarget, setError, setJoinError
    names.js             ADJECTIVES (50) × NOUNS (50) → makeName() — client-side
    dice.js              FACE_ROTATIONS, makeDie, placeGrid, myDiceKey
    dice-positions.js    localStorage persistence for the unmatched-zone layout
    overlays.js          winner <dialog> + showLoading + waitingText helper
    screens.js           renderLobby, renderPlayersBar, renderMyArea, renderGame
    animations.js        startShake, updateDiceInPlace, tryReveal, resetRollState
    roll.js              roll() — send intent, shake, schedule reveal
    landing.js           create/join/lobby actions, random-name placeholder
    ws.js                connect, reconnect loop, handleMessage dispatch
                         (showFor centralizes lobby / loading / game routing)
    touch.js             iOS double-tap zoom prevention (side-effect import)
    components/
      player-card.js     <player-card> custom element for the players bar
      round-target.js    <round-target> custom element for the round header die
```

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

The host toggles `pause` (first feature in the in-game menu, `static/js/menu.js`). `handle_pause` flips `game["paused"]` and broadcasts. While paused:

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

The roll button is rebuilt by `renderMyArea()` on every render, so its click handler is attached via event delegation on `#my-area` in `main.js` rather than per-render.

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
