---
name: test-telemetry
description: Full telemetry pipeline test — services health, event-to-Postgres-to-Prometheus pipeline integrity, all five Grafana dashboards (screenshots + Live panel verification), dice fairness, timeline sanity, and anomaly detection. Reports a pass/fail summary and writes a log to docs/test-runs/telemetry/.
user_invocable: true
---

# Tensies Telemetry Tester

You are about to run a full integration test of the Tensies telemetry pipeline. This covers:
- All four supporting services (server, Prometheus, Grafana, Postgres)
- End-to-end event flow: game actions → `events` table → rollup tables → Prometheus counters
- Cross-system consistency (Prometheus vs Postgres, within 5% tolerance)
- All five Grafana dashboards — panel health + Grafana Live streaming data
- Data anomaly detection: dice fairness, impossible state values, telemetry self-metrics

**Do not ask for confirmation. Run everything and report results.**

**All screenshots must be saved into the `.playwright-mcp/` directory** using a `t` prefix: `filename: ".playwright-mcp/t10-live-games.png"`. A bare filename lands in the project root; always include the `.playwright-mcp/` prefix.

## Playwright instances

This skill uses **three** Playwright MCP instances:

| Role | MCP tool prefix | Use |
|------|-----------------|-----|
| Alpha (game host) | `mcp__playwright__*` | Plays the game |
| Beta (game guest) | `mcp__playwright-guest__*` | Plays the game |
| Grafana inspector | `mcp__playwright-g2-host__*` | Navigates Grafana dashboards |

The game instances need isolated `localStorage` (separate profiles). The Grafana instance is completely independent. As with `test-game`, a first `browser_navigate` may error if the browser was closed since last session — retry once; only flag as a failure if the retry also errors.

---

## Preflight A — Self-update

Before running any tests, check whether the skill is stale relative to the telemetry code.

```bash
SKILL_MTIME=$(stat -f %m .claude/skills/test-telemetry/skill.md 2>/dev/null || stat -c %Y .claude/skills/test-telemetry/skill.md)

# Commits to telemetry-relevant files newer than the skill
git log --since="@${SKILL_MTIME}" --oneline -- server/telemetry/ server/ws.py server/broadcast.py migrations/ ops/grafana/dashboards/

# Uncommitted changes
git diff --name-only -- server/telemetry/ server/ws.py server/broadcast.py migrations/ ops/grafana/dashboards/
git diff --cached --name-only -- server/telemetry/ server/ws.py server/broadcast.py migrations/ ops/grafana/dashboards/
```

If any commits appear or any files are listed in the `git diff` output:

1. Read the relevant changed modules.
2. Compare what changed against what this skill currently tests. Look for:
   - **New event types** — new `emit(…)` calls in `server/ws.py` or `server/broadcast.py`
   - **New metrics** — new definitions in `server/telemetry/metrics.py`
   - **New rollup tables or columns** — new `CREATE TABLE` or `ALTER TABLE` in `migrations/`
   - **New or renamed dashboards** — changed UIDs or titles in `ops/grafana/dashboards/`
   - **New Grafana Live channels** — new `stream/tensies/…` paths in `server/telemetry/live.py`
3. Edit this skill file to add, update, or remove tests accordingly.
4. After saving the updated skill, continue running the tests.

If no changes, skip straight to Preflight B.

---

## Preflight B — Prior run review

```bash
ls -t docs/test-runs/telemetry/*.md 2>/dev/null | grep -v README | head -3
```

Read each file returned (up to 3 most recent). Extract:
- Prior FAILs — watch for recurrence
- Notes flagged as worth watching
- Known flaky steps

If no logs exist yet, skip this step.

---

## Step 1 — Server + Prometheus health

Bring the stack up:

```bash
docker compose up -d
sleep 3
```

Check the server:
```bash
curl -sf http://localhost:8888/ | grep -q "TENSIES" && echo "SERVER OK" || echo "FAIL: server not up"
```

Check the `/metrics` endpoint — it must respond and contain the key metric names:
```bash
curl -sf http://localhost:8888/metrics | grep -cE "^tensies_" | awk '{print "Tensies metrics found:", $1}'
curl -sf http://localhost:8888/metrics | grep -q "tensies_rolls_total" && echo "rolls_total OK"
curl -sf http://localhost:8888/metrics | grep -q "tensies_games_active" && echo "games_active OK"
curl -sf http://localhost:8888/metrics | grep -q "tensies_telemetry_dropped_total" && echo "dropped_total OK"
```

Check Prometheus:
```bash
curl -sf http://localhost:9090/-/healthy && echo "PROMETHEUS OK" || echo "FAIL: Prometheus not healthy"

# Verify scrape target is UP
curl -sf 'http://localhost:9090/api/v1/targets' | python3 -c "
import sys, json
data = json.load(sys.stdin)
targets = data.get('data', {}).get('activeTargets', [])
tensies = [t for t in targets if '8888' in t.get('scrapeUrl','') or 'tensies' in str(t.get('labels',''))]
if not tensies:
    print('FAIL: no tensies scrape target found')
else:
    t = tensies[0]
    health = t.get('health','unknown')
    last = t.get('lastScrape','?')
    print(f'Scrape target: {health}, last scraped: {last}')
"
```

**Pass criteria:**
- `/metrics` returns HTTP 200 with `>= 20` `tensies_` metric lines
- `tensies_rolls_total`, `tensies_games_active`, and `tensies_telemetry_dropped_total` are present
- Prometheus `/health` returns 200
- Scrape target `health == "up"`

---

## Step 2 — Grafana health

Navigate the Grafana inspector instance (`mcp__playwright-g2-host`) to Grafana. Clear any prior session state first:

```js
() => { localStorage.clear(); return true; }
```

Then navigate to `http://localhost:8889`.

Also check the health API:
```bash
curl -sf http://localhost:8889/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('Grafana', d.get('version','?'), '-', 'OK' if d.get('database')=='ok' else 'FAIL: db not ok')"
```

Check that provisioned dashboards are present:
```bash
curl -sf 'http://localhost:8889/api/search?type=dash-db' | python3 -c "
import sys, json
dbs = json.load(sys.stdin)
uids = {d['uid'] for d in dbs}
expected = {'tensies-live', 'tensies-game', 'tensies-conn', 'tensies-health', 'tensies-analytics'}
missing = expected - uids
if missing:
    print('FAIL: missing dashboards:', missing)
else:
    print('All 5 dashboards provisioned OK')
"
```

Take screenshot **`.playwright-mcp/t02-grafana-home.png`** of the Grafana home screen.

**Pass criteria:**
- Grafana API health returns `database: ok`
- All 5 dashboard UIDs present in `/api/search` response
- Home screen renders without error

---

## Step 3 — Postgres health + migrations

```bash
# Confirm Postgres is reachable and migrations ran
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT COUNT(*) AS migrations_run FROM schema_migrations;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
"
```

Check that the current month's partition exists:
```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT tablename FROM pg_tables
WHERE tablename LIKE 'events_%'
ORDER BY tablename DESC LIMIT 3;
"
```

Check key tables exist:
```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN ('events','games','rounds','round_player','player_stats','sessions','connections','live_games','live_players','live_sessions')
ORDER BY table_name;
" | grep -c "|" | awk '{print "Tables found:", $1}'
```

**Pass criteria:**
- `schema_migrations` has at least 2 rows
- An `events_YYYY_MM` partition exists for the current month (2026_05)
- All 10 expected tables present

---

## Step 4 — Pre-game baseline snapshot

Capture counter values **before** the test game so you can measure deltas precisely in Step 8.

```bash
# Prometheus counters baseline
curl -sf http://localhost:8888/metrics | grep -E "^tensies_(rolls_total|games_started_total|games_ended_total|rounds_started_total|rounds_completed_total|sessions_started_total|telemetry_dropped_total|live_push_failures_total|games_active)[^_]" | sort
```

Store these values. Also snapshot current Postgres event counts:
```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT type, COUNT(*) FROM events GROUP BY type ORDER BY type;
"
```

Record:
- `BASELINE_ROLLS` — value of `tensies_rolls_total`
- `BASELINE_GAMES_STARTED` — value of `tensies_games_started_total`
- `BASELINE_SESSIONS` — value of `tensies_sessions_started_total`
- `BASELINE_DROPPED` — value of `tensies_telemetry_dropped_total`
- `BASELINE_PUSH_FAILURES` — value of `tensies_live_push_failures_total`
- `BASELINE_GAMES_ACTIVE` — value of `tensies_games_active` (gauge — should be 0 if no games running)

This step always passes (it's a read).

---

## Step 5 — Play a game (event generation)

Play a real game using the host and guest Playwright instances to drive a known set of events through the full pipeline.

**Clear stale sessions on both game instances first:**
```js
// Run on both mcp__playwright and mcp__playwright-guest
() => { localStorage.clear(); return true; }
```
Then navigate both to `http://localhost:8888/`.

**Alpha creates the game:**
1. Type `Telemetry` into `#name-input` on instance #1
2. Submit `#landing-form` → wait for `#lobby.active`
3. Capture the game code from `#lobby-code` — store as `GAME_CODE`

**Beta joins:**
4. In instance #2 (guest), navigate to `http://localhost:8888/?join=<GAME_CODE>`
5. Type `Monitor` into `#join-name-input`, submit `#join-form`
6. Wait for `#lobby.active` on both instances

**Start the game:**
7. In instance #1, click `#start-btn`, wait for `#game.active` on both instances

**Capture player IDs (needed for Postgres queries later):**
```js
// Run on instance #1 after game starts
() => ({
  myId: _state.myId,
  gameCode: _state.currentState?.code,
  players: Object.entries(_state.currentState?.players ?? {}).map(([id, p]) => ({ id, name: p.name }))
})
```
Store `ALPHA_ID`, `BETA_ID`, and confirm `GAME_CODE`.

**Verify `tensies_games_active` incremented:**
```bash
curl -sf http://localhost:8888/metrics | grep "^tensies_games_active "
```
Should be `BASELINE_GAMES_ACTIVE + 1`. If not, WARN (another game may be running).

**Roll 3 rounds using the auto-roller:**

8. Inject the auto-roller into both instances. It stops itself after 3 rounds:
```js
// Run on mcp__playwright (Alpha)
() => {
  window._autoRollEnabled = true;
  window._rollCount = 0;
  window._lastRoundNum = _state.currentState?.round_num ?? 1;
  window._autoRoller = setInterval(() => {
    if (!window._autoRollEnabled) return;
    const state = _state.currentState;
    if (!state?.started) return;
    if (state.round_num > window._lastRoundNum) { window._lastRoundNum = state.round_num; }
    if (state.round_num > 3) { window._autoRollEnabled = false; return; }
    if (_state.rolling || _state.awaitingAck) return;
    const btn = document.getElementById('roll-btn');
    if (btn && !btn.disabled) { btn.click(); window._rollCount++; }
  }, 250);
  return 'roller installed';
}
```
```js
// Run on mcp__playwright-guest (Beta) — same but 280ms interval
() => {
  window._autoRollEnabled = true;
  window._autoRoller = setInterval(() => {
    if (!window._autoRollEnabled) return;
    const state = _state.currentState;
    if (!state?.started || state.round_num > 3) { window._autoRollEnabled = false; return; }
    if (_state.rolling || _state.awaitingAck) return;
    const btn = document.getElementById('roll-btn');
    if (btn && !btn.disabled) btn.click();
  }, 280);
  return 'roller installed';
}
```

9. **Mid-game live-games dashboard check** — while the rollers run, validate the Live panels with a real active game. Wait 5 seconds for at least one roll to land, then:

   Query `started_ts` to build the Grafana URL (store as `LIVE_FROM_MS`):
   ```bash
   docker compose exec -T postgres psql -U tensies tensies -c "
   SELECT extract(epoch from started_ts)::bigint * 1000 AS from_ms
   FROM games WHERE game_code = 'GAME_CODE';
   "
   ```

   Navigate the Grafana inspector to the live-games dashboard using `LIVE_FROM_MS` and `now` as the window:
   ```
   http://localhost:8889/d/tensies-live/tensies-live-games?refresh=5s&from=LIVE_FROM_MS&to=now
   ```

   Wait 3 seconds, then take screenshot **`.playwright-mcp/t05-live-games-active.png`**.

   Assert the Live panels show real data:
   ```js
   () => {
     const panels = Array.from(document.querySelectorAll('[class*="panel-container"]'));
     const byTitle = title => panels.find(p => p.querySelector('h6,[class*="title"]')?.textContent?.trim() === title);
     const activeGamesPanel = byTitle('Active games');
     const roundProgressPanel = byTitle('Round progress per player');
     const text = document.body.innerText;
     return {
       active_games_has_data: activeGamesPanel ? !activeGamesPanel.textContent.includes('No data') : null,
       round_progress_has_data: roundProgressPanel ? !roundProgressPanel.textContent.includes('No data') : null,
       game_code_visible: text.includes('GAME_CODE'),
       player_count_visible: /[12]\s*(Players?|player)/.test(text) || text.includes('Monitor') || text.includes('Telemetry'),
     };
   }
   ```

   **Pass criteria for mid-game check:**
   - `active_games_has_data = true` — "Active games" table shows the running game
   - `round_progress_has_data = true` — "Round progress per player" shows matched counts
   - `game_code_visible = true` — the test game's code appears in the panel
   - `player_count_visible = true` — at least one player name or count is visible

   FAIL if either Live panel shows "No data" during an active game.

10. Poll Postgres until 3 rounds have completed (timeout 3 minutes):
```bash
until docker compose exec -T postgres psql -U tensies tensies -c \
  "SELECT count(*) FROM rounds WHERE game_code = 'GAME_CODE' AND winner_user_id IS NOT NULL" \
  2>/dev/null | grep -qE '^\s+3\s*$'; do sleep 5; done && echo "3 rounds done"
```

11. Stop the rollers on both instances:
```js
() => { window._autoRollEnabled = false; clearInterval(window._autoRoller); return window._rollCount; }
```

**End the game cleanly — navigate both browsers away:**

Navigate both instances to `about:blank`. This tears down the JS context so the auto-reconnect loop cannot fire, causing a clean DISCONNECT_GRACE expiry and proper `game_ended` emission.
```
// mcp__playwright and mcp__playwright-guest: browser_navigate to "about:blank"
```

Then poll Postgres until `games.status = 'ended'` (DISCONNECT_GRACE is 60s — allow up to 90s):
```bash
until docker compose exec -T postgres psql -U tensies tensies -c \
  "SELECT status FROM games WHERE game_code = 'GAME_CODE'" \
  2>/dev/null | grep -q 'ended'; do sleep 5; done && echo "game ended"
```

Wait 3 additional seconds for the telemetry writer to drain.

---

## Step 6 — Postgres event log

Query the events table for the game you just played. All expected event types must be present.

```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT type, COUNT(*) as n
FROM events
WHERE game_code = 'GAME_CODE'
GROUP BY type
ORDER BY type;
"
```

Check each required type is present (count >= 1):
- `game_created` — exactly 1
- `game_started` — exactly 1
- `game_ended` — exactly 1 (now fires because we navigated away cleanly)
- `player_joined` — exactly 2
- `round_started` — at least 3
- `round_ended` — at least 3
- `round_won` — at least 3
- `roll` — at least 3 (both players rolled across 3 rounds)

Note: `connection_opened`, `connection_closed`, `session_started`, `session_ended` are stored **without** `game_code` (they fire before/after a player is associated with a game). They will not appear in this query — that is expected. They can be verified separately by filtering on `user_id` if needed.

Also verify the `roll` events have complete payloads:
```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT
  COUNT(*) AS total_rolls,
  COUNT(*) FILTER (WHERE payload->>'matched' IS NULL) AS missing_matched,
  COUNT(*) FILTER (WHERE payload->>'dice_after' IS NULL) AS missing_dice_after,
  MIN((payload->>'matched')::int) AS min_matched,
  MAX((payload->>'matched')::int) AS max_matched
FROM events
WHERE game_code = 'GAME_CODE' AND type = 'roll';
"
```

**Pass criteria:**
- All 8 required event types present (including `game_ended`)
- `missing_matched` = 0, `missing_dice_after` = 0
- `max_matched` <= 10 (no impossible match count)

---

## Step 7 — Rollup table integrity

Verify each rollup table was updated correctly for this game.

```bash
docker compose exec -T postgres psql -U tensies tensies -c "
-- games rollup
SELECT game_code, status, peak_players, player_count, round_count, total_rolls
FROM games WHERE game_code = 'GAME_CODE';

-- rounds rollup
SELECT round_num, target, winner_user_id IS NOT NULL AS has_winner,
       duration_ms, total_rolls
FROM rounds WHERE game_code = 'GAME_CODE' ORDER BY round_num;

-- round_player breakdown
SELECT round_num, user_id, rolls, matched_at_end
FROM round_player WHERE game_code = 'GAME_CODE' ORDER BY round_num, user_id;
"
```

Check:
- `games.status = 'ended'` (game closed cleanly)
- `games.peak_players == 2` (max players who joined; stable at game-end)
- `games.player_count == 0` (live connected count; expected 0 after clean end)
- `games.round_count >= 3` (all 3 played rounds recorded)
- All 3 `rounds` rows have `has_winner = true` and `duration_ms > 0`
- Target cycling is correct: round 1 → target 6, round 2 → target 5, round 3 → target 4
- `round_player` rows exist for rounds with rolls
- `rounds.total_rolls` matches `round_player` roll sums

Check player_stats updated for both players:
```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT user_id, total_rolls, total_wins
FROM player_stats
WHERE user_id IN ('ALPHA_ID', 'BETA_ID')
ORDER BY user_id;
"
```

**Pass criteria:**
- `games.status = 'ended'`
- `games.peak_players = 2`
- `games.player_count = 0` (drops to 0 on clean game end — expected)
- `games.round_count >= 3`
- All 3 rounds have winner and positive duration
- Targets follow the 6→5→4 sequence
- `player_stats` rows exist for both players with `total_rolls > 0`

---

## Step 8 — Prometheus delta cross-check

Read the current Prometheus counters and compare the delta against the Postgres event counts for the test game.

```bash
curl -sf http://localhost:8888/metrics | grep -E "^tensies_(rolls_total|games_started_total|games_ended_total|rounds_started_total|sessions_started_total|telemetry_dropped_total|live_push_failures_total|games_active)[^_]" | sort
```

Compute deltas vs baseline (Step 4). Then compare:

| Metric | Check | Tolerance |
|---|---|---|
| `tensies_rolls_total` delta | = Postgres `COUNT(*)` WHERE `type='roll' AND game_code=GAME_CODE` | 5% |
| `tensies_games_started_total` delta | = 1 | exact |
| `tensies_games_ended_total` delta | = 1 (game closed cleanly) | exact |
| `tensies_sessions_started_total` delta | >= 2 (two players) | exact |
| `tensies_rounds_started_total` sum delta | >= 3 | exact |
| `tensies_games_active` (gauge) | = `BASELINE_GAMES_ACTIVE` (back to baseline — game ended) | exact |

**`tensies_games_active` is the key "playing" metric.** It should have gone `BASELINE → BASELINE+1` when the game started, and back to `BASELINE` now that `game_ended` fired. If it's still `BASELINE+1`, the game did not end cleanly — FAIL.

**5% tolerance rule:** if `abs(prometheus_count - postgres_count) / postgres_count > 0.05` and the absolute difference > 2, flag as FAIL.

Also verify no new drops or push failures occurred:
```bash
DROPS_NOW=$(curl -sf http://localhost:8888/metrics | grep "^tensies_telemetry_dropped_total " | awk '{print $2}')
FAILS_NOW=$(curl -sf http://localhost:8888/metrics | grep "^tensies_live_push_failures_total " | awk '{print $2}')
# Compare to BASELINE_DROPPED and BASELINE_PUSH_FAILURES
```

**Pass criteria:**
- `rolls_total` delta within 5% of Postgres roll count
- `games_started_total` delta == 1
- `games_ended_total` delta == 1
- `tensies_games_active` == `BASELINE_GAMES_ACTIVE` (returned to baseline)
- `tensies_telemetry_dropped_total` unchanged since baseline
- `tensies_live_push_failures_total` unchanged since baseline

---

## Step 9 — live-games dashboard

Get the game's start time from Postgres so all dashboard URLs are scoped to the test game's actual time window:

```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT
  extract(epoch from started_ts)::bigint * 1000 AS from_ms,
  extract(epoch from coalesce(ended_ts, now() + interval '1 minute'))::bigint * 1000 AS to_ms
FROM games WHERE game_code = 'GAME_CODE';
" 2>/dev/null
```

Store `FROM_MS` and `TO_MS`. Use these in all dashboard URLs below instead of `now-15m`.

Navigate to:
```
http://localhost:8889/d/tensies-live/tensies-live-games?refresh=5s&from=FROM_MS&to=TO_MS
```

Wait 3 seconds for panels to render. Take screenshot **`.playwright-mcp/t09-live-games.png`**.

Run the panel health check:
```js
() => {
  const EXPECTED_NO_DATA = new Set(['Active games', 'Round progress per player']);
  const panels = Array.from(document.querySelectorAll('[class*="panel-container"]'));
  const noData = panels.filter(p => p.textContent.includes('No data'));
  const unexpected = noData.filter(p => {
    const title = p.querySelector('h6,[class*="title"]')?.textContent?.trim() || '?';
    return !EXPECTED_NO_DATA.has(title);
  });
  const errors = panels.filter(p => p.textContent.includes('Error') && !p.textContent.includes('out: error'));
  return {
    total: panels.length,
    noData: noData.map(p => p.querySelector('h6,[class*="title"]')?.textContent?.trim() || '?'),
    unexpectedNoData: unexpected.map(p => p.querySelector('h6,[class*="title"]')?.textContent?.trim() || '?'),
    errors: errors.length,
  };
}
```

**Expected "No data" panels (not a failure):**
- `"Active games"` — queries `live_games`, which is cleared when a game ends
- `"Round progress per player"` — queries `live_players JOIN live_games`, same source

These two panels are validated with live data during the mid-game check in Step 5. Post-game they will always be empty by design.

**Pass criteria:**
- No error states
- `unexpectedNoData` is empty (any No-data panel outside the two expected ones is a FAIL)

---

## Step 10 — per-game dashboard (post-game validation)

This step does a thorough post-game validation of the enriched per-game dashboard — scoped to the game's exact time window so every panel should be fully populated.

Navigate to:
```
http://localhost:8889/d/tensies-game/tensies-per-game-drilldown?var-game_code=GAME_CODE&from=FROM_MS&to=TO_MS
```

Wait 4 seconds for panels to render. Take a **fullPage** screenshot **`.playwright-mcp/t10-per-game.png`**.

Run the panel health check:
```js
() => {
  const panels = Array.from(document.querySelectorAll('[class*="panel-container"]'));
  const noData = panels.filter(p => p.textContent.includes('No data'));
  return {
    total: panels.length,
    noData: noData.map(p => p.querySelector('h6,[class*="title"]')?.textContent?.trim() || '?')
  };
}
```

**Expected "No data" panels (not a failure):**
- `"Match progression (current round)"` — queries the current round in `live_games`; post-game it shows the empty next round
- `"Status"` and `"Round / Target"` — both query `live_games` which is cleared when a game ends; these will be empty after clean game end
- `"Current round progress"` — same `live_games` source; empty post-game

These four panels are only populated for *active* games. All other panels query `events`/`rounds` directly and must have data. Report WARN only if a panel outside this list shows No data.

**Per-panel assertions** — verify each of these panels has data by checking page text:

```js
() => {
  const text = document.body.innerText;
  return {
    stat_rounds_completed: /Rounds completed/.test(text) && !/Rounds completed\s*[-–]\s*$/.test(text),
    event_log_has_entries: (text.match(/rolled \d+\/10/g) || []).length > 0,
    rounds_table_has_rows: (text.match(/Alpha|Beta|Telemetry|Monitor/g) || []).length > 0,
    rolls_per_round_visible: /Rolls per round/.test(text),
    match_progression_all_rounds: /Match progression \(all rounds\)/.test(text),
    dice_distribution_visible: /Dice distribution/.test(text),
    player_wins_visible: /Player wins/.test(text),
  };
}
```

Cross-check stat panels against Postgres:
- "Rounds completed" stat should match `SELECT count(*) FROM rounds WHERE game_code='GAME_CODE' AND winner_user_id IS NOT NULL`
- "Total rolls" stat should match `SELECT total_rolls FROM games WHERE game_code='GAME_CODE'`

**Pass criteria:**
- `total` panels >= 8
- Only `"Match progression (current round)"` may show No data — anything else is a FAIL
- `event_log_has_entries = true` (rolled N/10 entries visible)
- `rounds_table_has_rows = true`
- Stat panel values match Postgres (within 1 roll — timing window)

---

## Step 11 — connections dashboard

Navigate to:
```
http://localhost:8889/d/tensies-conn/tensies-connections?from=FROM_MS&to=TO_MS
```

Wait 3 seconds. Take screenshot **`.playwright-mcp/t11-connections.png`**.

**Pass criteria:**
- No error states
- Connect/disconnect rate panels show the 2 connections from the test game

---

## Step 12 — gameplay-health dashboard

Navigate to:
```
http://localhost:8889/d/tensies-health/tensies-gameplay-health?from=FROM_MS&to=TO_MS
```

Wait 3 seconds. Take screenshot **`.playwright-mcp/t12-gameplay-health.png`**.

**Pass criteria:**
- No error states
- Queue depth panel has data (even if values are 0)

---

## Step 13 — analytics dashboard

Navigate to:
```
http://localhost:8889/d/tensies-analytics/tensies-player-game-analytics?from=FROM_MS&to=TO_MS
```

Wait 3 seconds. Take screenshot **`.playwright-mcp/t13-analytics.png`**.

**Pass criteria:**
- No error states
- Leaderboard or roll distribution panels have at least one data point

---

## Step 14 — Dice fairness

Query the `v_dice_roll_distribution` view (which excludes locked-on-target dice to avoid inflating the target value count):

```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT face, rolls FROM v_dice_roll_distribution ORDER BY face;
"
```

Check for bias — no face value should be more than 2× the mean:

```bash
docker compose exec -T postgres psql -U tensies tensies -c "
WITH dist AS (
  SELECT face, rolls FROM v_dice_roll_distribution
),
stats AS (
  SELECT AVG(rolls) AS mean_count FROM dist
)
SELECT
  face,
  rolls,
  ROUND(rolls::numeric / NULLIF((SELECT mean_count FROM stats), 0), 2) AS ratio_to_mean,
  CASE WHEN rolls > 2 * (SELECT mean_count FROM stats) THEN 'ANOMALY'
       WHEN rolls < 0.5 * (SELECT mean_count FROM stats) THEN 'ANOMALY'
       ELSE 'OK' END AS status
FROM dist
ORDER BY face;
"
```

If the view returns 0 rows (not enough data), try the all-time count from the events table directly:
```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT
  jsonb_array_elements_text(payload->'rolled_values') AS face,
  COUNT(*) AS count
FROM events
WHERE type = 'roll' AND game_code = 'GAME_CODE'
GROUP BY face
ORDER BY face;
"
```

**Pass criteria:**
- No face has ratio_to_mean > 2.0 or < 0.5 (report as WARN if data is sparse — fewer than 30 total rolls is too few for a meaningful fairness check; just report the distribution)
- If there is insufficient data for a meaningful check, note it as "insufficient sample size" rather than FAIL

---

## Step 15 — Timeline sanity

Check for impossible or nonsensical values across all tables:

```bash
docker compose exec -T postgres psql -U tensies tensies -c "
-- Negative durations
SELECT 'rounds negative duration' AS label, COUNT(*) AS anomalies
FROM rounds WHERE duration_ms < 0
UNION ALL
SELECT 'sessions negative duration', COUNT(*)
FROM sessions WHERE duration_ms < 0
UNION ALL
SELECT 'roll matched > 10', COUNT(*)
FROM events WHERE type='roll' AND (payload->>'matched')::int > 10
UNION ALL
SELECT 'round_started with round_num=0', COUNT(*)
FROM events WHERE type='round_started' AND round_num = 0
UNION ALL
SELECT 'roll matched < 0', COUNT(*)
FROM events WHERE type='roll' AND (payload->>'matched')::int < 0
UNION ALL
SELECT 'game ended before started', COUNT(*)
FROM games WHERE ended_ts IS NOT NULL AND ended_ts < started_ts
UNION ALL
SELECT 'round_player matched_at_end > 10', COUNT(*)
FROM round_player WHERE matched_at_end > 10
ORDER BY label;
"
```

**Pass criteria:**
- Every check returns 0 anomalies

---

## Step 16 — Telemetry self-metrics

Check the telemetry system's own health metrics:

```bash
curl -sf http://localhost:8888/metrics | grep -E "tensies_telemetry_(dropped_total|queue_depth|write_seconds)|tensies_live_push"
```

Verify:
- `tensies_telemetry_dropped_total` == `BASELINE_DROPPED` (no new drops during the test)
- `tensies_telemetry_queue_depth{subscriber="writer"}` is near 0 (backlog has drained)
- `tensies_telemetry_queue_depth{subscriber="live"}` is near 0
- `tensies_live_push_failures_total` == `BASELINE_PUSH_FAILURES` (no new failures)

Also check that the writer is processing batches (histogram should have observations):
```bash
curl -sf http://localhost:8888/metrics | grep "tensies_telemetry_batch_size_count" | awk '{print "Batches written:", $2}'
```

**Pass criteria:**
- No new drops
- No new live push failures
- Queue depths < 10 (ideally 0)
- Batch size histogram has at least 1 observation

---

## Step 17 — Grafana Live push health

Verify that the live pusher actually reached Grafana during the test game by checking for recent observations in the `tensies_live_push_seconds` histogram and that the channels are receiving data.

```bash
curl -sf http://localhost:8888/metrics | grep "tensies_live_push_seconds_count"
```

This counter increments every time the pusher fires (every ~100 ms or 200 lines). After a game with multiple rolls, it should have many observations.

Also query the Grafana Live API to confirm the tensies channels are registered:
```bash
curl -sf 'http://localhost:8889/api/live/list' -u admin:admin 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    channels = data.get('channels', []) or data.get('result', {}).get('channels', [])
    tensies = [c for c in channels if 'tensies' in str(c)]
    print(f'Tensies Live channels active: {len(tensies)}')
    for c in tensies[:5]:
        print(' ', c)
except Exception as e:
    print('Could not parse Live list:', e)
" || echo "Live channel list endpoint unavailable (normal if no active connections)"
```

**Pass criteria:**
- `tensies_live_push_seconds_count` > 0 (pusher has fired at least once)
- No new push failures since baseline

---

## Step 18 — Server log audit

```bash
docker compose logs web --since 15m 2>&1 | grep -iE "error|exception|traceback" | grep -viE "rate.?limit|INFO|DEBUG|Connection reset" | head -30
```

Check for:
- Python tracebacks
- Unhandled exceptions
- ERROR-level log entries not related to expected game events

Also check Postgres logs for query errors:
```bash
docker compose logs postgres --since 5m 2>&1 | grep -i "error\|fatal" | head -10
```

**Pass criteria:**
- No Python tracebacks
- No unexpected ERROR lines in server logs
- No fatal Postgres errors

---

## Reporting

Print a summary table. Preflights (self-update, prior-run review) are reported as a one-line note, not scored rows. The 18 numbered rows map 1:1 to Steps 1–18.

TENSIES TELEMETRY TEST RESULTS

Preflight: self-update <ran|none>, prior-run review <ran|none> (not scored)

| # | Result | Description |
|---|--------|-------------|
| 01 | ✅ PASS | Server + Prometheus health |
| 02 | ✅ PASS | Grafana health + provisioning |
| 03 | ✅ PASS | Postgres health + migrations |
| 04 | ✅ PASS | Pre-game baseline snapshot |
| 05 | ✅ PASS | Play a game (event generation) |
| 06 | ✅ PASS | Postgres event log completeness |
| 07 | ✅ PASS | Rollup table integrity |
| 08 | ✅ PASS | Prometheus delta cross-check |
| 09 | ✅ PASS | live-games dashboard (Live panels) |
| 10 | ✅ PASS | per-game dashboard (post-game validation) |
| 11 | ✅ PASS | connections dashboard |
| 12 | ✅ PASS | gameplay-health dashboard |
| 13 | ✅ PASS | analytics dashboard |
| 14 | ✅ PASS | Dice fairness |
| 15 | ✅ PASS | Timeline sanity |
| 16 | ✅ PASS | Telemetry self-metrics |
| 17 | ✅ PASS | Grafana Live push health |
| 18 | ✅ PASS | Server log audit |

18/18 passed

Replace `✅ PASS` with `❌ FAIL` or `⚠️ WARN` and append a one-line description for any issue. WARN means an anomaly was detected but is within tolerance. FAIL means a hard assertion failed.

Embed one of the Grafana screenshots inline at the end of the report.

---

## Log writing

After reporting, write a log file to `docs/test-runs/telemetry/`. Create the directory if it doesn't exist. Name the file using the current date and time: `docs/test-runs/telemetry/YYYY-MM-DDTHH-MM-SS.md`.

The log must include:

```markdown
# Telemetry test run — <date and time>

## Results
<pass/fail/warn table, same format as the report>

## Findings
<one bullet per FAIL or WARN — describe what broke or was anomalous, where to look, and whether it's newly introduced or a known recurrence>

## Pipeline measurements
<key numeric observations from this run:>
- Rolls in test game: N
- Postgres roll events: N (matches Prometheus delta: yes/no, delta: N%)
- Telemetry dropped events (new this run): N
- Live push failures (new this run): N
- Queue depth at end: writer=N, live=N
- Dice distribution: [1:N, 2:N, 3:N, 4:N, 5:N, 6:N] (max ratio: N.Nx)

## Notes
<anything interesting: timing, anomalies that were within tolerance, dashboard panel states worth watching>

## Watch next run
<steps that were borderline, flaky, newly introduced FAILs that need follow-up>
```

If all 18 tests passed and nothing notable was observed, Findings should say "None." and Notes should say "Clean run."

After writing the log, add a row for this run to the index table in `docs/test-runs/telemetry/README.md`. The row format matches the existing entries:

```
| [YYYY-MM-DDTHH:MM:SS](YYYY-MM-DDTHH-MM-SS.md) | Telemetry | ✅ PASS or ⚠️ WARN or 🔴 FAIL | <passed> | <warned> | <total> | <one-line highlight> |
```

Insert the new row at the top of the table (below the header row), so the most recent run appears first. Then output the log file path so it's visible in the report.
