---
name: test-game
description: "Comprehensive end-to-end regression suite for Tensies — the deliberate full pass, not a quick check. Runs all 28 steps across two Playwright clients (gameplay, multiplayer sync, reconnect, host transfer, pause, every known bug class), then tears down the dev stack to rebuild and smoketest the prod bundle, and writes a dated run log. Long-running (10-15+ min) and has side effects: rebuilds the Docker stack and commits a log file. Use for a pre-merge or pre-release confidence pass, or when the user explicitly asks for the full game test suite or invokes /test-game. For a quick one-off spot-check of a single change, do NOT use this — use the verify skill instead."
user_invocable: true
---

# Tensies Game Tester

You are about to run a full integration test of the Tensies multiplayer dice game. This covers:
- Server health
- Full gameplay loop (create → lobby → start → roll → win → next round)
- Multiplayer synchronisation (two **separate** browser instances)
- Winner/loser overlay consistency across multiple rounds (round-end flash regression)
- Every specific bug that was previously fixed
- Animation-integrity spot checks via screenshots and console errors

**Do not ask for confirmation. Run everything and report results.**

**All screenshots must be saved into the `.playwright-mcp/` directory** — pass the full relative path as the `filename` (e.g. `filename: ".playwright-mcp/02-landing.png"`). A bare filename lands in the project root; always include the `.playwright-mcp/` prefix. Screenshot labels match their step number.

## Test topology — two isolated Playwright instances

The two players MUST run in **separate Playwright MCP instances**, each with its own browser profile. The project `.mcp.json` defines **six** instances — three host/guest pairs, enough to drive three concurrent 2-player games:

| Role | Player | MCP tool prefix | Profile |
|------|--------|-----------------|---------|
| Game 1 host (Player 1) | Alpha | `mcp__playwright__*` | `/tmp/pw-mcp-host` |
| Game 1 guest (Player 2) | Beta | `mcp__playwright-guest__*` | `/tmp/pw-mcp-guest` |
| Game 2 host | Alpha2 | `mcp__playwright-g2-host__*` | `/tmp/pw-mcp-g2-host` |
| Game 2 guest | Beta2 | `mcp__playwright-g2-guest__*` | `/tmp/pw-mcp-g2-guest` |
| Game 3 host | Alpha3 | `mcp__playwright-g3-host__*` | `/tmp/pw-mcp-g3-host` |
| Game 3 guest | Beta3 | `mcp__playwright-g3-guest__*` | `/tmp/pw-mcp-g3-guest` |

The core suite below uses only the first pair: **"Tab 1" = instance #1 (`mcp__playwright`)** and **"Tab 2" = instance #2 (`mcp__playwright-guest`)**. These are independent processes — acting on one never disturbs the other, and you may issue calls to different instances in parallel. The g2/g3 instances are available for optional concurrent-games / cross-game-isolation checks (run three games at once and confirm distinct game codes, correct per-game rosters, and `tensies_games_active == 3`). For very high scale (hundreds of games), don't fan out browsers — use the headless WebSocket driver `loadtest.py` in the repo root: `docker compose cp loadtest.py web:/app/loadtest.py && docker compose exec -T -w /app web python loadtest.py 250 1000`. It runs the real create/join/start/roll protocol per client and reports throughput, errors, and whether `games_active` drains back to 0 after the disconnect grace (a leak check — it caught a real game-leak regression at 250+ games).

**Why this matters (do not regress to two tabs in one browser):** two tabs/windows in a *single* profile share `localStorage`, so the second player's `tensies_pid`/`tensies_code` overwrites the first's. That silently corrupts per-player identity and produces *false* reconnect failures (a "host reconnect fails" report on 2026-05-29 was exactly this artifact, not a real bug). Separate instances give each player its own isolated `localStorage`.

Because each instance uses a **persistent** profile, `localStorage` survives reloads — so reconnect can be exercised with a real page reload (no dynamic-import seeding hack required).

If either instance's tools are unavailable (e.g. `mcp__playwright-guest__browser_navigate` doesn't resolve), the MCP config hasn't been picked up — reconnect to MCP / restart the session before proceeding.

For throwaway single-client edge-case checks (invalid-code / join-after-start), open a **separate tab inside instance #2** and close it afterward; never run them in instance #1, and don't rely on instance #2's `localStorage` surviving them (the reconnect step re-seeds explicitly).

---

## Preflight A — Self-update

Before running any tests, check whether the skill is stale relative to the game code. This keeps the test suite accurate as the game evolves. (Preflight is not a scored test row.)

```bash
# Get the skill file's last-modified timestamp (seconds since epoch)
SKILL_MTIME=$(stat -f %m .claude/skills/test-game/SKILL.md 2>/dev/null || stat -c %Y .claude/skills/test-game/SKILL.md)

# Find commits to game-relevant files that are newer than the skill
git log --since="@${SKILL_MTIME}" --oneline -- main.py server/ static/

# Also check for unstaged / staged changes — uncommitted work is worth testing too
git diff --name-only -- main.py server/ static/
git diff --cached --name-only -- main.py server/ static/
```

If any commits appear **or** any files are listed in the `git diff` output (staged or unstaged changes):

1. Read the relevant refactored modules: `main.py`, `server/ws.py`, `server/game.py`, `server/broadcast.py`, `static/index.html`, and any `static/js/*.js` module touched by the diff.
2. Compare what changed against what this skill currently tests. Look for:
   - **New server actions or messages** (new entries in `ACTIONS` in `server/ws.py`, new `msg.type` values in `handleMessage` in `static/js/net.js`)
   - **New game state fields** (new keys in `fresh_player`, `state_msg`, or `game` dict in `server/game.py`)
   - **New client state fields** (new keys on the `state` object in `static/js/state.js`)
   - **New UI elements** (new IDs or screens in `index.html`)
   - **Bug fixes** — commit messages that say "Fix …" describe a regression worth testing
   - **Removed or renamed things** — tests referencing them need updating
3. Edit this skill file (`Edit` tool) to:
   - Add new test steps for new behaviour
   - Update selectors, variable names, or assertions that have changed
   - Remove tests for things that no longer exist
   - **Renumber consistently** — steps, their screenshot labels, and the report rows are all 1:1; if you add/remove a step, renumber the rest and update the count in the summary table and the Log-writing section.
4. After saving the updated skill, **continue running the tests** with the new version — do not stop.

If there are no new commits **and** no unstaged/staged changes, skip straight to Preflight B.

---

## Preflight B — Prior run review

Read the most recent test log(s) from `docs/test-runs/game/` before starting:

```bash
ls -t docs/test-runs/game/*.md 2>/dev/null | grep -v README | head -3
```

Read each file returned (up to the 3 most recent). Extract:
- Any **FAILs** from prior runs — these are the first things to watch during this run
- Any **notes or observations** flagged as worth watching
- Any **known flaky** steps or timing-sensitive checks that failed spuriously before

Keep these in mind as you run the suite. If a prior-run FAIL now passes, note it as **fixed/regression-cleared**. If a new FAIL appears that wasn't in prior logs, note it as **newly introduced**.

If no logs exist yet, skip this step.

---

## Accessing module state from `evaluate`

The JS app keeps its shared state in an ES module (`static/js/state.js`), not on a global. For tests, `state.js` exposes that bag as **`window._state`** whenever the app is served from `localhost`/`127.0.0.1` — i.e. local dev **and** the local prod smoketest, but never a public deploy. So every `evaluate` / `run_code_unsafe` snippet below can read `_state.currentState`, `_state.myId`, `_state.rolling`, etc. **directly**.

```js
() => _state.currentState?.players[_state.myId]?.roll_count ?? -1
```

Because the hook lives in `state.js` itself, it works against both stacks: the dev server (unbundled modules) and the prod build (bundled `app.js`) — both run on `localhost` during this suite. If you ever point the suite at a non-localhost host, `_state` won't be set; fall back to DOM-based checks.

**Dev stack required for WebSocket testing.** Prod `.env.prod` has `ALLOWED_ORIGINS` set to the deploy domain, which blocks WS connections from localhost. Always use `docker compose up -d` (dev) for local Playwright tests.

---

## Driving rolls — the canonical `rollUntil` helper

Most steps need to roll the local player some number of times — usually "roll until I win this round." **Do not hand-roll a `click(); sleep(900)` loop for this.** A fixed sleep is a guess at the gather+shake+reveal+ack window; it's flaky (passes nine times, hangs the tenth) and it doesn't actually confirm the roll *landed*. Synchronize on **state** instead: a roll is complete only when `roll_count` has advanced **and** both `_state.rolling` and `_state.awaitingAck` have cleared. Pass this once via `evaluate` / `run_code_unsafe` and reuse it:

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

A `reason` other than `target-met` is a red flag worth reporting: `roll-timeout` means a roll never settled (the roll-ack hang — see Steps 8–9), `max-rolls` means 60 rolls didn't complete the round (suspicious unless the RNG was cruel).

**Scope caveat — this exercises game logic, not the touch path.** `rollUntil` calls the button's `.click()` from inside the page, which is a synthetic DOM click. It validates the roll → reveal → ack → broadcast flow and round progression, but it does **not** go through a real pointer/touch event, so it does *not* exercise the capture-phase `touchstart` guard in `static/js/touch.js` (the iOS double-tap-zoom blocker). To validate that a genuine tap registers, drive a small number of rolls with the MCP `browser_click` tool (real input events) under touch emulation instead.

The bespoke roll loops in Steps 13 and 22 are intentionally **not** this helper — they carry their own instrumentation (spacebar-hammering during the overlay window; staggered dual-client cadences with overlay-duration recording) that `rollUntil` deliberately doesn't.

---

## Step 1 — Server health

Bring the server up. **Do not `pkill` browser/playwright processes** — that would kill the MCP-managed browser instances this skill drives. Each Playwright MCP instance manages its own browser lifecycle; just navigate them.

```bash
docker compose up -d
sleep 2
```

Confirm the server is responding before touching the browser:

```bash
curl -sf http://localhost:8888/ | grep -q "TENSIES" && echo "OK" || echo "FAIL: server not up"
```

If the check fails, stop and report — no point running the browser suite against a dead server. (Name generation is client-side; there is no `/random-name` endpoint.)

---

## Step 2 — Landing screen (open both instances)

Navigate **instance #1** (`mcp__playwright__browser_navigate → http://localhost:8888/`) — Player 1 / host (Alpha). Also navigate **instance #2** (`mcp__playwright-guest__browser_navigate → http://localhost:8888/`) now so both browsers are warm; Player 2 / guest (Beta) lives there for the rest of the suite. The two navigations are independent — issue them in parallel.

**Expect a one-retry relaunch.** If an instance's browser was closed since a prior session, the first `browser_navigate` errors with "Target page, context or browser has been closed". This is normal — the MCP relaunches the browser on the call; simply re-issue the same `browser_navigate` once and it succeeds. Only treat it as a failure if the *retry* also errors.

**Clear stale sessions first.** These are persistent profiles, so `tensies_pid`/`tensies_code` survive from prior runs — the bootstrap then attempts a doomed auto-reconnect to a dead game and flashes "Connection failed" on the landing. On **both** instances run `() => { localStorage.clear(); return true; }`, then **re-navigate both** to `http://localhost:8888/`. The landing is now clean.

Take a screenshot **`.playwright-mcp/02-landing.png`** (instance #1). Verify:
- `#name-input` is visible
- `#landing-error` is empty
- The placeholder text on `#name-input` contains a random name (not blank and not the literal "Player")

Check console messages — flag any JS errors.

---

## Step 3 — Create a game (Player 1)

In Tab 1:
1. Type `Alpha` into `#name-input`
2. Submit the landing form: click `#landing-form button[type="submit"]` (or call `document.getElementById('landing-form').requestSubmit()` via `evaluate`). The "Create Game" button itself has no `id`; it's identified by being the form's submit button.

Wait for `#lobby` screen to become `.active`. Then:
- Read the game code from `#lobby-code` — store it as `GAME_CODE`
- Verify `#lobby-players` contains "Alpha" and a HOST badge
- Verify `#start-btn` is visible (you are the host)
- Verify `#waiting-msg` says something about "solo" or "Invite" (only 1 player)

Take screenshot **`.playwright-mcp/03-lobby-host.png`**.

---

## Step 4 — Deep-link join + lobby sync (Player 2)

In **instance #2** (`mcp__playwright-guest__*`), navigate to:

```
http://localhost:8888/<GAME_CODE>
```

Verify:
- The join screen (`#join`) is active
- `#code-input` is pre-filled with `GAME_CODE` (deep-link works — `/<CODE>` is the primary format; the legacy `?join=<CODE>` still works as a fallback)
- The URL has been cleaned to `/` (no code remains in the address bar)

Type `Beta` into `#join-name-input`, then submit the join form (`#join-form button[type="submit"]`).

Wait for `#lobby` to become active. Verify:
- Both "Alpha" and "Beta" appear in `#lobby-players`
- Beta sees `#waiting-msg` = "Waiting for the host to start…"
- Start button is hidden for Beta

On Tab 1, verify the lobby synced:
- Beta now appears in the lobby player list
- `#waiting-msg` is now empty (2 players — no longer "invite friends")

Take screenshot **`.playwright-mcp/04-lobby-both.png`**.

After the screenshot, capture Beta's identity from instance #2's localStorage — you'll need these for the reconnect re-seed in Step 19:
```js
() => ({ pid: localStorage.getItem('tensies_pid'), token: localStorage.getItem('tensies_token') })
```
Store the results as `BETA_PID` and `BETA_TOKEN`. The `tensies_token` is set by the `reconnect_token` message the server sends immediately after a successful join.

---

## Step 5 — Invalid game code rejection (edge case)

Open a **throwaway tab in instance #2** (`mcp__playwright-guest__browser_tabs` action `new`) and navigate it to the root — keep Beta's main tab untouched. The join flow is two steps:
1. Type `Gamma` into `#name-input` on the landing screen, then click `#show-join-btn` to reach the join screen.
2. On the join screen, fill `#code-input` with `ZZZZZ` (a code that doesn't exist), then submit the join form (`#join-form button[type="submit"]`).

Verify `#join-error` (not `#landing-error`) contains "Game not found". Close the throwaway tab (`mcp__playwright-guest__browser_tabs` action `close`) so Beta's main tab stays active.

---

## Step 6 — Start the game + initial render

In Tab 1, click `#start-btn`. Wait for `#game` screen to become active on Tab 1.

Verify:
- `#my-area` is rendered (dice are visible)
- `#players-bar` shows both Alpha and Beta cards
- The round header shows "Round 1"
- A target die is visible (`.round-target-die`)
- Roll button (`#roll-btn`) is present and **enabled**
- Players-bar text for Alpha contains `0/10` (no separate `#locked-count` element exists — it is embedded in the bar)

Take screenshot **`.playwright-mcp/06-game-start.png`**.

Also verify Tab 2 is now on `#game` as well. Check the players bar on Tab 2 mirrors Tab 1.

---

## Step 7 — Join-after-start rejection (edge case)

Open a **throwaway tab in instance #2** (`mcp__playwright-guest__browser_tabs` action `new`) to `http://localhost:8888/`. Use the two-step join flow:
1. Type `Latebird` into `#name-input`, then click `#show-join-btn`.
2. Fill `#code-input` with `GAME_CODE`, then submit the join form (`#join-form button[type="submit"]`).

Verify `#join-error` (not `#landing-error`) contains "Game already in progress". Close the throwaway tab (`mcp__playwright-guest__browser_tabs` action `close`).

---

## Step 8 — Roll and reveal correctness (single-player roll, Tab 1)

In Tab 1:
1. Read `roll_count` from the page state via `evaluate` (`_state` is the shared module-state bag, exposed on `window._state` by `static/js/state.js` on localhost — see the section above):
   ```js
   () => _state.currentState?.players[_state.myId]?.roll_count ?? -1
   ```
2. Click `#roll-btn`.
3. Verify the button becomes disabled immediately.
4. Wait up to 3 seconds for the button to re-enable.
5. Read `roll_count` again — it must be exactly 1 higher than before. **If it's not, this is a hang (the roll-ack bug).**

Check console for any errors during this sequence.

Take screenshot **`.playwright-mcp/08-after-roll.png`**. Visually verify:
- Dice faces are showing (not mid-tumble blur)
- No dice are visually overlapping in the unmatched zone
- The locked count in the header reflects matched dice
- The players bar for Alpha now shows a non-zero progress fill

---

## Step 9 — Same-value re-roll hang (regression check)

This is the bug where a re-roll that lands on the same dice values as before caused the client to poll forever (fixed by adding `roll_count` to `myDiceKey`).

Using Tab 1, roll the dice in a tight loop using `evaluate` to monitor:
```js
() => ({ rc: _state.currentState?.players[_state.myId]?.roll_count, rolling: _state.rolling, awaiting: _state.awaitingAck })
```

Roll 5 times in sequence, checking after each that `_state.rolling` returns to `false` within 3 seconds. If it is ever stuck `true` for more than 3 seconds without `_state.pendingRollState` being set, flag it as the **roll-ack hang** regression.

---

## Step 10 — Rate limit enforcement

Clicking `#roll-btn` twice does **not** trigger the rate limit — `roll()` has an `if (state.rolling) return` guard that drops the second click before any frame is sent, and after a roll completes (~1.4 s later) the next click is well past `MIN_ROLL_INTERVAL`. To actually exercise the server limit, send two raw `roll` frames straight down the socket (bypassing the client guard), < 250 ms apart:

```js
() => { _state.ws.send(JSON.stringify({ action: 'roll' })); _state.ws.send(JSON.stringify({ action: 'roll' })); return 'sent 2 raw rolls'; }
```

Then verify:
- The server logged the limit — `docker compose logs web --since 15s 2>&1 | grep "RATE LIMIT"` shows a `roll … RATE LIMIT` line (the second frame was rejected with a "Slow down" error).
- The roll button is **not stuck** — after ~1.5 s, `#roll-btn` is enabled and `_state.rolling` / `_state.awaitingAck` are both `false` (the in-game `error` handler clears the locked state).

**Don't run this at 9/10 matched:** the first raw roll could win, making the second hit `round_over` (silently dropped) instead of the rate limit. Run it when the roller is comfortably below 10 matched.

---

## Step 11 — Multiplayer broadcast timing (key regression)

This checks that other players don't see a roll before the roller's reveal animation completes (the delayed-broadcast fix).

**Do not use the naive tab-switch approach** — each Playwright tool call adds ~500ms overhead, making a "within 200ms" check impossible. Use a page-side timestamp watcher instead:

1. In Tab 2 (Beta), install a polling watcher **before** the roll happens:
   ```js
   () => {
     const alphaId = Object.keys(_state.currentState.players).find(id => _state.currentState.players[id].name === 'Alpha');
     const preRollCount = _state.currentState.players[alphaId].roll_count;
     window._broadcastWatch = { alphaId, preRollCount, detectedAt: null, startedAt: Date.now() };
     const iv = setInterval(() => {
       const rc = _state.currentState?.players[alphaId]?.roll_count ?? -1;
       if (rc > preRollCount && !window._broadcastWatch.detectedAt) {
         window._broadcastWatch.detectedAt = Date.now();
         clearInterval(iv);
       }
     }, 20);
     return { alphaId, preRollCount };
   }
   ```
2. On Tab 1, record the click timestamp and roll:
   ```js
   () => { window._rollClickedAt = Date.now(); document.getElementById('roll-btn').click(); return window._rollClickedAt; }
   ```
3. Wait 3 seconds (for animation to complete and broadcast to arrive).
4. On Tab 2, read results:
   ```js
   () => {
     const w = window._broadcastWatch;
     const rollClickedAt = /* absolute timestamp from step 2 */;
     return {
       detectedAt: w.detectedAt,
       msAfterRollClick: w.detectedAt ? w.detectedAt - rollClickedAt : null,
       stateAdvanced: (_state.currentState?.players[w.alphaId]?.roll_count ?? -1) > w.preRollCount
     };
   }
   ```

   Note: `rollClickedAt` was captured on Tab 1; `w.startedAt` is Tab 2's clock. Use absolute timestamps for the delta.

**Pass criteria:**
- `detectedAt` is set (broadcast arrived) — if null after 3s, the pipeline is broken
- `msAfterRollClick` is **between 800ms and 2000ms** — this is the expected animation window (gather + shake + reveal). The broadcast timing has measured 877ms, 934ms, 988ms, 1491ms, and 1589ms across runs; runs with many dice already locked produce shorter reveals.
- If `msAfterRollClick` < 200ms, the broadcast went out before the roller's animation finished — **regression**.

---

## Step 12 — Roll to win (winner overlay)

**Note:** Alpha will often have already won round 1 during the roll-heavy steps above (8–11). If so, this step runs in round 2 or later — that is expected and fine. Check `_state.currentState.round_num` to confirm which round you're in.

**Winner overlay capture:** The winner overlay is a `<dialog id="winner-overlay">` opened with `showModal()` — it has **no `visible` class**; its open state is the dialog's `open` property/attribute. It auto-dismisses after ~3s. A post-loop screenshot will always miss it, so install a `MutationObserver` on the `open` attribute and capture content the moment it opens:

```js
window._winnerCapture = null;
const overlay = document.getElementById('winner-overlay');
new MutationObserver(() => {
  if (overlay.open && !window._winnerCapture) {
    window._winnerCapture = {
      winnerName: document.getElementById('winner-name')?.textContent.trim(),
      bannerSuffix: document.getElementById('winner-banner-suffix')?.textContent.trim(), // "Winner" | "Loser"
      winnerRound: document.getElementById('winner-round')?.textContent.trim(),
      capturedAt: Date.now()
    };
  }
}).observe(overlay, { attributes: true, attributeFilter: ['open'] });
```

Then drive the round to a win with the **`rollUntil` helper** (see "Driving rolls — the canonical `rollUntil` helper" above) — it rolls, synchronizing on state between rolls, until all 10 dice match the target:

```js
// after installing the winner MutationObserver above:
() => rollUntil()   // resolves { rolls, matched, won, reason } — expect reason: 'target-met'
```

A `reason` of `roll-timeout` here is the roll-ack hang; `max-rolls` means 60 rolls didn't finish the round. Don't reintroduce a `click(); sleep(N)` loop.

When `rollUntil` resolves, read `window._winnerCapture`. Verify:
- `winnerName` contains "Alpha"
- `bannerSuffix` is `Winner` (the winner sees the Winner banner; losers see `Loser`)
- `winnerRound` matches the round that was just won

(The overlay markup is a banner — `Round <#winner-round> <#winner-banner-suffix>` — plus `#winner-name`. There is **no** `#winner-sub` next-target text in the current design; the next target shows in the round header after the auto-advance.)

Take screenshot **`.playwright-mcp/12-winner.png`** (will show post-advance state; the MutationObserver data is the authoritative overlay check).

Check Tab 2 also advanced to the next round with the same state (same `round_num`, same `target`, same `winnerName` in the overlay element).

---

## Step 13 — Sticky winner overlay regression

Simulate a player pressing spacebar (or clicking the still-keyboard-focusable roll button) during the winner overlay. The bug being guarded against:

> A spacebar during the overlay used to call `roll()`, which set
> `state.awaitingAck = true` and sent a roll the server silently
> dropped (`game.round_over=True`). When the new-round state arrived
> ~3s later, `awaitingAck` trapped it in `pendingRollState` instead of
> routing through `showFor() → hideWinner()`, and the dialog never
> closed.

**Do not run this as a separate evaluate after Step 12.** Step 12's roll-loop usually consumes most of the 3 s `ROUND_WIN_DELAY` window, so by the time a follow-up evaluate is dispatched the overlay has already auto-closed and there's nothing left to hammer.

Instead, run a single self-contained promise that rolls to win **and then immediately** hammers spacebar during the open window. Use a `phase` state-machine + `obs.disconnect()` so the `setTimeout` chain *cannot* keep firing after `resolve()` — orphan ticks were a source of round contamination that the round-transition step (Step 14) used to misread:

```js
() => new Promise(resolve => {
  const dlg = document.getElementById('winner-overlay');
  const TIMEOUT_MS = 90000;
  const start = Date.now();
  let phase = 'rolling';   // 'rolling' | 'spacebar' | 'done'
  let rolls = 0, fires = 0, openedAt = null;

  const finish = (result) => {
    if (phase === 'done') return;
    phase = 'done';                 // ← cancellation gate read by tick()
    obs.disconnect();
    resolve(result);
  };

  const obs = new MutationObserver(() => {
    if (dlg.open && phase === 'rolling') {
      openedAt = Date.now();
      phase = 'spacebar';
    } else if (!dlg.open && openedAt) {
      finish({ rolls, openWindow: Date.now() - openedAt, fires, stillOpen: false });
    }
  });
  obs.observe(dlg, { attributes: true });

  const tick = () => {
    if (phase === 'done') return;   // ← prevents orphan ticks from firing
    if (Date.now() - start > TIMEOUT_MS) { finish({ timeout: true, rolls, fires }); return; }
    if (phase === 'spacebar') {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      fires++;
      if (Date.now() - openedAt >= 5500) {
        finish({ rolls, openWindow: Date.now() - openedAt, fires, stillOpen: dlg.open });
        return;
      }
      setTimeout(tick, 100);
      return;
    }
    // phase === 'rolling'
    const btn = document.getElementById('roll-btn');
    if (!btn || btn.disabled) { setTimeout(tick, 100); return; }
    btn.click();
    rolls++;
    setTimeout(tick, 400);
  };
  tick();
})
```

**Pass criteria:**
- `stillOpen` is `false`
- `openWindow` is between **2500 ms and 4000 ms** (matches server `ROUND_WIN_DELAY = 3.0 s` plus a tiny slack)
- `fires` is `> 10` (we actually fired spacebars)
- `rolls` is `> 0` (we actually played out a round, which means the test isn't a no-op against an already-closed overlay)

If `stillOpen` is `true`, the sticky-overlay regression is back — check `static/js/roll.js` for the `winner?.open` guard and `static/js/animations.js` for the defensive `hideWinner()` in `tryReveal`'s `onComplete`.

**Note on Step 14 timing:** because this step consumes the 3 s `ROUND_WIN_DELAY` window, Step 14 below should NOT wait an additional 4 seconds — the round has likely already auto-advanced by the time this watcher resolves. Just verify the post-advance state directly.

---

## Step 14 — Round transition + target cycle

After the winner overlay appears, wait (up to 4 seconds, less if Step 13 already consumed the window) for the auto-advance.

Verify on both tabs:
- Winner overlay is closed — `document.getElementById('winner-overlay').open === false`
- `round_num` has incremented by 1
- `target` has changed and matches the cycle **1→2→3→4→5→6→1** (one step up, wrapping 6→1). This is the live check of `next_target` (`t % 6 + 1` in `server/game.py`); confirm the new `target` is exactly the successor in that cycle.
- All dice are unlocked (new fresh dice dealt)
- `has_rolled` is `false` for all players
- Roll button is enabled on Tab 1
- Players-bar text for each player contains `0/10` (matched count reset)

Take screenshot **`.playwright-mcp/14-round2.png`**.

---

## Step 15 — Host pause toggle (host-only) + non-host wait screen

Pause is the first in-game menu feature (`static/js/components/game-screen.js`, host-only, a toggle). With the game running:

On **Tab 1** (host Alpha): click `#game-menu-btn` to open the menu, then verify `#menu-pause-btn` is **visible** (host sees it). On **Tab 2** (guest Beta): click `#game-menu-btn`, verify `#menu-pause-btn` is **hidden** (`hidden` attribute present) — pause is host-only.

On Tab 1, click `#menu-pause-btn`. Verify:
- The button gains the `active` class, its `aria-pressed` is `"true"`, and its `.menu-item-label` text is `Resume Game`.
- `_state.currentState.paused === true` on Tab 1.
- `#roll-btn` is **disabled** with text `Paused`.

On Tab 2, verify the non-host pause overlay (game board stays live — dice remain visible underneath):
- `#game.active` is true, `#loading.active` is false (no screen swap).
- `document.getElementById('pause-overlay').open === true` (the `<dialog>` is open).
- `document.getElementById('pause-overlay-msg').textContent` reads `Waiting for Alpha to resume the game`.
- `_state.currentState.paused === true`.

Take screenshot **`.playwright-mcp/15-paused.png`** (Tab 1, menu open with the toggle on).

---

## Step 16 — Pause status panel, drops suspended, host returns to open menu

The host's menu shows a live status block while paused; players are **not** dropped during a pause, and a host returning from a reconnect lands on the board with the menu auto-opened.

On **Tab 1** (still paused, menu open), verify `#menu-pause-status` is visible and:
- `#pause-players` reads `Everyone is here! Let's go!` (all connected).
- `#pause-remaining` matches `^\d+:\d{2}$` and is **counting down** — read it, wait ~2 s, read again; the second value is smaller (the local 1 Hz ticker).

**Everyone steps away.** On Tab 2, close the socket: `_state.ws.close()`. Within ~2 s verify the pause holds the game open rather than dropping Beta:
- Tab 1 host **stays on the board** — `#game.active` is true, `#game` did **not** swap to `#loading` (the paused-host branch must precede the disconnect-loading branch).
- `#pause-players` now reads `Waiting on Beta…` (one player offline).
- `_state.currentState.players[BETA_ID].disconnected === true` (held, not removed).

**Host returns.** On Tab 1, close the socket (`_state.ws.close()`), then reload instance #1 (`browser_navigate → http://localhost:8888/`). Verify the host comes back to the paused board with the menu surfaced:
- `#game.active` is true (not stuck on loading).
- `#game-menu` has the `open` class (menu auto-opened so the resume toggle is reachable).
- `#menu-pause-status` is visible and `#menu-pause-btn` shows `Resume Game`.

Reload **Tab 2** to bring Beta back; verify it returns to the pause overlay (`document.getElementById('pause-overlay').open === true`, `#pause-overlay-msg` = `Waiting for Alpha to resume the game`) and Tab 1's `#pause-players` returns to `Everyone is here! Let's go!`.

**If Beta lands on the landing screen instead** (no state, `tensies_pid`/`tensies_code`/`tensies_token` all `null`): the earlier throwaway edge-case tabs (Steps 5/7) shared instance #2's persistent profile and cleared Beta's session keys on their own failed bootstrap-reconnect. This is a harness artifact, not a game bug — re-seed before the reload exactly as Step 19 does, then reload:
```js
localStorage.setItem('tensies_pid', BETA_PID);
localStorage.setItem('tensies_code', GAME_CODE);
localStorage.setItem('tensies_token', BETA_TOKEN);
```

Take screenshot **`.playwright-mcp/16-pause-status.png`** (Tab 1, status panel with countdown + player count).

---

## Step 17 — Resume returns everyone to play

On **Tab 1**, click `#menu-pause-btn` to resume. Verify:
- The menu **closes** (`#game-menu` no longer has the `open` class) — resuming hands the board back.
- `_state.currentState.paused === false`; `#menu-pause-status` is hidden.
- `#roll-btn` is enabled again with text `Roll`.

On **Tab 2**, verify it leaves the wait screen: `#game.active` is true, `#loading.active` is false.

Confirm play resumes: roll once on Tab 1 and verify `roll_count` increments (the `paused` guard in `handle_roll` and `roll()` is cleared). Take screenshot **`.playwright-mcp/17-resumed.png`**.

---

## Step 18 — Player disconnect mid-game

On Tab 2, drop Beta by closing the socket **without triggering the client's auto-reconnect**: a bare `_state.ws.close()` on a live page fires `handleWsClose` → `maybeReconnect()` immediately (the creds are still in localStorage), so Beta reappears within a frame and Tab 1 never reaches the loading screen. Null the close handler first:
```js
() => { _state.reconnecting = false; _state.ws.onclose = null; _state.ws.close(); return 'closed without reconnect'; }
```
(Close the socket, not the browser, so the page state stays inspectable. The creds stay in localStorage for the Step 19 reload.) On Tab 1, verify (within ~2 seconds):
- Tab 1 switches off the game screen entirely — `#loading.active` is true, `#game.active` is false
- `#loading-msg` reads `Waiting for Beta to reconnect…`
- `_state.currentState` shows Beta with `disconnected: true` (state is preserved underneath; only the screen swapped)

Take screenshot **`.playwright-mcp/18-post-disconnect.png`** (the loading bar with "Waiting for Beta to reconnect…").

---

## Step 19 — Player reconnect

Continuing from Step 18 (Beta's WS is closed, Tab 1 is on the loading screen).

Because instance #2 uses a persistent profile, `localStorage` survives a reload — so the faithful reconnect test is a **real page reload** of instance #2, which lets the page bootstrap auto-reconnect exactly as a real user's reopened tab would:

```
mcp__playwright-guest__browser_navigate → http://localhost:8888/
```

On load the bootstrap reads `tensies_pid`/`tensies_code`/`tensies_token` and calls `maybeReconnect()` automatically. (If a throwaway edge-case tab earlier clobbered instance #2's `localStorage`, re-seed first:
```js
localStorage.setItem('tensies_pid', BETA_PID);
localStorage.setItem('tensies_code', GAME_CODE);
localStorage.setItem('tensies_token', BETA_TOKEN);  // captured on join
```
then reload.)

Verify on Tab 2:
- `#loading.active` is true and `#loading-msg.textContent` is `Reconnecting…` within the first ~50 ms.
- Within ~3 seconds: `#game.active` is true, Beta's dice area is rendered.

Then on Tab 1 (Alpha) verify:
- `#loading.active` is now false and `#game.active` is true (game restored).
- `_state.currentState` shows Beta with `disconnected: false`.
- Alpha can still roll.

Take screenshot **`.playwright-mcp/19-reconnected.png`**.

**Negative-auth spot check (reconnect token).** After the happy-path reconnect passes, confirm the token gate is enforced. Open a throwaway tab in instance #2 and send a reconnect for Beta's pid/code with a bogus token — it must be rejected:
```js
() => new Promise(res => {
  const ws = new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/ws');
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.type==='welcome') ws.send(JSON.stringify({action:'reconnect',player_id:'BETA_PID',game_code:'CODE',token:'WRONG'}));
    else { res(m); ws.close(); } };
})
```
Expect `{type:'error', msg:'Game not found'}`. A `state`/`round_won` reply instead means the token gate is not working — FAIL.

If the reconnect fails (loading screen stays indefinitely or landing screen shows `Connection failed`), mark this step FAIL. To isolate tooling latency from a real bug, run the headless integration test which exercises the full token auth matrix:

```
docker compose exec web python ${CLAUDE_SKILL_DIR}/scripts/ws_integration_test.py
```

Expected `21/21 checks passed`. If that passes, the Playwright failure was timing latency, not a regression. If the integration test also fails on the reconnect checks, it's a real bug.

---

## Step 20 — Host disconnect + reconnect

This reuses the two instances (instance #1 = host Alpha, instance #2 = guest Beta). With the running game, close the **host's WS** via `_state.ws.close()` in an `evaluate` on **instance #1** (the socket, not the browser — we want a clean close while the page stays inspectable).

On **instance #2** (the non-host), verify the **immediate** post-disconnect state (within ~2 seconds):
- Instance #2 has switched to the loading screen: `#loading.active` is true, `#game.active` is false
- `#loading-msg` reads `Waiting for <host name> to reconnect…`
- `_state.currentState.host` still shows the old host ID (host transfer has NOT happened — the `drop_player` task hasn't fired)
- The game does not crash

**Note on host transfer:** the `host` field only reassigns to the remaining player after the `DISCONNECT_GRACE` drop timer fires (currently **60 s**). This step does **not** wait it out — it verifies the immediate disconnected-but-not-dropped state, then the host *reconnect* path below. (Verifying the actual transfer is an optional slow check, not part of this step.)

Then reload **instance #1** (`mcp__playwright__browser_navigate → http://localhost:8888/`) and verify the host reconnects:
- Instance #1 returns to `#game` with `_state.currentState.players[_state.myId].disconnected === false`
- Instance #2 leaves the loading screen back to `#game`

This is the host-reconnect path that a shared-`localStorage` test setup previously mis-reported as broken.

Take screenshot **`.playwright-mcp/20-host-disconnect.png`**.

---

## Step 21 — Animation integrity (visual spot checks)

Take a screenshot immediately after clicking roll (during shake animation) — **`.playwright-mcp/21a-shake.png`**. Verify dice are visually gathered toward center.

Take a screenshot 400ms after roll completes (during reveal) — **`.playwright-mcp/21b-reveal.png`**. Verify:
- No dice are clipping through each other
- Newly-matched dice show the target value face
- The `.die-3d` elements do not appear mid-tumble (the dice-tearing regression)

Use `evaluate` to check for any pending `_state.rolling === true` with `_state.awaitingAck === true` after all animations settle:
```js
() => ({ rolling: _state.rolling, awaitingAck: _state.awaitingAck, pendingRollState: !!_state.pendingRollState })
```
All should be `false` / `null` at rest.

---

## Step 22 — Winner/loser overlay consistency across rounds (flash regression)

Steps 12–13 check the winner overlay for a **single** round with only one roller. They miss a **cross-player timing race** that only surfaces after several rounds: the **winner's** overlay can open and then be hidden again within a frame.

> When another player's `state` broadcast lands during the winner's roll reveal, it's stashed in `state.postRevealState`. `tryReveal`'s completion used to route that through `showFor()`, which calls `hideWinner()` — so the winner's overlay flashed for ~1–5 ms while losers (who render the overlay directly) always showed the full ~3 s. It's probabilistic, worse when the opponent rolls fast, and reported as "the win state stops appearing for the winner after several rounds." Fixed 2026-06-07 in `static/js/animations.js` (when a win is shown, the stashed broadcast is **dropped** instead of routed through `showFor()`).

**This bug is invisible to a "did the overlay open?" check** — it opens every round; it just closes instantly. You must measure how **long** it stays open. Instrument `#winner-overlay`'s `open` attribute with a `MutationObserver` that records each open→close cycle's **duration** (`performance.now()` delta), plus the banner state (`#winner-banner-suffix` = `Winner`/`Loser`) and round (`#winner-round`).

Both instances are connected and in-game after the reconnect steps. On **both** Tab 1 and Tab 2 install the recorder + an auto-roller, with **staggered cadences** so one player's roll broadcasts routinely land inside the other's reveal window (the faster opponent maximises the race):

```js
// Tab 1: pass INTERVAL = 350 ; Tab 2: pass INTERVAL = 270
() => {
  const dlg = document.getElementById('winner-overlay');
  window.__ovlog = []; let openAt = 0, st = null, rd = null;
  new MutationObserver(() => {
    if (dlg.open) {
      openAt = performance.now();
      st = document.getElementById('winner-banner-suffix')?.textContent;   // "Winner" | "Loser"
      rd = document.getElementById('winner-round')?.textContent;
    } else if (openAt) {
      window.__ovlog.push({ round: rd, state: st, ms: Math.round(performance.now() - openAt) });
      openAt = 0;
    }
  }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  // auto-roller — respects the button.disabled + winner.open guards, so it
  // naturally pauses during the 3 s overlay
  window.__auto = setInterval(() => {
    const b = document.getElementById('roll-btn');
    if (b && !b.disabled && document.getElementById('game').classList.contains('active')) b.click();
  }, INTERVAL);
  return 'overlay recorder + roller installed';
}
```

Let it run until `_state.currentState.round_num` has advanced by **at least 6** (poll it; ~90–150 s), then stop both rollers (`() => { clearInterval(window.__auto); window.__auto = null; }`) and read `window.__ovlog` from each instance.

**Pass criteria** (across both logs):
- **No flash:** every recorded overlay — Winner *and* Loser — stayed open **≥ 2500 ms** (server `ROUND_WIN_DELAY = 3 s`). Any entry with `ms < 1000` is the flash regression.
- **Winner-specific:** **zero** `state === 'Winner'` entries with `ms < 1000` — this is the exact reported symptom (the winning user's overlay vanishing).
- **Per-round consistency:** join the two logs by `round`; in every completed round **exactly one** instance shows `Winner` and the other shows `Loser` (never two winners, never two losers, never a round where the winner saw nothing).
- At least **6 rounds** observed, so the probabilistic race had chances to fire.

If any `Winner` entry flashed (`ms < 1000`), the round-end flash regression is back — check `tryReveal` in `static/js/animations.js`: the `state.pendingWinName` branch must **drop** `state.postRevealState`, not fall through to `showFor(state.postRevealState)` (which hides the just-shown overlay).

**Known related bug (2026-06-08):** `showFor()` in `static/js/net.js` calls `hideWinner()` unconditionally. If a `state` broadcast from another player's roll arrives after the winner's reveal is complete (awaitingAck=false) but while the overlay is still open, `handleMessage` routes it to `showFor()` → `hideWinner()`, closing it early (observed 1153ms). The fix is to guard `handleMessage`: when `document.getElementById('winner-overlay').open === true` and a `state` frame arrives with the same round_num, stash it instead of calling `showFor()`. If this is unfixed, look for one `Winner` entry significantly shorter than 3000ms but above 1000ms — that's the symptom.

Take screenshot **`.playwright-mcp/22-overlay-consistency.png`** (a winner overlay mid-display).

---

## Step 23 — Console error audit

At the end of all tests, collect all browser console messages from both instances. Flag any:
- `Error:` or `Uncaught` entries
- WebSocket close events with non-1000 codes
- Failed resource loads (404s for static assets)

---

## Steps 24–28 — Asset pipeline smoketest (prod build)

These steps switch to the prod Docker stack, verify the esbuild pipeline produced correct bundle outputs, then play a 3-round game to confirm the prod build is functionally identical to dev. Run these after Step 23.

---

## Step 24 — Switch to prod build

The dev stack uses unbundled modules served by FastAPI's `StaticFiles`. The prod stack runs the esbuild pipeline in a Docker builder stage, then serves pre-compressed content-hashed bundles from nginx. These five steps exercise that pipeline.

Stop the dev stack and start the prod build. The `.env.prod` file already sets `WEB_PUBLISH=0.0.0.0:8888`, so nginx lands on the same port. Override `ALLOWED_ORIGINS` so Playwright's localhost WebSocket connections are accepted:

```bash
docker compose down

ALLOWED_ORIGINS=http://localhost:8888 \
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

The `--build` flag runs the full asset pipeline (esbuild bundle + hash + gzip). This takes 30–90 seconds on a cold build. Poll until nginx responds:

```bash
for i in $(seq 1 30); do
  curl -sf http://localhost:8888/ | grep -q "TENSIES" && echo "OK" && break
  echo "waiting ($i)..."
  sleep 3
done
```

If the loop exits without printing "OK", stop and report FAIL with the last few lines of `docker compose -f docker-compose.prod.yml --env-file .env.prod logs nginx web`.

Take screenshot **`.playwright-mcp/24-prod-landing.png`** after navigating instance #1 to `http://localhost:8888/`.

---

## Step 25 — Bundle structure check

Verify the build produced hashed bundles and not unbundled module trees. Run these checks with `curl` — no browser needed.

```bash
PROD_HTML=$(curl -sf http://localhost:8888/)

# 1. Exactly one hashed JS bundle entry point
echo "$PROD_HTML" | grep -o 'src="/static/js/app-[a-f0-9]*\.js"'
# Expected output: src="/static/js/app-<8 hex chars>.js" (exactly one line)

# 2. No individual module paths in HTML
echo "$PROD_HTML" | grep -E '/static/js/(net|state|router|game-render|animations|roll|dice)\.js' \
  && echo "FAIL: individual modules found in HTML" || echo "OK: no individual modules"

# 3. No modulepreload links (these are dropped by the build)
echo "$PROD_HTML" | grep 'modulepreload' \
  && echo "FAIL: modulepreload found" || echo "OK: no modulepreload"

# 4. Hashed CSS bundles present
echo "$PROD_HTML" | grep -o 'href="/static/css/app-[a-f0-9]*\.css"'
echo "$PROD_HTML" | grep -o 'href="/static/css/critical-[a-f0-9]*\.css"'

# 5. JS bundle: gzip encoding + immutable cache header
JS_URL=$(echo "$PROD_HTML" | grep -o '/static/js/app-[a-f0-9]*\.js' | head -1)
echo "JS bundle: $JS_URL"
curl -sI "http://localhost:8888${JS_URL}" | grep -iE 'content-encoding|cache-control'
# Expected:
#   Content-Encoding: gzip
#   Cache-Control: public, max-age=31536000, immutable

# 6. CSS bundle: same headers
CSS_URL=$(echo "$PROD_HTML" | grep -o '/static/css/app-[a-f0-9]*\.css' | head -1)
echo "CSS bundle: $CSS_URL"
curl -sI "http://localhost:8888${CSS_URL}" | grep -iE 'content-encoding|cache-control'
```

**Pass criteria:**
- `src="/static/js/app-<hash>.js"` appears exactly once in the HTML
- No individual module filenames (`net.js`, `state.js`, etc.) in HTML
- No `modulepreload` in HTML
- Both `app-<hash>.css` and `critical-<hash>.css` present in HTML
- JS bundle headers: `Content-Encoding: gzip` and `Cache-Control: … immutable`
- CSS bundle headers: same

---

## Step 26 — Browser resource count

In prod, all JS loads as one bundle (vs. ~24 modules + 24 modulepreload entries in dev), and 9 CSS files merge to one. The total resource count from `performance.getEntriesByType('resource')` should be well under 15 — typically ~7–9.

Navigate both instances to `http://localhost:8888/`. Clear localStorage first on both:

```js
() => { localStorage.clear(); return true; }
```

Then re-navigate and read the resource list:

```js
() => {
  const all = performance.getEntriesByType('resource');
  return {
    total: all.length,
    jsFiles: all.filter(r => r.name.includes('/js/')).map(r => r.name.split('/').pop()),
    cssFiles: all.filter(r => r.name.includes('/css/')).map(r => r.name.split('/').pop()),
    hasIndividualModules: all.some(r =>
      /\/static\/js\/(net|state|router|game-render|animations|roll|dice|app-screen|lobby-screen)\.js/.test(r.name)
    ),
    hasBundledJs: all.some(r => /\/static\/js\/app-[a-f0-9]+\.js/.test(r.name)),
  };
}
```

**Pass criteria:**
- `total` ≤ 15 (dev loads 39+)
- `hasIndividualModules` = `false`
- `hasBundledJs` = `true`
- `jsFiles` contains exactly one entry matching `app-*.js`
- `cssFiles` contains at most two entries (`app-*.css` and `critical-*.css`)

---

## Step 27 — 3-round game on prod build

With both instances on the prod build at `http://localhost:8888/`, play a full 3-round game to confirm the bundle is functionally correct. Use the same pattern as Steps 3–14, but abbreviated: just get through 3 complete rounds.

1. **Clear and setup** — localStorage is already cleared from Step 26. In Tab 1, create a game:
   - Type `Alpha` → submit landing form
   - Store game code from `#lobby-code`

2. **Join** — In Tab 2, navigate to `http://localhost:8888/<GAME_CODE>`, type `Beta`, submit join form.

3. **Start** — In Tab 1, click `#start-btn`. Verify both tabs land on `#game`.

4. **Roll 3 rounds.** For each round, install a winner overlay capture on both tabs before rolling:

   ```js
   window.__winRound = null;
   const ov = document.getElementById('winner-overlay');
   new MutationObserver(() => {
     if (ov.open && !window.__winRound) {
       window.__winRound = {
         name: document.getElementById('winner-name')?.textContent.trim(),
         banner: document.getElementById('winner-banner-suffix')?.textContent.trim(),
         round: document.getElementById('winner-round')?.textContent.trim(),
         openedAt: Date.now(),
       };
     }
   }).observe(ov, { attributes: true, attributeFilter: ['open'] });
   ```

   Then auto-roll both tabs using the `setInterval` pattern from Step 22 until the overlay fires. Read `window.__winRound` on both; verify:
   - At least one tab shows `banner === 'Winner'` and the other shows `'Loser'`
   - The round field matches the current round number

   Reset `window.__winRound = null` before each round. Use `document.querySelector('.round-header')?.textContent` to track which round you're in.

5. After 3 complete rounds, stop rolling. Check:
   - No `Error:` or `Uncaught` in console messages on either instance
   - `document.getElementById('game').classList.contains('active')` = `true`

Take screenshot **`.playwright-mcp/27-prod-game-r3.png`** after round 3 completes.

**Pass criteria:**
- 3 rounds played to completion
- Winner overlay appeared on both tabs for each round
- No console errors

---

## Step 28 — Restore dev stack

Stop the prod stack and restart the dev stack so the session ends in the normal state.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod down
docker compose up -d
sleep 3
curl -sf http://localhost:8888/ | grep -q "TENSIES" && echo "Dev stack restored" || echo "FAIL: dev not up"
```

Navigate both instances to `http://localhost:8888/` to confirm dev assets are serving (the HTML will contain modulepreload links again, not the hashed bundle):

```bash
curl -sf http://localhost:8888/ | grep -q 'modulepreload' && echo "OK: dev HTML" || echo "FAIL: not dev HTML"
```

---

## Reporting

Print a summary table. Preflight (self-update, prior-run review) is reported as a one-line note, not a scored row. The 28 numbered rows map 1:1 to Steps 1–28.

TENSIES TEST RESULTS

Preflight: self-update <ran|none>, prior-run review <ran|none> (not scored)

| # | Result | Description |
|---|--------|-------------|
| 01 | ✅ PASS | Server health |
| 02 | ✅ PASS | Landing screen |
| 03 | ✅ PASS | Create game + lobby |
| 04 | ✅ PASS | Deep-link join + lobby sync |
| 05 | ✅ PASS | Invalid game code rejection |
| 06 | ✅ PASS | Game start + initial render |
| 07 | ✅ PASS | Join-after-start rejection |
| 08 | ✅ PASS | Roll + reveal (single player) |
| 09 | ✅ PASS | Same-value re-roll (no hang) |
| 10 | ✅ PASS | Rate limit + recovery |
| 11 | ✅ PASS | Multiplayer broadcast timing |
| 12 | ✅ PASS | Roll to win + winner overlay |
| 13 | ✅ PASS | Sticky winner overlay regression (spacebar) |
| 14 | ✅ PASS | Round transition + target cycle |
| 15 | ✅ PASS | Host pause toggle + non-host wait screen |
| 16 | ✅ PASS | Pause status panel + drops suspended + host returns to open menu |
| 17 | ✅ PASS | Resume returns everyone to play |
| 18 | ✅ PASS | Player disconnect mid-game |
| 19 | ✅ PASS | Player reconnect flow |
| 20 | ✅ PASS | Host disconnect + reconnect |
| 21 | ✅ PASS | Animation integrity (no tearing) |
| 22 | ✅ PASS | Winner/loser overlay consistency (multi-round, no flash) |
| 23 | ✅ PASS | Console clean (no JS errors) |
| 24 | ✅ PASS | Switch to prod build |
| 25 | ✅ PASS | Bundle structure (hashed URLs, gzip, immutable) |
| 26 | ✅ PASS | Browser resource count (bundled, no individual modules) |
| 27 | ✅ PASS | 3-round game on prod build |
| 28 | ✅ PASS | Restore dev stack |

28/28 passed

Replace `✅ PASS` with `❌ FAIL` or `📝 NOTE` and append a one-line description for any issue. If any test FAILs, describe exactly what went wrong and where to look.

Embed the most interesting screenshot inline at the end of the report (the winner overlay or the shake animation, whichever is more visually compelling).

---

## Log writing

After reporting, write a log file to `docs/test-runs/game/`. Create the directory if it doesn't exist. Name the file using the current date and time: `docs/test-runs/game/YYYY-MM-DDTHH-MM-SS.md`.

The log must include:

```markdown
# Test run — <date and time>

## Results
<pass/fail table, same format as the report>

## Findings
<one bullet per FAIL or notable issue — describe what broke, where to look, and whether it's newly introduced or a known recurrence>

## Notes
<anything interesting observed during the run: timing measurements, edge cases that nearly failed, behaviour that differs from prior runs, observations about animation or sync that might inform future testing>

## Watch next run
<explicit list of things to double-check next time — e.g. steps that were borderline, flaky timing checks, FAILs that got fixed, anything the tester should keep an eye on>
```

If all tests passed and nothing notable was observed, the Findings section should say "None." and Notes should say "Clean run."

After writing the log, add a row for this run to the index table in `docs/test-runs/game/README.md`. The row format matches the existing entries:

```
| [YYYY-MM-DDTHH:MM:SS](YYYY-MM-DDTHH-MM-SS.md) | <scope> | ✅ PASS or 🔴 FAIL | <passed> | <total> | <one-line highlight> |
```

Scope is `Game`, `Telemetry`, or `Game + Telemetry`. Insert the new row at the top of the table (below the header row), so the most recent run appears first. Then output the log file path so it's visible in the report.
