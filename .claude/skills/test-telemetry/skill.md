---
name: test-telemetry
description: Full telemetry pipeline test — services health, event-to-Postgres-to-Prometheus pipeline integrity, all five Grafana dashboards (screenshots + Live panel verification), dice fairness, timeline sanity, and anomaly detection. Reports a pass/fail summary and writes a log to ./telemetry-test-logs/.
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
ls -t telemetry-test-logs/*.md 2>/dev/null | head -3
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
curl -sf http://localhost:8888/metrics | grep -E "^tensies_(rolls_total|games_started_total|games_ended_total|rounds_started_total|rounds_completed_total|sessions_started_total|telemetry_dropped_total|live_push_failures_total)[^_]" | sort
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

**Roll to win 1 round (then let the second round auto-start):**
8. Install a MutationObserver on the winner dialog (same technique as test-game Step 12):
```js
window._winCap = null;
const dlg = document.getElementById('winner-overlay');
new MutationObserver(() => {
  if (dlg.open && !window._winCap) {
    window._winCap = {
      winnerName: document.getElementById('winner-name')?.textContent.trim(),
      capturedAt: Date.now()
    };
  }
}).observe(dlg, { attributes: true, attributeFilter: ['open'] });
```

9. Roll Alpha in a loop until all 10 are matched (same loop as test-game Step 12 — click `#roll-btn`, wait for re-enable, check matched count). Time out after 120 seconds.

10. Read `window._winCap` — confirm `winnerName` contains "Telemetry".

**Let the pipeline drain:**

After the round win, wait for the second round to auto-start (up to 5 seconds), then close both game sockets to trigger `game_ended` and `session_ended` events:
```js
// Run on both instances
() => { _state.ws.close(); return 'closed'; }
```

Wait 2 seconds for the writer to drain before querying Postgres.

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
- `connection_opened` — at least 2 (one per player)
- `session_started` — exactly 2
- `game_created` — exactly 1
- `player_joined` — exactly 2
- `game_started` — exactly 1
- `round_started` — at least 1
- `roll` — at least 1 (Alpha rolled to win)
- `round_won` — at least 1
- `round_ended` — at least 1
- `connection_closed` — at least 2

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
- All 10 required event types present
- `missing_matched` = 0, `missing_dice_after` = 0
- `max_matched` <= 10 (no impossible match count)

---

## Step 7 — Rollup table integrity

Verify each rollup table was updated correctly for this game.

```bash
docker compose exec -T postgres psql -U tensies tensies -c "
-- games rollup
SELECT game_code, status, player_count, round_count, total_rolls
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
- `games.player_count == 2`
- At least one `rounds` row with `has_winner = true` and `duration_ms > 0`
- `round_player` rows exist for both `ALPHA_ID` and `BETA_ID`
- `rounds.total_rolls` matches `round_player` roll sums

Check player_stats updated for the winner:
```bash
docker compose exec -T postgres psql -U tensies tensies -c "
SELECT user_id, total_rolls, total_wins
FROM player_stats
WHERE user_id IN ('ALPHA_ID')
ORDER BY user_id;
"
```

**Pass criteria:**
- `games.player_count = 2`
- At least one round with a set `winner_user_id` and positive `duration_ms`
- `round_player` has at least one row in round 1 (for the player who rolled; guests who never roll won't have a row — that is expected)
- `player_stats.total_wins >= 1` for Alpha

---

## Step 8 — Prometheus delta cross-check

Read the current Prometheus counters and compare the delta against the Postgres event counts for the test game.

```bash
curl -sf http://localhost:8888/metrics | grep -E "^tensies_(rolls_total|games_started_total|games_ended_total|rounds_started_total|sessions_started_total|telemetry_dropped_total|live_push_failures_total)[^_]" | sort
```

Compute deltas vs baseline (Step 4). Then compare:

| Metric delta | Expected | Source |
|---|---|---|
| `tensies_rolls_total` delta | = Postgres `COUNT(*)` WHERE `type='roll' AND game_code=GAME_CODE` | 5% tolerance |
| `tensies_games_started_total` delta | = 1 | exact |
| `tensies_sessions_started_total` delta | = 2 (two players) | exact (+ any other players on the server) |
| `tensies_rounds_started_total{target=...}` delta | >= 1 | exact |

**5% tolerance rule:** if `abs(prometheus_count - postgres_count) / postgres_count > 0.05` and the absolute difference > 2, flag as FAIL. An absolute difference of 1–2 on a count of 1–5 is acceptable (timing window).

Also verify no new drops or push failures occurred:
```bash
DROPS_NOW=$(curl -sf http://localhost:8888/metrics | grep "^tensies_telemetry_dropped_total " | awk '{print $2}')
FAILS_NOW=$(curl -sf http://localhost:8888/metrics | grep "^tensies_live_push_failures_total " | awk '{print $2}')
# Compare to BASELINE_DROPPED and BASELINE_PUSH_FAILURES
```

**Pass criteria:**
- `rolls_total` delta within 5% of Postgres roll count
- `games_started_total` delta == 1
- `sessions_started_total` delta >= 2
- `tensies_telemetry_dropped_total` unchanged since baseline
- `tensies_live_push_failures_total` unchanged since baseline

---

## Step 9 — live-games dashboard (Live panel verification)

The `live-games` dashboard is the default home. Navigate the Grafana inspector instance to it immediately after the game — the Grafana Live channels (`stream/tensies/rolls`, `stream/tensies/wins`, `stream/tensies/games`) should have recent data.

Navigate to:
```
http://localhost:8889/d/tensies-live/tensies-live-games?refresh=5s&from=now-15m&to=now
```

Wait 3 seconds for panels to render.

Take screenshot **`.playwright-mcp/t09-live-games.png`**.

Check for "No data" or error states — run a snapshot and look for:
```js
() => {
  const panels = Array.from(document.querySelectorAll('[class*="panel-container"]'));
  const noData = panels.filter(p => p.textContent.includes('No data'));
  const errors = panels.filter(p => p.textContent.includes('Error') || p.textContent.includes('error'));
  return { total: panels.length, noData: noData.length, errors: errors.length };
}
```

Verify the Live roll firehose panel shows recent data. Look for panel content that includes a "Rolls" table or a live stream display with a timestamp within the last 5 minutes.

**Pass criteria:**
- All panels render (no error states)
- `noData` count is 0 (after a game was just played, all panels should have data)
- At least one panel showing roll or win data from the test game (visible in screenshot)

---

## Step 10 — per-game dashboard

Navigate to the per-game dashboard with the test game code as the variable:

```
http://localhost:8889/d/tensies-game/tensies-per-game-drilldown?var-game_code=GAME_CODE&from=now-1h&to=now
```

Wait 3 seconds for panels to render. Take screenshot **`.playwright-mcp/t10-per-game.png`**.

Check for "No data" / error states using the same evaluate as Step 9.

**Pass criteria:**
- Panels load for the specific game code
- No error states
- Round timeline panels show data (not empty)

---

## Step 11 — connections dashboard

Navigate to:
```
http://localhost:8889/d/tensies-conn/tensies-connections?from=now-15m&to=now
```

Wait 3 seconds. Take screenshot **`.playwright-mcp/t11-connections.png`**.

**Pass criteria:**
- No error states
- Connect/disconnect rate panels show the 2 connections from the test game
- Live session table is visible (may be empty if game ended, which is correct)

---

## Step 12 — gameplay-health dashboard

Navigate to:
```
http://localhost:8889/d/tensies-health/tensies-gameplay-health?from=now-15m&to=now
```

Wait 3 seconds. Take screenshot **`.playwright-mcp/t12-gameplay-health.png`**.

Pay particular attention to:
- Telemetry queue depths panel — should show values near 0
- Postgres cache hit ratio — should be > 90%
- WS send latency p99 panel — should be visible and reasonable

**Pass criteria:**
- No error states
- Queue depth panel has data (even if values are 0)

---

## Step 13 — analytics dashboard

Navigate to:
```
http://localhost:8889/d/tensies-analytics/tensies-player-game-analytics?from=now-24h&to=now
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

```
TENSIES TELEMETRY TEST RESULTS
================================
Preflight: self-update <ran|none>, prior-run review <ran|none> (not scored)
 PASS  01  Server + Prometheus health
 PASS  02  Grafana health + provisioning
 PASS  03  Postgres health + migrations
 PASS  04  Pre-game baseline snapshot
 PASS  05  Play a game (event generation)
 PASS  06  Postgres event log completeness
 PASS  07  Rollup table integrity
 PASS  08  Prometheus delta cross-check
 PASS  09  live-games dashboard (Live panels)
 PASS  10  per-game dashboard
 PASS  11  connections dashboard
 PASS  12  gameplay-health dashboard
 PASS  13  analytics dashboard
 PASS  14  Dice fairness
 PASS  15  Timeline sanity
 PASS  16  Telemetry self-metrics
 PASS  17  Grafana Live push health
 PASS  18  Server log audit
================================
18/18 passed
```

Replace `PASS` with `FAIL` or `WARN` and append a one-line description for any issue. WARN means an anomaly was detected but is within tolerance. FAIL means a hard assertion failed.

Embed one of the Grafana screenshots inline at the end of the report.

---

## Log writing

After reporting, write a log file to `telemetry-test-logs/` in the project root. Create the directory if it doesn't exist (`mkdir -p telemetry-test-logs`). Name the file using the current date and time: `telemetry-test-logs/YYYY-MM-DDTHH-MM-SS.md`.

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

After writing the log, output the file path so it's visible in the report.
