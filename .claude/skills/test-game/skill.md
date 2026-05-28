---
name: test-game
description: Full integration test of Tensies — spins up the server, runs a two-player game end-to-end with Playwright, checks every known bug class and gameplay edge case, and reports a pass/fail summary.
user_invocable: true
---

# Tensies Game Tester

You are about to run a full integration test of the Tensies multiplayer dice game. This covers:
- Server health
- Full gameplay loop (create → lobby → start → roll → win → next round)
- Multiplayer synchronisation (two separate browser contexts)
- Every specific bug that was previously fixed
- Animation-integrity spot checks via screenshots and console errors

**Do not ask for confirmation. Run everything and report results.**

**All screenshots must be saved to the `.playwright-mcp/` directory** (e.g. `.playwright-mcp/01-landing.png`). Never save them to the project root.

---

## Step 0 — Self-update preflight

Before running any tests, check whether the skill is stale relative to the game code. This keeps the test suite accurate as the game evolves.

```bash
# Get the skill file's last-modified timestamp (seconds since epoch)
SKILL_MTIME=$(stat -f %m .claude/skills/test-game/skill.md 2>/dev/null || stat -c %Y .claude/skills/test-game/skill.md)

# Find commits to game-relevant files that are newer than the skill
git log --since="@${SKILL_MTIME}" --oneline -- main.py server/ static/

# Also check for unstaged / staged changes — uncommitted work is worth testing too
git diff --name-only -- main.py server/ static/
git diff --cached --name-only -- main.py server/ static/
```

If any commits appear **or** any files are listed in the `git diff` output (staged or unstaged changes):

1. Read the relevant refactored modules: `main.py`, `server/ws.py`, `server/game.py`, `server/broadcast.py`, `static/index.html`, and any `static/js/*.js` module touched by the diff.
2. Compare what changed against what this skill currently tests. Look for:
   - **New server actions or messages** (new entries in `ACTIONS` in `server/ws.py`, new `msg.type` values in `handleMessage` in `static/js/ws.js`)
   - **New game state fields** (new keys in `fresh_player`, `state_msg`, or `game` dict in `server/game.py`)
   - **New client state fields** (new keys on the `state` object in `static/js/state.js`)
   - **New UI elements** (new IDs or screens in `index.html`)
   - **Bug fixes** — commit messages that say "Fix …" describe a regression worth testing
   - **Removed or renamed things** — tests referencing them need updating
3. Edit this skill file (`Edit` tool) to:
   - Add new test steps for new behaviour
   - Update selectors, variable names, or assertions that have changed
   - Remove tests for things that no longer exist
   - Update the checkpoint count and summary table at the bottom
4. After saving the updated skill, **continue running the tests** with the new version — do not stop.

If there are no new commits **and** no unstaged/staged changes, skip straight to Step 0b (Prior run review).

---

## Step 0b — Prior run review

Read the most recent test log(s) from `test-logs/` (project root) before starting:

```bash
ls -t test-logs/*.md 2>/dev/null | head -3
```

Read each file returned (up to the 3 most recent). Extract:
- Any **FAILs** from prior runs — these are the first things to watch during this run
- Any **notes or observations** flagged as worth watching
- Any **known flaky** steps or timing-sensitive checks that failed spuriously before

Keep these in mind as you run the suite. If a prior-run FAIL now passes, note it as **fixed/regression-cleared**. If a new FAIL appears that wasn't in prior logs, note it as **newly introduced**.

If no logs exist yet, skip this step.

---

## Step 1 — Prep

Kill any stale browser processes, then bring the server up:

```bash
pkill -f "firefox|chrome|chromium|playwright" 2>/dev/null; true
docker compose up -d
sleep 2
```

Confirm the server is responding before touching the browser:

```bash
curl -sf http://localhost:8888/ | grep -q "TENSIES" && echo "OK" || echo "FAIL: server not up"
```

If the check fails, stop and report — no point running the browser suite against a dead server. (Name generation is now client-side; there is no `/random-name` endpoint.)

---

## Step 2 — Open two browser tabs

Use `mcp__playwright` to navigate **Tab 1** (Player 1 / host):

```
navigate → http://localhost:8888/
```

Take a screenshot labelled **"01-landing"**. Verify:
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

Take screenshot **"02-lobby-p1"**.

---

## Step 4 — Join via deep link (Player 2)

Open a **new tab** in the same browser session. Navigate to:

```
http://localhost:8888/?join=<GAME_CODE>
```

Verify:
- The join screen (`#join`) is active
- `#code-input` is pre-filled with `GAME_CODE` (deep-link works)
- The URL has been cleaned to `/` (no `?join=` in the address bar)

Type `Beta` into `#join-name-input`, then submit the join form (`#join-form button[type="submit"]`).

Wait for `#lobby` to become active. Verify:
- Both "Alpha" and "Beta" appear in `#lobby-players`
- Beta sees `#waiting-msg` = "Waiting for the host to start…"
- Start button is hidden for Beta

Switch back to Tab 1. Verify:
- Beta now appears in the lobby player list
- `#waiting-msg` is now empty (2 players — no longer "invite friends")

Take screenshot **"03-lobby-both"**.

---

## Step 5 — Attempt to join a started game (edge case)

Before starting, open a **third tab** and navigate to the root. The join flow is two steps:
1. Type `Gamma` into `#name-input` on the landing screen, then click `#show-join-btn` to reach the join screen.
2. On the join screen, fill `#code-input` with `ZZZZZ`, then submit the join form (`#join-form button[type="submit"]`).

Verify `#join-error` (not `#landing-error`) contains "Game not found". Close or reuse Tab 3.

---

## Step 6 — Start the game

In Tab 1, click `#start-btn`. Wait for `#game` screen to become active on Tab 1.

Verify:
- `#my-area` is rendered (dice are visible)
- `#players-bar` shows both Alpha and Beta cards
- The round header shows "Round 1"
- A target die is visible (`.round-target-die`)
- Roll button (`#roll-btn`) is present and **enabled**
- Players-bar text for Alpha contains `0/10` (no separate `#locked-count` element exists — it is embedded in the bar)

Take screenshot **"05-game-start"**.

Also verify Tab 2 is now on `#game` as well. Check the players bar on Tab 2 mirrors Tab 1.

---

## Step 7 — Join-after-start rejection (edge case)

Open a new tab to `http://localhost:8888/`. Use the two-step join flow:
1. Type `Latebird` into `#name-input`, then click `#show-join-btn`.
2. Fill `#code-input` with `GAME_CODE`, then submit the join form (`#join-form button[type="submit"]`).

Verify `#join-error` (not `#landing-error`) contains "Game already in progress". Close this tab.

---

## Step 8 — Roll and reveal correctness (single-player roll, Tab 1)

In Tab 1:
1. Read `roll_count` from the page state via `evaluate` (`_state` is the shared module-state object, exposed for testing in `static/js/state.js`):
   ```js
   () => _state.currentState?.players[_state.myId]?.roll_count ?? -1
   ```
2. Click `#roll-btn`.
3. Verify the button becomes disabled immediately.
4. Wait up to 3 seconds for the button to re-enable.
5. Read `roll_count` again — it must be exactly 1 higher than before. **If it's not, this is a hang (the roll-ack bug).**

Check console for any errors during this sequence.

Take screenshot **"07-after-roll"**. Visually verify:
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

While the roll button is enabled, fire two rolls within 250 ms (click the button twice in rapid succession via `evaluate`):

```js
() => { document.getElementById('roll-btn').click(); document.getElementById('roll-btn').click(); }
```

Check console messages — the server should have logged a rate limit warning. Verify the roll button re-enables (the `error` message handler clears the locked state) so the game is not stuck.

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
2. Switch to Tab 1. Record the click timestamp and roll:
   ```js
   () => { window._rollClickedAt = Date.now(); document.getElementById('roll-btn').click(); return window._rollClickedAt; }
   ```
3. Wait 3 seconds (for animation to complete and broadcast to arrive).
4. Switch back to Tab 2 and read results:
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
- `msAfterRollClick` is **between 1000ms and 2000ms** — this is the expected animation window (gather + shake + reveal). The broadcast timing has measured 1491ms and 1589ms across runs.
- If `msAfterRollClick` < 200ms, the broadcast went out before the roller's animation finished — **regression**.

---

## Step 12 — Roll to win

**Note:** Alpha will often have already won round 1 during the roll-heavy steps 9–12 (8+ rolls total). If so, this step runs in round 2 or later — that is expected and fine. Check `_state.currentState.round_num` to confirm which round you're in.

**Winner overlay capture:** The overlay auto-dismisses after ~4 seconds. A post-loop screenshot will always miss it. Install a `MutationObserver` before the roll loop and capture content when the overlay gains `visible`:

```js
window._winnerCapture = null;
const overlay = document.getElementById('winner-overlay');
new MutationObserver(() => {
  if (overlay.classList.contains('visible') && !window._winnerCapture) {
    window._winnerCapture = {
      winnerName: document.getElementById('winner-name')?.textContent.trim(),
      winnerSub: document.getElementById('winner-sub')?.textContent.trim(),
      capturedAt: Date.now()
    };
  }
}).observe(overlay, { attributes: true, attributeFilter: ['class'] });
```

Then roll in a loop:
- After each roll, read `matched = _state.currentState.players[_state.myId].dice.filter(d => d === _state.currentState.target).length`
- If matched < 10, wait for roll button to re-enable (max 3s), then roll again
- Time out and fail after 120 seconds total

When the loop exits, read `window._winnerCapture`. Verify:
- `winnerName` contains "Alpha"
- `winnerSub` mentions the next target number (one step down from current)

Take screenshot **"11-winner"** (will show post-advance state; the MutationObserver data is the authoritative overlay check).

Check Tab 2 also advanced to the next round with the same state (same `round_num`, same `target`, same `winnerName` in the overlay element).

---

## Step 12b — Sticky winner overlay regression

Simulate a player pressing spacebar (or clicking the still-keyboard-focusable roll button) during the winner overlay. The bug being guarded against:

> A spacebar during the overlay used to call `roll()`, which set
> `state.awaitingAck = true` and sent a roll the server silently
> dropped (`game.round_over=True`). When the new-round state arrived
> ~3s later, `awaitingAck` trapped it in `pendingRollState` instead of
> routing through `showFor() → hideWinner()`, and the dialog never
> closed.

**Do not run this as a separate evaluate after Step 12.** Step 12's roll-loop usually consumes most of the 3 s `ROUND_WIN_DELAY` window, so by the time a follow-up evaluate is dispatched the overlay has already auto-closed and there's nothing left to hammer.

Instead, run a single self-contained promise that rolls to win **and then immediately** hammers spacebar during the open window. Use a `phase` state-machine + `obs.disconnect()` so the `setTimeout` chain *cannot* keep firing after `resolve()` — orphan ticks were the source of the round-3 contamination that Step 13 used to misread:

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

**Note on Step 13 timing:** because this step consumes the 3 s `ROUND_WIN_DELAY` window, Step 13 below should NOT wait an additional 4 seconds — the round has likely already auto-advanced by the time this watcher resolves. Just verify the post-advance state directly.

---

## Step 13 — Round transition

After the winner overlay appears, wait 4 seconds for the auto-advance.

Verify on both tabs:
- Winner overlay is gone (`#winner-overlay` does not have class `visible`)
- `round_num` has incremented by 1
- `target` has changed (cycled: 6→5, 5→4, …, 1→6)
- All dice are unlocked (new fresh dice dealt)
- `has_rolled` is `false` for all players
- Roll button is enabled on Tab 1
- Players-bar text for each player contains `0/10` (matched count reset)

Take screenshot **"12-round2"**.

---

## Step 14 — Target cycling correctness

Verify the client-side `nextTarget` function matches the server's `next_target` logic:
```js
() => {
  const results = [];
  for (let t = 1; t <= 6; t++) results.push([t, ((t - 2 + 6) % 6) + 1]);
  return results;
}
```
Expected: `[[1,6],[2,1],[3,2],[4,3],[5,4],[6,5]]`

---

## Step 15 — Player disconnect mid-game

In Tab 2, run `_state.ws.close()` via `evaluate` to simulate Beta dropping (per prior log: `browser_close` kills the whole session). Switch to Tab 1. Verify (within ~2 seconds):
- Tab 1 switches off the game screen entirely — `#loading.active` is true, `#game.active` is false
- `#loading-msg` reads `Waiting for Beta to reconnect…`
- `_state.currentState` shows Beta with `disconnected: true` (state is preserved underneath; only the screen swapped)

Take screenshot **"14-post-disconnect"** (you'll see the loading bar with "Waiting for Beta to reconnect…").

---

## Step 15b — Player reconnect

Continuing from Step 15 (Beta's WS is closed, Tab 1 is on the loading screen).

On Tab 2, seed localStorage with Beta's pid/code and call the reconnect path directly via dynamic import (the per-tab Playwright MCP wipes localStorage across `goto`/`reload`, so the auto-trigger on page load doesn't work):

```js
async () => {
  localStorage.setItem('tensies_pid', _state.myId);
  localStorage.setItem('tensies_code', _state.gameCode);
  _state.reconnecting = false;
  const ws = await import('/static/js/ws.js');
  ws.maybeReconnect();
}
```

Verify on Tab 2:
- `#loading.active` is true and `#loading-msg.textContent` is `Reconnecting…` within the first ~50 ms.
- Within ~3 seconds: `#game.active` is true, Beta's dice area is rendered.

Then switch back to Tab 1 (Alpha) and verify:
- `#loading.active` is now false and `#game.active` is true (game restored).
- `_state.currentState` shows Beta with `disconnected: false`.
- Alpha can still roll.

Take screenshot **"14b-reconnected"**.

If the reconnect fails (loading screen stays indefinitely or landing screen shows `Connection failed`), mark this step FAIL. Confirm whether it's because the server already dropped Beta (30 s grace elapsed during the test's tab-switch latency) or a client-side bug by running an out-of-band direct-WS reconnect:

```python
import asyncio, json, websockets
async def main():
    h = await websockets.connect("ws://127.0.0.1:8888/ws")
    json.loads(await h.recv())
    await h.send(json.dumps({"action":"create","name":"X"}))
    st = json.loads(await h.recv()); code = st["code"]; pid = list(st["players"])[0]
    await h.close(); await asyncio.sleep(0.3)
    h2 = await websockets.connect("ws://127.0.0.1:8888/ws")
    json.loads(await h2.recv())
    await h2.send(json.dumps({"action":"reconnect","player_id":pid,"game_code":code}))
    print(json.loads(await h2.recv())["players"][pid]["disconnected"])
asyncio.run(main())
```

Expected `False`. If that passes, the failure was test-tooling latency, not a regression.

---

## Step 16 — Host disconnect / host transfer

This test requires a fresh game. Start a new two-player game (Tabs 3 and 4, or reuse). Start the game. Then close the **host's WS** via `_state.ws.close()` in `evaluate` (not the tab itself).

In Tab 4 (the non-host), verify the **immediate** post-disconnect state (within ~2 seconds):
- Tab 4 has switched to the loading screen: `#loading.active` is true, `#game.active` is false
- `#loading-msg` reads `Waiting for <host name> to reconnect…`
- `_state.currentState.host` still shows the old host ID (host transfer hasn't happened yet — the drop_player task hasn't fired)
- The game does not crash

**Note:** Host transfer (`host` field updating to the remaining player's ID) only happens after the 30-second drop timer fires. Do **not** wait 30s — verify the immediate disconnected-but-not-dropped state instead. Test that `_state.currentState.host` still shows the old host ID at this point (transfer has not yet occurred).

Take screenshot **"15-host-transfer"**.

---

## Step 17 — Animation integrity (visual spot checks)

Take a screenshot immediately after clicking roll (during shake animation) — label **"16a-shake"**. Verify dice are visually gathered toward center.

Take a screenshot 400ms after roll completes (during reveal) — label **"16b-reveal"**. Verify:
- No dice are clipping through each other
- Newly-matched dice show the target value face
- The `.die-3d` elements do not appear mid-tumble (the dice-tearing regression)

Use `evaluate` to check for any pending `_state.rolling === true` with `_state.awaitingAck === true` after all animations settle:
```js
() => ({ rolling: _state.rolling, awaitingAck: _state.awaitingAck, pendingRollState: !!_state.pendingRollState })
```
All should be `false` / `null` at rest.

---

## Step 18 — Console error audit

At the end of all tests, collect all browser console messages from all tabs. Flag any:
- `Error:` or `Uncaught` entries
- WebSocket close events with non-1000 codes
- Failed resource loads (404s for static assets)

---

## Reporting

Print a summary table:

```
TENSIES TEST RESULTS
====================
 PASS  01  Self-update check
 PASS  02  Server health
 PASS  03  Landing screen
 PASS  04  Create game + lobby
 PASS  05  Deep-link join (?join=CODE)
 PASS  06  Invalid code rejection
 PASS  07  Multiplayer lobby sync
 PASS  08  Join-after-start rejection
 PASS  09  Game start + initial render
 PASS  10  Roll + reveal (single player)
 PASS  11  Same-value re-roll (no hang)
 PASS  12  Rate limit + recovery
 PASS  13  Multiplayer broadcast timing
 PASS  14  Roll to win + winner overlay
 PASS  15  Sticky winner overlay regression (spacebar)
 PASS  16  Round transition + target cycle
 PASS  17  Target cycling math
 PASS  18  Player disconnect mid-game
 PASS  19  Player reconnect flow
 PASS  20  Host disconnect / host transfer
 PASS  21  Animation integrity (no tearing)
 PASS  22  Console clean (no JS errors)
====================
22/22 passed
```

Replace `PASS` with `FAIL` and append a one-line description for any failure. If any test FAILs, describe exactly what went wrong and where to look.

Embed the most interesting screenshot inline at the end of the report (the winner overlay screenshot or the shake animation, whichever is more visually compelling).

---

## Log writing

After reporting, write a log file to `test-logs/` in the project root. Create the directory if it doesn't exist. Name the file using the current date and time: `test-logs/YYYY-MM-DDTHH-MM-SS.md`.

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

If all 20 tests passed and nothing notable was observed, the Findings section should say "None." and Notes should say "Clean run."

After writing the log, output the file path so it's visible in the report.
