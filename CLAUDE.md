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
  index.html             screens + overlay markup, loads CSS and main.js
  css/
    base.css             vars, reset, html/body, .screen, input, .btn, .error-msg
    landing.css          landing + join screens, logo, tagline, form-stack
    lobby.css            #lobby, code display, SMS button, player list, badges
    game.css             #game layout, round header, my-area, dice zones, roll button
    players-bar.css      top-bar mini cards (.player-mini-*)
    dice.css             .die-scene / .die-3d / .face / tumble + pop animations
    overlays.css         winner / disconnect / reconnecting modals, popIn, spinners
  js/
    main.js              entry: button + keyboard wiring, deep-link, auto-reconnect
    state.js             single mutable bag shared across modules
    util.js              esc, showScreen (View Transitions wrapper),
                         nextTarget, setError, setJoinError
    names.js             ADJECTIVES (50) × NOUNS (50) → makeName() — client-side
    dice.js              FACE_ROTATIONS, makeDie, placeGrid, myDiceKey
    overlays.js          winner / disconnect / reconnecting <dialog> logic
    screens.js           renderLobby, renderPlayersBar, renderMyArea, renderGame
    animations.js        startShake, updateDiceInPlace, tryReveal, resetRollState
    roll.js              roll() — send intent, shake, schedule reveal
    landing.js           create/join/lobby actions, random-name placeholder
    ws.js                connect, reconnect loop, handleMessage dispatch
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
| `roll` | roll unlocked dice |
| `roll_done` | client signals its reveal animation has completed |

**Server → client** (`type` field):
| type | description |
|------|-------------|
| `welcome` | connection established; contains `player_id` |
| `state` | full game state snapshot |
| `round_won` | state snapshot with `winner_name`; triggers overlay |
| `error` | `msg` field with human-readable reason |

The full state snapshot shape is defined by `state_msg()` in `server/game.py`. It includes `target`, `round_num`, `started`, `host`, and a `players` dict with `name`, `dice`, `wins`, `has_rolled`, and `roll_count` per player.

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
