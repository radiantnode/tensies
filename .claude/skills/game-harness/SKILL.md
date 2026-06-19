---
name: game-harness
description: "Lightweight harness for quick, interactive checks of Tensies and the home for the reusable testing primitives. Spin up the dev stack and drive one or two real browser clients at mobile viewport to confirm the app loads, play a round, or check multiplayer sync. Owns the shared primitives every test reuses: window._state access, the rollUntil state-synced roll-driver, and the two-isolated-Playwright-instances topology. Use for one-off spot-checks and 'does this still work after my change' requests (e.g. \"test the app loads and play a round\"). For the full pre-merge/release regression matrix — prod-bundle rebuild, every bug class, a written run log — use /test-game instead; it builds on these same primitives."
user_invocable: true
---

# Tensies game harness — quick interactive checks

The shared foundation for *driving* the running Tensies app: the prerequisites,
the two-client topology, and the reusable primitives (`window._state`,
`rollUntil`) that both ad-hoc checks and the full `test-game` / `test-telemetry`
suites rely on. Reach for this when you want to actually exercise the app — load
it, play a round, confirm two clients stay in sync — without the ceremony of the
full regression suite.

**This is the lightweight path.** No prod-bundle rebuild, no run-log writing, no
self-update preflight, no 28-step matrix. Just bring up the dev stack and drive
it. If the task is a deliberate pre-merge / release confidence pass — exercising
reconnect, pause, rate limits, the prod bundle, and every known bug class — stop
and use **`/test-game`** instead (it reuses everything below). For confirming a
specific code change behaves, the built-in **`verify`** skill paired with these
primitives is the right altitude.

---

## Prerequisites

- **Dev stack up.** `docker compose up -d` (start the daemon first with
  `setsid dockerd >/tmp/dockerd.log 2>&1 &` if it isn't running). Confirm before
  touching a browser: `curl -sf http://localhost:8888/ | grep -q TENSIES && echo OK`.
  Use the **dev** stack, not prod — prod's `.env.prod` sets `ALLOWED_ORIGINS` to
  the deploy domain, which blocks localhost WebSocket connections.
- **Mobile viewport.** Tensies is **mobile-only**. Resize every browser instance
  to **390×844** (the pixel-harness resolution) *before* navigating — never
  validate at desktop width.

---

## Topology — two isolated Playwright instances

Two players MUST run in **separate** Playwright MCP instances, each with its own
browser profile, so their `localStorage` (`tensies_pid` / `tensies_code` /
`tensies_token`) don't clobber each other. Two tabs in *one* profile share
storage and silently corrupt per-player identity — a frequent source of false
"reconnect is broken" reports.

| Role | MCP tool prefix | Profile |
|------|-----------------|---------|
| Host (Player 1) | `mcp__playwright__*` | `/tmp/pw-mcp-host` |
| Guest (Player 2) | `mcp__playwright-guest__*` | `/tmp/pw-mcp-guest` |

(`.mcp.json` also defines `-g2-` / `-g3-` host/guest pairs for concurrent-game
checks; a single round only needs the first pair. The servers are pinned to
Playwright's bundled Chromium via `--browser chromium`.) If an instance's first
`browser_navigate` errors with "Target page … has been closed", that's a normal
cold relaunch — re-issue the same call once; only a failing *retry* is real.

---

## Accessing module state from `evaluate`

The app keeps its shared state in an ES module (`static/js/state.js`), not on a
global. For tests it exposes that bag as **`window._state`** whenever served from
`localhost`/`127.0.0.1` — local dev **and** the local prod smoketest, but never a
public deploy. So every `evaluate` / `run_code_unsafe` snippet can read
`_state.currentState`, `_state.myId`, `_state.rolling`, etc. **directly**:

```js
() => _state.currentState?.players[_state.myId]?.roll_count ?? -1
```

Because the hook lives in `state.js` itself, it works against both stacks: the
dev server (unbundled modules) and the local prod build (bundled `app.js`). Point
the app at a non-localhost host and `_state` is unset — fall back to DOM-based
checks.

---

## Driving rolls — the canonical `rollUntil` helper

To roll the local player some number of times — usually "roll until I win this
round" — **do not hand-roll a `click(); sleep(900)` loop.** A fixed sleep is a
guess at the gather+shake+reveal+ack window; it's flaky (passes nine times, hangs
the tenth) and never confirms the roll *landed*. Synchronize on **state** instead:
a roll is complete only when `roll_count` has advanced **and** both
`_state.rolling` and `_state.awaitingAck` have cleared. Pass this once via
`evaluate` / `run_code_unsafe` and reuse it:

```js
// rollUntil(opts) → Promise<{ rolls, matched, won, reason }>
// Drives the local player's roll button, waiting on state between rolls (never a
// fixed sleep). Stops when all 10 dice match the target (default), or when `stop()`
// returns true, or on round_over / maxRolls / a per-roll settle timeout.
(opts = {}) => new Promise(resolve => {
  const { maxRolls = 60, perRollTimeoutMs = 3000, stop } = opts;
  const me      = () => _state.currentState?.players[_state.myId];
  const matched = () => (me()?.dice || []).filter(v => v === _state.currentState?.target).length;
  const done    = () => (stop ? stop() : matched() >= 10);
  let rolls = 0;

  // The roll button is clickable only when nothing is in flight: not mid-animation,
  // not awaiting the server ack, game screen active, not paused, no winner overlay.
  const clickable = () => {
    const btn = document.getElementById('roll-btn');
    return btn && !btn.disabled &&
           !document.getElementById('winner-overlay')?.open &&
           document.getElementById('game').classList.contains('active') &&
           !_state.rolling && !_state.awaitingAck && !_state.currentState?.paused;
  };

  const step = () => {
    if (done())                            return resolve({ rolls, matched: matched(), won: true,  reason: 'target-met' });
    if (rolls >= maxRolls)                 return resolve({ rolls, matched: matched(), won: false, reason: 'max-rolls' });
    if (_state.currentState?.round_over)   return resolve({ rolls, matched: matched(), won: false, reason: 'round-over' });
    if (!clickable()) { setTimeout(step, 80); return; }

    const before = me()?.roll_count ?? -1;
    document.getElementById('roll-btn').click();
    rolls++;

    // Wait for THIS roll to fully settle before the next one: count advanced AND
    // the animation + ack have cleared. This is the synchronization a sleep fakes.
    const t0 = Date.now();
    const settle = () => {
      if ((me()?.roll_count ?? -1) > before && !_state.rolling && !_state.awaitingAck) { step(); return; }
      if (Date.now() - t0 > perRollTimeoutMs)
        return resolve({ rolls, matched: matched(), won: false, reason: 'roll-timeout' });
      setTimeout(settle, 50);
    };
    settle();
  };
  step();
})
```

A `reason` other than `target-met` is a red flag worth reporting: `roll-timeout`
means a roll never settled (the roll-ack hang), `max-rolls` means 60 rolls didn't
complete the round (suspicious unless the RNG was cruel).

**Scope caveat — this exercises game logic, not the touch path.** `rollUntil`
calls the button's `.click()` from inside the page, a synthetic DOM click. It
validates the roll → reveal → ack → broadcast flow and round progression, but it
does **not** go through a real pointer/touch event, so it does *not* exercise the
capture-phase `touchstart` guard in `static/js/touch.js` (the iOS double-tap-zoom
blocker). To validate that a genuine tap registers, drive a few rolls with the MCP
`browser_click` tool (real input events) under touch emulation instead.

---

## Recipe — load the app and play a round (two clients)

1. **Both instances:** resize to 390×844, then navigate to
   `http://localhost:8888/`. Clear stale sessions on both —
   `() => { localStorage.clear(); return true; }` — and re-navigate, so a dead
   saved game doesn't flash "Connection failed" on the landing.
2. **Host (instance #1):** type a name into `#name-input`, submit the landing
   form (`() => document.getElementById('landing-form').requestSubmit()`). Wait
   for `#lobby` to become active; read the code from `#lobby-code`.
3. **Guest (instance #2):** navigate to `http://localhost:8888/<CODE>` (the
   deep-link pre-fills `#code-input`), type a name into `#join-name-input`, submit
   `#join-form`. Confirm both names appear in `#lobby-players` on **both**
   instances — that's the Redis cross-client fan-out working.
4. **Host:** click `#start-btn`; both instances land on `#game`. Read the target:
   `() => _state.currentState?.target`.
5. **Play the round:** if you care about the overlay, install a `MutationObserver`
   on `#winner-overlay`'s `open` attribute first, then `() => rollUntil()` on the
   host — expect `{ won: true, reason: 'target-met' }`.
6. **Verify the result on both instances:** the win shows, `round_num`
   incremented, `target` advanced one step in the **1→2→3→4→5→6→1** cycle, and the
   per-player win counts match across clients. Screenshot to `.playwright-mcp/` if
   a visual record helps.

That's a full round, end to end. For anything deeper — reconnect, pause, rate
limits, host transfer, the prod bundle, or the catalogue of fixed regressions —
that's `/test-game`'s job.
