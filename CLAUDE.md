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

Tensies is a real-time multiplayer dice game. The entire server is `main.py` (FastAPI + WebSocket). All client logic is in `static/game.js`. There is no database — game state lives in two in-memory dicts:

```python
games: dict[str, dict]               # game_code → game state
connections: dict[str, dict[str, WebSocket]]  # game_code → {player_id: ws}
```

Games are destroyed when the last player disconnects.

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

The full state snapshot shape is defined by `state_msg()` in `main.py`. It includes `target`, `round_num`, `started`, `host`, and a `players` dict with `name`, `dice`, `wins`, `has_rolled`, and `roll_count` per player.

### Delayed broadcast (key design detail)

When a player rolls, the server immediately sends the result back to **only that player** so their reveal animation can start. It then waits for a `roll_done` ack (or a 2-second timeout) before broadcasting the new state to everyone else. This ensures other players don't see the dice change until the roller's animation completes.

This is implemented in `delayed_broadcast()` via an `asyncio.Event` stored on the player dict as `ack_event`. The client fires `roll_done` when its reveal animation ends.

### Round lifecycle

1. Host clicks Start → server deals 10 fresh dice to each player, sets `started=True`
2. Players roll; unlocked dice re-randomise, matching dice auto-lock
3. First player to lock all 10 wins the round → server sets `round_over=True`, broadcasts `round_won`
4. After 3 seconds, server advances `target` (cycles 6→5→4→3→2→1→6), increments `round_num`, deals fresh dice, clears all per-round state

### Cache-busting

At startup, `main.py` hashes `style.css` and `game.js`, then injects `?v=<hash>` into `index.html` before serving it. No separate build step needed — changing a static file changes the hash on the next server restart.

### Client-side animation state

`game.js` tracks several module-level flags to sequence the roll animation correctly:
- `rolling` — true while the shake animation is running
- `awaitingAck` — true while waiting for the server ack to arrive after the shake ends
- `pendingRollState` — holds the server's state response until the shake finishes
- `pendingWinName` / `pendingWinTarget` — held until the reveal completes, then the winner overlay is shown

`myDiceKey()` includes `roll_count` in its fingerprint so a re-roll that lands on identical values still triggers a re-render (fixes a hang where the client couldn't detect that a new roll had arrived).

### Host transfer

When the host disconnects, the server promotes the first remaining player in the `players` dict to host and broadcasts the updated state. No explicit vote or confirmation.
