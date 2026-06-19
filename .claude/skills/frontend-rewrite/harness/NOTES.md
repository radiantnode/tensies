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
  (`game-render.js::renderMenu`, re-anchored to `Date.now()` each tick) both
  render a fixed value. The winner overlay reads `Next round starts in: NNs`;
  paused-host reads `60:00`.
- **`settle()`** waits `document.fonts.ready`, then pauses infinite animations
  and hides carets. `toHaveScreenshot({animations:'disabled'})` additionally
  fast-forwards finite CSS animations to their end state.

The proof that determinism held is the **second** verify run going zero-diff. If
anything leaked, run #2 goes red. Always re-run verify after capturing.

## `has_rolled` — the non-obvious one

For any **started** game, set `has_rolled: true` on players (and a non-zero
`roll_count`). It controls two things:

- **Players-bar progress** (`game-render.js::renderPlayersBar`): `matched =
  p.has_rolled ? count(dice==target) : 0`. Without it every bar reads 0/10.
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
| `game_ended` | `type, ended_by, round_num, players` |

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
  just the synchronously-set text. (The app-side half of this race was fixed in
  rewrite-v2; see the last section.)
- **Fresh load needs no backend for static views.** With empty `localStorage` and
  no `?join=`, `router.js::bootstrap` transitions `#loading → #landing`
  client-side. So landing / join / nav-menu / changelog capture against the
  served files alone.
- **A disconnected peer routes a non-paused board to loading.** `showFor` sends
  the viewer to the "waiting to reconnect" loading screen when any player is
  `disconnected:true` — *unless* the game is paused (the paused branch runs
  first). So to show a disconnected player-*card* in the bar, the frame must be
  `paused:true` (that's why `players-bar-variants` is a paused board).
- **`waitForSelector` on a closed/hidden element hangs.** A closed menu
  (`#game-menu:not(.open)`) is `display:none`; `waitForSelector` waits for
  *visible* by default and times out. Wait on the class with `waitForFunction`,
  or pass `{ state: 'hidden' }`.
- **`pkill -f uvicorn` kills your own shell** (its command line contains
  "uvicorn"). Launch with `setsid … &` and kill by port, not by an `-f` pattern
  that matches the launcher.

## The state catalog we built (28 states)

Use as the reference inventory. Approach: **static** = served files only;
**synth** = `pinWebSocket` frame rewrite; **auth** = fake JWT in localStorage
(+ WS auth intercept for server-driven views); **real** = real interaction outcome.

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
| game-ended | synth | `game_ended` frame after a started board → redirect to `/games/<code>` game-detail screen with one-shot "Game ended" label |
| fatal-error | synth | delayed terminal `error` → landing + reason |
| players-bar-variants | synth | clipped to `#players-bar`; one **paused** board showing leading + hot + disconnected + is-me cards |
| paused-board | synth | host paused, menu closed → board with the "Paused" roll button |
| target-die-1..6 | synth | element-clipped `round-target` die for each target value |
| play-die-1..6 | synth | element-clipped regular ivory die for each face: first unmatched `.die-scene`, all my dice = value, target ≠ value |
| rotate-overlay | real | the one landscape capture (`setViewportSize` 844×390): the CSS orientation guard revealed by the landscape + max-height media query |
| signin | auth | sign-in/sign-up screen, reached via nav menu `.menu-auth-btn`; no JWT needed |
| landing-signed-in | auth | JWT injected → name input hidden, `@username` pill in header |
| onboarding | auth | JWT + `sessionStorage('tensies_onboarding')` → `/welcome` with `@username` and vanity URL |
| nav-menu-signed-in | auth | JWT injected → menu shows "Sign out" instead of "Sign in or Sign up" |
| game-board-signed-in | auth | JWT + WS auth intercept (fake `auth_ok`) → board with `@username` pill next to hamburger |
| game-board-signed-out | auth | same dice layout as signed-in, no JWT → no pill; companion for auth-aware diffing |
| profile-with-stats | auth | `page.route` intercepts `/api/profile/*` with deterministic stats JSON; avatar ring + gold username + 6 stat cards |
| profile-with-photo | auth | same as above but with `profile_photo_url` set (uses default SVG as stand-in for deterministic capture) |
| profile-empty | auth | profile with `stats: null` → "No games played yet" empty state |
| game-detail-verified | auth | `page.route` intercepts `/api/game/*` + `/api/game/*/verify`; all 95 rolls pass drand verification |
| game-detail-no-data | auth | same stub pattern; verify returns `total: 0` → "No beacon data for this game" |

**Deliberately not captured** (transient / external, no stable frame): the
initial `#loading` flash, the mid-roll shake animation (frozen by
`animations:disabled` anyway), the "Reconnecting…" text variant (same `#loading`
screen as disconnect), the 2-second "link copied!" toast, and the external
SMS / Beer links.

## Capture integrity (don't trust a baseline you didn't earn)

- **Browser is pinned.** `browser-guard.js` (a `globalSetup`) refuses to run on
  any Chromium build other than the one in `baselines/CAPTURE-ENV.txt`
  (currently 140.0.7339.16). At `maxDiffPixels:0`, sub-pixel font hinting differs
  between builds, so an accidental upgrade would read as a rewrite regression.
  Re-baselining on a new build is a deliberate act: bump `EXPECTED` in
  `browser-guard.js` **and** `CAPTURE-ENV.txt` together. `@playwright/test` is
  pinned exact (not `^`) for the same reason.
- **JS errors fail the capture.** Every spec imports `test` from `fixtures.js`,
  which fails any test whose page logged a `console.error` or threw — the guard
  against baking a *wrong* baseline (a mis-rendered state often still screenshots
  something; see the fatal-error trap). Extend the `IGNORE` list in `fixtures.js`
  only for genuinely benign noise.
- **Gate the screenshot on a state-unique selector**, never just `#screen.active`
  — assert on something only the intended state shows (`#winner-overlay[open]`,
  the pause status text, the error text). This is what catches a state that
  silently fell back to loading or landing.
- **Volatile content gets masked.** `nav-menu-changelog` masks
  `.menu-changelog-body` (regenerated prose) via `toHaveScreenshot({mask:[…]})`,
  so it verifies the panel chrome without false-diffing every changelog update.
- **Never judge 3-D content from Playwright-WebKit screenshots.** WebKit's
  screenshot path flattens `transform-style: preserve-3d` *unconditionally*: a
  settled, perfectly-rendered board screenshots as all-6s with the 90°-rotated
  dice missing, while the live page is fine. (The same flattening in WebKit's
  view-transition rasterizer was the real Safari dice bug.) For cross-engine
  checks, verify WebKit with DOM counts + `getComputedStyle` sampling and use
  Chromium screenshots for visual evidence. This trap doesn't affect the pixel
  suite — it's Chromium-pinned.
- **Courtesy screenshots must wait for animations; verification already does.**
  `toHaveScreenshot` (verify/baseline) auto-retries until two consecutive frames
  match, so it waits out the loading↔landing/screen view-transition morph and
  captures the settled state. A raw `page.screenshot()` — what you'd use to *show
  the user* a view — has NO such wait and will fire mid-morph (e.g. the loading
  screen cross-fading into join). A **single** `document.getAnimations()` read is
  NOT enough: if the capture trigger fires at the *start* of a transition (e.g.
  the join-error text is set synchronously as `showScreen('join')` begins), the
  view-transition pseudo animations haven't registered yet, so `getAnimations()`
  returns nothing and you still shoot mid-cross-fade. Let the transition
  **register** (a couple of rAFs) before awaiting, and loop for chained ones:
  ```js
  async function transitionDone(page) {
    await page.evaluate(async () => {
      const twoFrames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (let i = 0; i < 3; i++) {                       // register → await → repeat
        await twoFrames();
        await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
      }
    });
  }
  // ... reach the state, then:
  await transitionDone(page);
  await settle(page);
  // sanity: document.getAnimations().filter(a => a.playState==='running').length === 0
  await page.screenshot({ path: out });
  ```
  The verified baseline is unaffected by this — only the image you hand the user
  is, and a mid-transition image makes a correct rewrite look wrong.

## Observing a real game (discovery)

To discover states and confirm synthesized frames match reality, drive a real
multi-player game with **separate browser contexts** (each gets isolated
`localStorage` — required, or players clobber each other's `tensies_pid`). Log
frames non-invasively with `page.on('websocket', ws => ws.on('framereceived'))`.
This is how the frame table above was verified. (`/tmp/play.js` during the build
was a throwaway driver of this shape.)

## Latent app bug — FIXED in rewrite-v2

The `showScreen()` early-return race above could strand a fast fatal `error` on
the loading screen (error set but hidden). **Fixed** as the rewrite's one
sanctioned behavior change: `showScreen(id, { force: true })` skips the
early-return, and the fatal handler in `net.js` uses it, so the landing swap
always wins. The harness's fatal-error spec still delays the error ~900ms — a
deliberate match for production timing, not a workaround anymore.

Two more rendering behaviors layered on since (both relevant when adding
captures):

- **Swaps INTO `#game` don't use the View Transitions API.** They're *staged*
  (`showScreen({ staged: true })`): the board builds invisibly (`.staging`),
  then the outgoing screen `.dissolving`-fades over the live result. This is
  load-bearing — a VT raster flattens `preserve-3d` on WebKit and the dice
  mis-render as 6s. Captures gating on `#game.active` then `settle()` are
  unaffected (the dissolve is an ordinary transition the stability-wait
  outlasts).
- **`vt-settling`** hides `.die-scene` during any VT that does target the game
  screen — dormant insurance now that those swaps are staged.
