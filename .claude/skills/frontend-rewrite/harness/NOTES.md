# Field notes — capturing Tensies baselines

Hard-won specifics from building the baseline set against the live app. Read
this before writing or capturing a new state; it will save you the dead ends we
already hit. Everything here is about getting **byte-stable** screenshots of the
**current** app — none of it changes app code.

## The one technique that makes stateful capture easy

**The entire UI renders from inbound WebSocket frames.** So you do **not** need
to play a real multiplayer game, roll to a win, or wire up real guests. A
**single host connection** plus `pinWebSocket()` rewriting the post-create
`state` frame can synthesize *any* view — lobby, started board, `round_won`,
paused, even a terminal `error`. `stateful.spec.js` is the worked reference;
copy its `host()` helper.

How it works:
1. Drive a real host: `goto('/')` → fill `#name-input` → click create.
2. In the WS route, capture `welcome.player_id` (the real pid) and rewrite the
   next `state`/`round_won` frame into the view you want, keyed by that pid.
3. Render is deterministic because `seedPage()` pins the random bits.

Why capture the pid: host-vs-guest rendering keys off `state.myId` (set from
`welcome`). Set the frame's `host` to that pid for a **host** view (Start button,
pause menu); set it to a *different* id to render the **guest/non-host** view
(you-badge, "waiting for host", pause overlay).

`routeWebSocket` requires you to relay **both** directions manually
(`server.onMessage → ws.send`, `ws.onMessage → server.send`); see
`determinism.js::pinWebSocket`. Needs Playwright >= 1.48.

## Determinism — what `seedPage` + `settle` actually pin

- **`Math.random`** → the dice **scatter** (`dice.js::placeGrid` jitters x/y/rot
  with `Math.random`). Pinned, so scatter is identical every run. A fresh browser
  context starts with empty `localStorage`, so saved scatter positions
  (`dice-positions.js`) don't leak between runs either.
- **`Date.now`** → every countdown freezes: the **winner** timer
  (`overlays.js::startWinTimer`) and the **pause** countdown
  (`screens.js::renderMenu`, re-anchored to `Date.now()` each tick) both render a
  fixed value. The winner overlay reads `Next round starts in: NNs`; paused-host
  reads `60:00`.
- **`settle()`** waits `document.fonts.ready`, then pauses infinite animations
  and hides carets. `toHaveScreenshot({animations:'disabled'})` additionally
  fast-forwards finite CSS animations to their end state.

The proof that determinism held is the **second** verify run going zero-diff. If
anything leaked, run #2 goes red. Always re-run verify after capturing.

## `has_rolled` — the non-obvious one

For any **started** game, set `has_rolled: true` on players (and a non-zero
`roll_count`). It controls two things:

- **Players-bar progress** (`screens.js` ~L75): `matched = p.has_rolled ?
  count(dice==target) : 0`. Without it every bar reads 0/10.
- **My-area layout** (`renderMyArea`): `effectiveTarget = has_rolled ? target :
  -1`. Without it *no* die counts as matched, so nothing splits into the matched
  grid — every die scatters and the board looks pre-roll.

`stateful.spec.js` sets `has_rolled = dice.length > 0` in its `roster`/`mk`
helpers. Lobby frames keep dice `[]`, so they stay `has_rolled:false`.

## WS frame shapes (server → client)

Confirmed by observing a real game (`page.on('websocket')` → `framereceived`):

| type | keys |
|------|------|
| `welcome` | `type, player_id` |
| `reconnect_token` | `type, token` |
| `ping` | `type, t` |
| `state` | `type, code, target, round_num, started, paused, host, players` |
| `round_won` | `state` keys **+** `winner_name` |
| paused `state` (host) | `state` keys **+** `pause_remaining_ms` |
| `error` (terminal) | `type, fatal:true, msg` |

`players` is `{ pid: { name, dice, wins, has_rolled, roll_count, disconnected } }`.
**`dice` is `list[int]` (1–6); a die is "locked/matched" when its value ===
`target`** (no separate locked flag in the frame). `target` cycles 1→2→3→4→5→6.

## Selector cheat-sheet

| need | selector |
|------|----------|
| screen is active | `#<id>.active` (`landing`, `join`, `lobby`, `game`, `loading`) |
| create submit | `#landing-form button[type="submit"]` |
| show join screen | `#show-join-btn` → `#join.active` |
| join fields / submit | `#join-name-input`, `#code-input`, `#join-form button[type="submit"]` |
| join error text | `#join-error` (bad code → "Game not found") |
| landing error text | `#landing-error` |
| lobby code / start | `#lobby-code`, `#start-btn` |
| in-game hamburger / panel | `#game-menu-btn` → `#game-menu.open` |
| pause toggle / status | `#menu-pause-btn`, `#menu-pause-status` (hidden until `isHost && paused`) |
| nav menu (landing/join/lobby) | `#<screen>-menu-btn` → `#nav-menu.open` |
| changelog panel | `.menu-whats-new-btn` → `#nav-menu.show-changelog` (back: `.menu-changelog-back-btn`) |
| pause overlay (guest) | `#pause-overlay[open]` |
| winner overlay | `#winner-overlay[open]` |
| loading message | `#loading-msg` |

## Gotchas that cost us time

- **Pause status lives inside the menu panel.** `#menu-pause-status` only becomes
  *visible* when `#game-menu` is open. Open the menu explicitly before waiting on
  it (don't rely on the host auto-open, which only fires when arriving from
  loading).
- **`showScreen()` early-returns if the target is already active.** This causes a
  real View-Transition race: when a frame triggers a screen change immediately
  after another (e.g. a fatal `error` right after `create`→loading), the first
  transition may not have applied yet, so `showScreen('landing')` no-ops and you
  get stranded on **loading** with the error text set but invisible. Fix in the
  harness by **delaying** the second frame until the first transition settles
  (the fatal-error spec delays the error ~900ms), and **wait for the resting
  state** — `landing active AND loading NOT active AND error text present` — not
  just the synchronously-set text. (This is also a genuine latent app bug; see
  below.)
- **Fresh load needs no backend for static views.** With empty `localStorage` and
  no `?join=`, `main.js` transitions `#loading → #landing` client-side. So
  landing / join / nav-menu / changelog capture against the served files alone.
- **`pkill -f uvicorn` kills your own shell** (its command line contains
  "uvicorn"). Launch with `setsid … &` and kill by port, not by an `-f` pattern
  that matches the launcher.

## The state catalog we built (17 states)

Use as the reference inventory. Approach: **static** = served files only;
**synth** = `pinWebSocket` frame rewrite; **real** = real interaction outcome.

| state | approach | notes |
|-------|----------|-------|
| landing | static | |
| join-empty | static | |
| join-error | real | bad code → "Game not found" |
| nav-menu-open | static | landing hamburger |
| nav-menu-changelog | static | → "See What's New" panel |
| lobby-solo | synth | 1 player, "Invite friends — or start solo!" |
| lobby-3p | synth | host view, Start button, HOST badge |
| lobby-guest | synth | `host` = other pid → you-badge, "waiting for host" |
| lobby-5p | synth | scrolling player list, Start pinned |
| game-board | synth | started, `has_rolled:true`, mixed locked dice |
| game-menu-open | synth | board + in-game menu (Pause toggle) |
| paused-host | synth | `paused:true`, `host`=me, `pause_remaining_ms`; open menu |
| paused-guest | synth | `paused:true`, `host`=other → pause overlay |
| winner-win | synth | `round_won`, my dice all == target (iWon) |
| winner-lose | synth | `round_won`, my dice NOT all == target |
| disconnect-waiting | synth | a peer `disconnected:true` → loading "waiting to reconnect" |
| fatal-error | synth | delayed terminal `error` → landing + reason |

**Deliberately not captured** (transient / external, no stable frame): the
initial `#loading` flash, the mid-roll shake animation (frozen by
`animations:disabled` anyway), the "Reconnecting…" text variant (same `#loading`
screen as disconnect), the 2-second "link copied!" toast, and the external
SMS / Beer links.

## Observing a real game (discovery)

To discover states and confirm synthesized frames match reality, drive a real
multi-player game with **separate browser contexts** (each gets isolated
`localStorage` — required, or players clobber each other's `tensies_pid`). Log
frames non-invasively with `page.on('websocket', ws => ws.on('framereceived'))`.
This is how the frame table above was verified. (`/tmp/play.js` during the build
was a throwaway driver of this shape.)

## Known latent app bug (preserve-or-fix in the rewrite)

The `showScreen()` early-return race above means a fatal `error` arriving within
~`MIN_LOADING_MS` (600 ms) of `create` strands the user on the loading screen
(error set but hidden). It can't trigger in production today — the only fatal
producer is the pause cap, which fires an hour in — but any faster fatal path
would surface it. The rewrite's fatal handler should force the landing swap (or
clear the loading state) rather than trust `showScreen` to win the race.
