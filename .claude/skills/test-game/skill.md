---
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
git log --since="@${SKILL_MTIME}" --oneline -- main.py static/game.js static/index.html static/style.css
```

If any commits appear in that output:

1. Read `main.py`, `static/game.js`, and `static/index.html` in full.
2. Compare what changed against what this skill currently tests. Look for:
   - **New server actions or messages** (new `action` types in the WebSocket handler, new `msg.type` values in `handleMessage`)
   - **New game state fields** (new keys in `fresh_player`, `state_msg`, or `game` dict)
   - **New client state variables** (new `let` / `const` at the top of `game.js`)
   - **New UI elements** (new IDs or screens in `index.html`)
   - **Bug fixes** — commit messages that say "Fix …" describe a regression worth testing
   - **Removed or renamed things** — tests referencing them need updating
3. Edit this skill file (`Edit` tool) to:
   - Add new test steps for new behaviour
   - Update selectors, variable names, or assertions that have changed
   - Remove tests for things that no longer exist
   - Update the checkpoint count and summary table at the bottom
4. After saving the updated skill, **continue running the tests** with the new version — do not stop.

If there are no new commits, skip straight to Step 1 (Prep).

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
curl -sf http://localhost:8000/ | grep -q "TENSIES" && echo "OK" || echo "FAIL: server not up"
curl -sf http://localhost:8000/random-name | grep -q "name" && echo "OK" || echo "FAIL: /random-name"
```

If either check fails, stop and report — no point running the browser suite against a dead server.

---

## Step 2 — Open two browser tabs

Use `mcp__playwright` to navigate **Tab 1** (Player 1 / host):

```
navigate → http://localhost:8000/
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
2. Click `button.btn-primary` ("Create Game")

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
http://localhost:8000/?join=<GAME_CODE>
```

Verify:
- The join screen (`#join`) is active
- `#code-input` is pre-filled with `GAME_CODE` (deep-link works)
- The URL has been cleaned to `/` (no `?join=` in the address bar)

Type `Beta` into `#join-name-input`, then click "Join Game".

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

Before starting, open a **third tab** and navigate to the root. Type `Gamma` and click "Join Game" with an **invalid code** (`ZZZZZ`). Verify the error message contains "Game not found". Close or reuse Tab 3.

---

## Step 6 — Start the game

In Tab 1, click `#start-btn`. Wait for `#game` screen to become active on Tab 1.

Verify:
- `#my-area` is rendered (dice are visible)
- `#players-bar` shows both Alpha and Beta cards
- The round header shows "Round 1"
- A target die is visible (`.round-target-die`)
- Roll button (`#roll-btn`) is present and **enabled**
- Locked count shows `0/10`

Take screenshot **"05-game-start"**.

Also verify Tab 2 is now on `#game` as well. Check the players bar on Tab 2 mirrors Tab 1.

---

## Step 7 — Join-after-start rejection (edge case)

Open a new tab to `http://localhost:8000/`. Type `Latebird` and click "Join Game" with `GAME_CODE`. Verify the error says "Game already in progress". Close this tab.

---

## Step 8 — Roll and reveal correctness (single-player roll, Tab 1)

In Tab 1:
1. Read `roll_count` from the page state via `evaluate`:
   ```js
   () => currentState?.players[myId]?.roll_count ?? -1
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
() => ({ rc: currentState?.players[myId]?.roll_count, rolling: rolling, awaiting: awaitingAck })
```

Roll 5 times in sequence, checking after each that `rolling` returns to `false` within 3 seconds. If `rolling` is ever stuck `true` for more than 3 seconds without `pendingRollState` being set, flag it as the **roll-ack hang** regression.

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

1. In Tab 1, note the current `roll_count` for Alpha.
2. In Tab 2, get the current `roll_count` for Alpha.
3. Click roll in Tab 1.
4. Immediately (within 200 ms) read `roll_count` for Alpha in Tab 2.
   - **It must still match the pre-roll value.** If it has already advanced, the broadcast went out before the roller's animation finished — regression.
5. Wait 3 seconds, then read again — now it must have advanced. If it hasn't, the ack/broadcast pipeline is broken.

---

## Step 12 — Roll to win

Roll Tab 1's dice until all 10 are locked (matched). Roll in a loop:
- After each roll, read `matched = state.players[myId].dice.filter(d => d === state.target).length`
- If matched < 10, click roll again (wait for button to re-enable first, max 3s wait each time)
- Time out and fail this step after 120 seconds total — something is stuck

When matched === 10:
- Verify `#winner-overlay` has class `visible`
- Verify `#winner-name` contains "Alpha"
- Verify `#winner-sub` mentions the next target number (should be one step down from current)

Take screenshot **"11-winner"**.

Check Tab 2 also shows the winner overlay with the same winner name. **Check that Tab 2 saw the overlay at roughly the same time as Tab 1** (within 3 seconds — it should arrive via the delayed broadcast after roll_done).

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
- Locked count shows `0/10`

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

Close Tab 2 (Beta disconnects). Switch to Tab 1. Verify:
- Beta's card disappears from `#players-bar`
- Alpha can still roll (button enabled, no crash)
- Alpha's locked count is still correct

Take screenshot **"14-post-disconnect"**.

---

## Step 16 — Host disconnect / host transfer

This test requires a fresh game. Start a new two-player game (Tabs 3 and 4, or reuse). Start the game. Then close the **host's tab** (Tab 3).

In Tab 4 (the non-host):
- Verify the game does not crash
- Verify it's possible to keep rolling (game is playable as a solo session)
- If the `host` field is surfaced in state, verify it changed to the remaining player's ID

Take screenshot **"15-host-transfer"**.

---

## Step 17 — Animation integrity (visual spot checks)

Take a screenshot immediately after clicking roll (during shake animation) — label **"16a-shake"**. Verify dice are visually gathered toward center.

Take a screenshot 400ms after roll completes (during reveal) — label **"16b-reveal"**. Verify:
- No dice are clipping through each other
- Newly-matched dice show the target value face
- The `.die-3d` elements do not appear mid-tumble (the dice-tearing regression)

Use `evaluate` to check for any pending `rolling === true` with `awaitingAck === true` after all animations settle:
```js
() => ({ rolling: rolling, awaitingAck: awaitingAck, pendingRollState: !!pendingRollState })
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
 PASS  15  Round transition + target cycle
 PASS  16  Target cycling math
 PASS  17  Player disconnect mid-game
 PASS  18  Host disconnect / host transfer
 PASS  19  Animation integrity (no tearing)
 PASS  20  Console clean (no JS errors)
====================
20/20 passed
```

Replace `PASS` with `FAIL` and append a one-line description for any failure. If any test FAILs, describe exactly what went wrong and where to look.

Embed the most interesting screenshot inline at the end of the report (the winner overlay screenshot or the shake animation, whichever is more visually compelling).
