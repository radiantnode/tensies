# Tensies Attitude System

Tensies has a server-decided voice called the attitude system. Every piece of UI copy (error messages, lobby text, roll commentary, win/loss screens, idle nags) can be rewritten by a phrase pack served at startup. The operator picks a rudeness level; the client never sees phrases above that level.

The system is off by default. At level `off`, the client uses its built-in copy and the attitude module is completely inert: no `Math.random` calls, no localStorage writes, no DOM changes. This is load-bearing because the pixel-regression harness depends on `state.js` being the first RNG consumer.

---

## Quickstart

Set the level in `docker-compose.yml` (or the env var directly) and restart:

```yaml
ATTITUDE_LEVEL: heckler    # off | friendly_drunk | heckler | who_invited_him | intolerable
```

A full `docker compose down && docker compose up -d` is needed for env var changes (plain `restart` reuses the old env). The client caches the pack via ETag, so a hard refresh in the browser picks up the new level.

---

## Levels

| Index | Name | Tone |
|---|---|---|
| 0 | `off` | Silent. Built-in copy only. |
| 1 | `friendly_drunk` | Enthusiastic, supportive, tipsy energy |
| 2 | `heckler` | Sarcastic, judgmental |
| 3 | `who_invited_him` | Hostile, dismissive |
| 4 | `intolerable` | Maximum rudeness, profane |

When a scenario is missing at the requested level, it falls back *down* the scale (intolerable tries who_invited_him, then heckler, then friendly_drunk). It never falls *up*, so a player at a polite level never receives an upper tier's profanity. The server resolves this at startup, not at request time.

---

## How it works

### Server side (`server/attitude.py`)

At import, the module reads `attitude.json` from the repo root (configurable via `ATTITUDE_FILE`), flattens the nested phrase tree into dot-path keys (`winner.flavor_lose`, `errors.game_not_found`, etc.), and pre-serializes all five level payloads. The route `GET /attitude.json` returns the active level's payload with an ETag for caching.

The response shape:

```json
{
  "level": "heckler",
  "levels": ["off", "friendly_drunk", "heckler", "who_invited_him", "intolerable"],
  "player_choice": false,
  "nicknames": ["chief", "ace", "professor", "hotshot", "high roller"],
  "phrases": {
    "greeting": ["..."],
    "roll.bust": [{"when": {"bust_streak": ">=3"}, "text": "...", "weight": 1}, "..."],
    ...
  }
}
```

### Client side (`static/js/attitude.js`)

The module fetches the pack at boot and exposes two main functions:

- `quip(key, fallback, vars)` picks a weighted-random variant from the pack, filters by `when` conditions against the current gameplay context, interpolates placeholders, and avoids repeating the last line. Returns `fallback` when the pack isn't loaded or the key is missing.
- `quipSticky(key, fallback, vars)` is the same thing but memoized, for labels that re-render on every snapshot (prevents the text from changing each frame).

`toast(text)` flashes a line on the board's `#quip-toast` element (absolutely positioned, no reflow). It auto-hides after 4.5 seconds.

---

## Phrase pack format (`attitude.json`)

The pack is a nested object. Leaf nodes are objects keyed by level name, each containing an array of variants:

```json
{
  "roll": {
    "bust": {
      "friendly_drunk": ["Aww, no matches!", "Better luck next time!"],
      "heckler": [
        "Nothing. Crowd goes mild.",
        {"when": {"bust_streak": ">=3"}, "text": "Three busts in a row? Impressive, {nickname}.", "weight": 2}
      ]
    }
  }
}
```

The server flattens this to `roll.bust` and picks variants at or below the active level.

### Variant types

A variant is either a plain string or an object with:

| Field | Required | Description |
|---|---|---|
| `text` | yes | The line to display |
| `when` | no | Conditions that must all match for this variant to be eligible |
| `weight` | no | Selection weight (default 1). Higher weight means more likely to be picked |

Conditioned variants (those with `when`) are preferred over unconditioned ones when they match.

### Placeholders

Wrap in `{curly braces}` inside variant text:

| Placeholder | Source |
|---|---|
| `{nickname}` | Hash-picked from the player's stable ID. Persistent across sessions. |
| `{time}` | Current time, e.g. "3:45pm" |
| `{daypart}` | `late_night`, `morning`, `afternoon`, `evening`, `night` |
| `{host}` | Host player's name |
| `{name}` | Player name (context-dependent) |
| `{target}` | Current die target |
| `{count}` | Dice matched this roll |
| `{round}` | Current round number |

Unknown placeholders are left intact (visible sign of a pack error, not silently swallowed).

### Nicknames

Each level defines a pool of pet names. The client hashes the player's stable `tensies_pid` via FNV-1a and indexes into the pool, so each player gets the same nickname for the duration of their session (and across visits, as long as the pid persists).

```json
"nicknames": {
  "heckler": ["chief", "ace", "professor", "hotshot", "high roller"]
}
```

Level `off` has no nicknames. The fallback is `"friend"`.

---

## Conditions (`when`)

Conditions filter which variants are eligible. All conditions on a variant must match for it to be considered.

### Numeric conditions

Support comparison operators: `>=`, `<=`, `>`, `<`, `==`. Plain numbers mean exact match.

| Field | What it tracks |
|---|---|
| `bust_streak` | Consecutive rolls with zero new matches |
| `win_streak` | Consecutive rounds won |
| `loss_streak` | Consecutive rounds lost |
| `behind_by` | Leader's matched dice minus mine (0 when leading) |
| `round` / `round_num` | Current round number |
| `rounds_played` | Total rounds played this session |
| `idle_secs` | Seconds since last roll or round start |
| `lifetime_wins` | Career wins (from localStorage) |
| `lifetime_losses` | Career losses (from localStorage) |
| `lifetime_visits` | Total site visits (from localStorage) |
| `days_since_played` | Days since last visit |

### Boolean conditions

| Field | Meaning |
|---|---|
| `is_first_time` | Player has no prior localStorage entry |
| `is_weekend` | Saturday or Sunday |

### String conditions

| Field | Values |
|---|---|
| `daypart` | `late_night` (00:00-05:00), `morning` (05:00-12:00), `afternoon` (12:00-17:00), `evening` (17:00-21:00), `night` (21:00-00:00) |

---

## Scenario keys

Every voiced surface in the UI maps to a scenario key.

### Connection and navigation

| Key | Where it appears |
|---|---|
| `greeting` | Landing screen tagline |
| `loading` | Loading screen text |
| `reconnecting` | Reconnection status |
| `waiting_reconnect` | Waiting for opponent to reconnect |

### Errors

The server sends error frames with a `code` field. The client maps `code` to `errors.<code>` and falls back to the neutral `msg` if no attitude variant exists.

| Key | Trigger |
|---|---|
| `errors.connection_failed` | WebSocket couldn't open |
| `errors.game_not_found` | Join code doesn't exist |
| `errors.game_in_progress` | Can't join mid-game |
| `errors.game_full` | Max players reached |
| `errors.server_full` | `MAX_GAMES` hit |
| `errors.rate_limited` | Create/join rate cap hit |
| `errors.enter_code` | Empty join code submitted |
| `errors.paused` | Roll attempted while paused |
| `errors.pause_timeout` | Game ended by 1-hour pause cap |
| `errors.too_large` | WS message exceeds size limit |

### Lobby

| Key | Where |
|---|---|
| `lobby.waiting` | Lobby heading |
| `lobby.invite` | Invite instructions |
| `lobby.waiting_for_host` | Non-host waiting for game start |

### Pause

| Key | Where |
|---|---|
| `pause.waiting_for_host` | Pause dialog text |
| `pause.everyone_here` | All players connected during pause |
| `pause.waiting_on` | Listing disconnected players |
| `roll_button_paused` | Roll button text while paused |

### Gameplay

| Key | When |
|---|---|
| `roll.bust` | Roll matched zero new dice |
| `roll.good` | Roll matched 3+ new dice |
| `roll.one_left` | 9 of 10 dice matched |
| `round.start` | New round begins |
| `idle_nag` | Player hasn't rolled in 30+ seconds |

### Win/loss overlay

| Key | Where |
|---|---|
| `winner.flavor_win` | Flavor text under winner's name (shown to the winner) |
| `winner.flavor_lose` | Flavor text under player's name (shown to losers) |
| `winner.near_miss` | Flavor text when the loser had 9 of 10 matched |

---

## Per-player memory

The client stores lifetime stats in localStorage under the key `tensies_attitude`:

```json
{
  "visits": 5,
  "wins": 12,
  "losses": 8,
  "busts": 42,
  "last_played": 1718260547000
}
```

These feed the `lifetime_*`, `days_since_played`, and `is_first_time` conditions. At level `off`, nothing is read or written.

---

## Configuration

All env vars, with defaults:

| Variable | Default | Purpose |
|---|---|---|
| `ATTITUDE_LEVEL` | `off` | Active level (name or 0-4 index) |
| `ATTITUDE_FILE` | `attitude.json` | Path to the phrase pack |
| `ATTITUDE_PLAYER_CHOICE` | `false` | Allow `?level=` query parameter on `/attitude.json` |
| `ATTITUDE_MAX_LEVEL` | `intolerable` | Ceiling when player choice is enabled |

When `ATTITUDE_PLAYER_CHOICE` is on, the client can request a specific level via `GET /attitude.json?level=friendly_drunk`. The server clamps the request to `ATTITUDE_MAX_LEVEL`, so an operator can let players pick their comfort level without exposing the top tiers.

---

## Integration points

The attitude module touches these files:

| File | What it does |
|---|---|
| `static/js/attitude.js` | Pack loader, `quip()`, `quipSticky()`, `toast()`, context tracking, memory |
| `static/js/overlays.js` | Winner/loser flavor text, pause dialog copy |
| `static/js/animations.js` | Roll outcome toasts (`recordRoll` + `toast`) |
| `static/js/net.js` | Error message voicing, `recordRoundEnd` |
| `static/js/roll.js` | `markActivity()` on roll |
| `static/js/router.js` | `observeSnapshot()` on every state update |
| `static/js/components/game-screen.js` | Idle nag polling (every 5 seconds) |
| `server/attitude.py` | Pack resolution, ETag'd serving |
| `server/routes.py` | `GET /attitude.json` endpoint |

---

## Adding a new scenario

1. Pick a dot-path key (e.g. `lobby.code_copied`).
2. Add variants to `attitude.json` under the appropriate nesting, keyed by level.
3. Call `quip('lobby.code_copied', 'Copied!', { code })` at the call site.
4. The fallback string is what shows at level `off` or if the pack hasn't loaded.

No server changes needed unless you're adding a new error code (in which case, add a `code` field to the error frame in `server/ws.py`).

---

## Test seam

On localhost, `window._attitude` exposes `{ ctx, quip, toast }` for testing rare conditions (long streaks, near-miss, idle nags) without playing dozens of rounds to trigger them naturally.
