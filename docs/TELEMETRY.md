# Telemetry

Tensies records every meaningful game event to Postgres, exposes a wide set of Prometheus metrics, and pushes selected events to Grafana Live for sub-second dashboards. This document covers how the pieces fit together and how to extend them.

The roll handler is the hot path. Nothing in the telemetry stack ever blocks it — `telemetry.emit()` is sync and just appends to an in-process queue. Background tasks drain the queue.

---

## Quickstart

```bash
docker compose up -d        # web + postgres + prometheus + grafana + postgres_exporter
docker compose logs -f web  # follow app logs
```

| URL | What |
|---|---|
| http://localhost:8888 | The game itself |
| http://localhost:8888/metrics | Prometheus scrape target (also the easiest sanity check) |
| http://localhost:8889 | Grafana — anonymous, lands on the **Tensies — Live Games** dashboard |
| http://localhost:9090 | Prometheus UI |
| localhost:5432 | Postgres (`tensies`/`tensies`/`tensies`) |

Stats endpoints (return JSON):

```
GET /stats/leaderboard?limit=25
GET /stats/player/{user_id}
GET /stats/game/{game_code}
```

Public game-audit endpoint (no auth — see [Game audit](#game-audit)):

```
GET /api/games/{code}/audit            # JSON report (default)
GET /api/games/{code}/audit?format=text     # human-readable
GET /api/games/{code}/audit?format=markdown
```

> Note: web and Grafana are on non-default ports (8888 / 8889) to coexist with other local projects. The container-internal ports (8000 / 3000) are unchanged — only the host bindings differ. Override in the `ports` section of `docker-compose.yml`.

---

## Architecture

```
   FastAPI app  ──┬── emit() ─► asyncio.Queue (one per subscriber)
                  │
                  ├── prometheus_client (counters/gauges/histograms)
                  └── /metrics (scraped by Prometheus every 2s)
                                                   │
   ┌──────────────┼────────────────────────────────┘
   │              │
   ▼              ▼
 writer task   live pusher task
   │              │
   │              └─► HTTP POST → Grafana /api/live/push/tensies
   │                                       │
   ▼                                       ▼ (websocket fan-out)
 Postgres                              Grafana panels
   ▲                                       ▲
   └───────────── SQL queries ─────────────┘
```

### Why two consumers

- **Postgres** is the durable source of truth — events, rollups, history, replay.
- **Grafana Live** is the push transport that makes panels react instantly without polling. The data also lands in Postgres; Live is just a faster pipe to the browser.

Each consumer owns its own bounded queue. If one falls behind, the other is unaffected; on overflow the oldest event is dropped and counted (`tensies_telemetry_dropped_total`).

### Why we don't await on the WS path

`telemetry.emit()` is a plain function — it pushes onto `asyncio.Queue` objects and returns. No I/O, no awaits. `prometheus_client` increments are lock-free atomics. The roll handler in `server/ws.py` calls both freely; latency stays where it was before telemetry existed.

### Send concurrency

The pinger task and the receive-loop handler both write to the same WebSocket. To prevent interleaved frames, every outbound message goes through `server.broadcast.send()`, which acquires a per-session `asyncio.Lock` before calling `ws.send_text`. The lock lives on the `Session` object.

---

## Components

### `server/telemetry/bus.py`
The pub/sub bus. `bus.subscribe(maxsize=…)` returns a fresh `asyncio.Queue`. `bus.emit(type, **payload)` puts an event onto every subscriber's queue, dropping the oldest on overflow (and counting the drop).

### `server/telemetry/metrics.py`
All Prometheus metric objects. Single import site — `from server.telemetry import metrics`. See the full list below.

### `server/telemetry/store.py`
`asyncpg` pool, the migration runner (reads `migrations/*.sql` in order, idempotent via `schema_migrations`), and `ensure_partitions()` for the monthly events partitions.

### `server/telemetry/writer.py`
The Postgres writer task. Drains its queue in batches of up to 500 events or 250 ms, inserts into `events`, and runs the per-event rollup handlers (`_h_roll`, `_h_round_won`, …) in the same transaction so dashboards always see consistent state.

### `server/telemetry/live.py`
The Grafana Live pusher. Subscribes to the bus, translates selected events into InfluxDB line protocol, and POSTs to `http://grafana:3000/api/live/push/tensies` every ~100 ms (or when 200 lines accumulate). Dashboards subscribe to `stream/tensies/<measurement>`.

### `server/telemetry/pinger.py`
One per WebSocket, created when the `Session` is constructed. Sends `{"type":"ping","t":<monotonic>}` every 5 s; the client echoes back as `{"action":"pong","t":<same>}`; the WS handler routes it to `pinger.record_pong()` which records RTT into Prometheus and emits a `ws_ping` event.

### `server/telemetry/lifecycle.py`
FastAPI lifespan handler. Starts everything (pool → migrations → writer → live pusher → queue-depth gauge → partition cron) and shuts them down in reverse on exit.

---

## Event taxonomy

Every event is one row in `events(id, ts, game_code, round_num, user_id, session_id, type, seq, payload JSONB)`. Top-level columns are extracted from the emit kwargs for fast indexed lookup; everything else goes into `payload`.

| Type | Emitted from | Key payload fields |
|---|---|---|
| `connection_opened` | `server/ws.py` WS accept | `session_id`, `peer`, `user_agent` |
| `connection_closed` | `server/ws.py` finally | `reason`, `duration_ms`, `messages_in/out`, `bytes_in/out` |
| `session_started` | first `create`/`join`/`reconnect` on a WS | `session_id`, `user_id`, `name` |
| `session_ended` | WS disconnect (only if a session started) | `duration_ms`, `reason`, `rolls`, `games_joined` |
| `reconnected` | `handle_reconnect` succeeds | `user_id`, `name` |
| `ws_ping` | `Pinger.record_pong` | `rtt_ms` |
| `ack_timeout` | `server/broadcast.delayed_broadcast` | `wait_ms` |
| `rate_limited` | `handle_roll` `MIN_ROLL_INTERVAL` rejection | `dt_ms` |
| `game_created` | `handle_create` (after `new_game`) | `user_id` (host) |
| `player_joined` | `handle_create`, `handle_join` | `name`, `player_count` |
| `player_left` | WS disconnect / 30s grace timeout | `reason` (`disconnect`\|`drop`), `player_count` |
| `host_transferred` | `drop_player` when host drops | `from`, `to` |
| `game_started` | `handle_start` | `target`, `player_count` |
| `game_ended` | `drop_player` last-player branch | `reason`, `duration_ms`, `round_count`, `total_rolls` |
| `round_started` | `handle_start` + `delayed_broadcast` (post-win) | `round_num`, `target` |
| `round_ended` | `delayed_broadcast` (just before advancing) | `round_num`, `target` |
| `roll` | `handle_roll` | `target`, `matched`, `newly_locked[]`, `rolled_values[]`, `dice_before[]`, `dice_after[]`, `locked_before[]`, `locked_after[]`, `dt_ms`, `round_roll_num`, `seq` |
| `round_won` | `handle_roll` matched == 10 | `roll_count`, `duration_ms`, `final_dice[]`, `target` |

Roll events keep the full dice state on each row. At realistic load (~2 KB/sec per active game) this is cheap and gives us replay + new metrics for free; see [Replayability](#replayability).

---

## Database schema

Append-only log:

| Table | Purpose |
|---|---|
| `events` | The firehose. Partitioned by month (`events_YYYY_MM`). Retained forever per project policy. |
| `schema_migrations` | Migration tracking. Don't touch. |

Rollups — upserted by the writer in the same transaction as the event insert:

| Table | Updated by |
|---|---|
| `games` | game_created, game_started, game_ended, player_joined (peak), host_transferred |
| `rounds` | round_started, round_won (winner/duration), roll (rolls counter) |
| `round_player` | every `roll` — per-player per-round breakdown including avg/fastest/slowest dt |
| `player_stats` | session_started, session_ended, reconnected, roll, round_won. **The lifetime stats per user.** |
| `sessions` | session_started, session_ended |
| `connections` | connection_opened, connection_closed, ws_ping |

Live tables — what the dashboards mostly query. One row per **active** thing, deleted when the entity ends:

| Table | Updated by |
|---|---|
| `live_games` | game_created → game_ended. Tracks current round, leader, last_roll_ts, rolls_this_round. |
| `live_players` | player_joined → game_ended (or drop). Tracks matched, rolls_this_round, wins. |
| `live_sessions` | connection_opened → connection_closed. Tracks last_ping_rtt_ms, current game_code. |

Helper views (`migrations/002_helpers.sql`):

- `v_dice_roll_distribution` — face counts over the last hour, **only newly-rolled dice** (so locked-on-target dice don't inflate the count of the target value)
- `v_recent_rolls` — per-game rolls per second over the last 5 minutes
- `v_game_roll_timeline` — flattened `(ts, seq, user_id, matched)` for round-timeline panels

### Partitioning

`events` is range-partitioned by `ts` per month. The 001 migration bootstraps the current and next month's partitions. The `_partition_loop` task in `lifecycle.py` re-runs `store.ensure_partitions()` every 6 hours so we never roll into a month with no partition. Both code paths are idempotent.

---

## Prometheus metrics

All metrics are prefixed `tensies_`. Buckets are tuned to the game's dynamics — see `server/telemetry/metrics.py` for the exact values.

**Connections / sessions**
| Metric | Type | Labels |
|---|---|---|
| `ws_connections_active` | Gauge | — |
| `ws_connects_total` | Counter | — |
| `ws_disconnects_total` | Counter | `reason` (`client`/`error`) |
| `ws_connection_seconds` | Histogram | — |
| `ws_ping_rtt_seconds` | Histogram | — |
| `ws_messages_in_total` | Counter | `action` |
| `ws_messages_out_total` | Counter | `type` |
| `ws_bytes_in_total` | Counter | — |
| `ws_bytes_out_total` | Counter | — |
| `ws_send_seconds` | Histogram | `type` |
| `ws_message_size_bytes` | Histogram | — |
| `reconnects_total` | Counter | — |
| `sessions_started_total` | Counter | — |

**Games / rounds**
| Metric | Type | Labels |
|---|---|---|
| `games_active` | Gauge | — |
| `games_started_total` | Counter | — |
| `games_ended_total` | Counter | `reason` |
| `rounds_started_total` | Counter | `target` |
| `rounds_completed_total` | Counter | `target` |
| `round_duration_seconds` | Histogram | — |
| `rolls_per_round` | Histogram | — |
| `round_winner_rolls` | Histogram | — |
| `players_per_game` | Histogram | — |
| `game_duration_seconds` | Histogram | — |

**Rolls / dice**
| Metric | Type | Labels |
|---|---|---|
| `rolls_total` | Counter | — |
| `dice_value_total` | Counter | `value` (1–6) |
| `matches_per_roll` | Histogram | — |
| `time_between_rolls_seconds` | Histogram | — |
| `rate_limits_total` | Counter | — |
| `ack_timeouts_total` | Counter | — |

**Telemetry self-observability**
| Metric | Type | Labels |
|---|---|---|
| `telemetry_queue_depth` | Gauge | `subscriber` (`writer`/`live`) |
| `telemetry_batch_size` | Histogram | — |
| `telemetry_write_seconds` | Histogram | — |
| `telemetry_dropped_total` | Counter | — |
| `live_push_seconds` | Histogram | `channel` |
| `live_push_failures_total` | Counter | — |

---

## Grafana Live channels

The live pusher subscribes to the bus and POSTs InfluxDB line protocol to `http://grafana:3000/api/live/push/tensies` with HTTP basic auth (`admin`/`admin` — fine for localhost, swap to a service-account token if you host this anywhere reachable).

| Channel | Pushed when | Tags | Fields |
|---|---|---|---|
| `stream/tensies/rolls` | every `roll` | `game`, `player`, `user` | `matched`, `target`, `dt_ms`, `round_roll_num`, `round_num` |
| `stream/tensies/wins` | `round_won` | `game`, `player`, `user` | `rolls`, `duration_ms`, `target`, `round_num` |
| `stream/tensies/games` | game/player lifecycle | `game`, `event` | `player_count`, `round_num`, `name` |
| `stream/tensies/connections` | connection open/close | `event`, `session` (short) | `duration_ms`, `messages_in/out`, `bytes_in/out` |
| `stream/tensies/pings` | every ping pong | `session` (short) | `rtt_ms` |

Panels query these via the built-in **Grafana** datasource with `queryType: "measurements"` and `channel: "stream/tensies/<name>"`.

---

## Dashboards

Provisioned from `ops/grafana/dashboards/`. Editable in the UI; changes don't persist across container rebuild unless you re-export the JSON.

| File | Audience | Purpose |
|---|---|---|
| `live-games.json` | everyone (default home) | Headline view: active games table, round progress bargauges, live roll firehose, winners ticker, roll rate, dice fairness |
| `per-game.json` | curiosity / debug | Templated by `$game_code`. Per-round timeline, match progression, raw event log, per-player breakdowns |
| `connections.json` | ops | Connect/disconnect rates, ping RTT heatmap, disconnect reasons pie, message throughput, bandwidth, live session table |
| `gameplay-health.json` | ops | WS send latency p50/p95/p99, telemetry queue depths, batch sizes/latency, Postgres backends, cache hit ratio |
| `analytics.json` | curiosity | Leaderboards, distribution histograms (rolls/round, round duration, session duration), activity over time, dice fairness all-time |

---

## Extending it

### Add a new event type

1. `from server.telemetry import emit` and call `emit("my_event", game_code=…, user_id=…, **payload)` at the call site.
2. If you want rollups (a counter, an aggregate column, anything beyond the raw row), add a handler in `server/telemetry/writer.py`:
   ```python
   async def _h_my_event(con, ev):
       await con.execute("UPDATE … WHERE …", …)
   _HANDLERS["my_event"] = _h_my_event
   ```
3. If you want it pushed to Grafana Live, add a branch in `server/telemetry/live._maybe_add()`.
4. Done. Events land in `events` automatically. Existing dashboards keep working.

### Add a new metric

1. Define it in `server/telemetry/metrics.py` (`Counter` / `Gauge` / `Histogram` with appropriate buckets).
2. Call `.inc()` / `.set()` / `.observe()` at the call site.
3. Add a panel to a dashboard that queries it.

Labels should be low cardinality — never put `user_id` or `game_code` on a Prometheus label. Use the events table for high-cardinality slicing.

### Add a panel

Edit one of the dashboard JSONs and re-deploy. Three query styles to know:

**Postgres (historical/live tables):**
```json
{
  "datasource": {"type": "postgres", "uid": "postgres"},
  "format": "table",
  "rawQuery": true,
  "rawSql": "SELECT … FROM live_games WHERE …"
}
```

**Grafana Live (push):**
```json
{
  "datasource": {"type": "grafana", "uid": "-- Grafana --"},
  "queryType": "measurements",
  "channel": "stream/tensies/rolls",
  "filter": {"fields": ["matched", "target"]}
}
```

**Prometheus:**
```json
{
  "datasource": {"type": "prometheus", "uid": "prometheus"},
  "expr": "rate(tensies_rolls_total[10s])"
}
```

### Add a new dashboard

Drop a JSON file into `ops/grafana/dashboards/`. The provisioning provider in `ops/grafana/provisioning/dashboards/dashboards.yaml` picks it up within 10 s; no Grafana restart needed.

---

## Operations

### Queue overflow

If `tensies_telemetry_queue_depth{subscriber="writer"}` climbs and `tensies_telemetry_dropped_total` starts incrementing, the Postgres writer is the bottleneck. Look at:

- `tensies_telemetry_write_seconds` — is the per-batch insert slow?
- Postgres `pg_stat_activity` — is something blocking?
- `tensies_telemetry_batch_size` — are batches small (writer is starving) or huge (writer can't keep up)?

Tunables live in `server/telemetry/writer.py`: `BATCH_MAX`, `BATCH_INTERVAL_S`, and the queue size in `start()`.

### Grafana Live push failing

`tensies_live_push_failures_total` should stay at 0. If not:

- 401 → basic auth wrong. Check `GRAFANA_USER`/`GRAFANA_PASS` in `docker-compose.yml`. We log the first 200 chars of non-401 errors at WARNING.
- 404 → Grafana's Live feature is disabled. Confirm `GF_LIVE_ALLOWED_ORIGINS` is set in the compose file.

Dashboards getting Postgres data fine but Live panels empty is almost always anonymous-role permissions. Anonymous Viewer can subscribe to channels by default; if you've locked down `[live]` rules, anonymous needs read permission on `stream/tensies/*`.

### Adding a partition manually

Should never be necessary — `ensure_partitions()` runs every 6 hours and on startup. If you need to do it by hand:

```sql
CREATE TABLE events_2026_07 PARTITION OF events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

### Retention

Project policy is "retain forever." Nothing prunes. If that ever changes, add a job that `DROP`s the oldest `events_YYYY_MM` partition; the rollup tables don't reference it so the drop is fast and non-blocking.

---

## Replayability

Roll events carry `dice_before`, `dice_after`, `locked_before`, `locked_after`, and a per-game-round `seq`. Reconstructing any game is a single SQL query:

```sql
SELECT seq, ts, type, user_id, payload
  FROM events
 WHERE game_code = 'ABCDE'
 ORDER BY ts, seq;
```

Replay this stream into the client renderer components in `static/js/components/` and the round plays back frame-by-frame. The UI for that doesn't exist yet — the data does.

---

## Game audit

Because every roll is recorded with its full before/after dice + lock state
(see [Replayability](#replayability)), any finished or in-progress game can be
**independently verified** from the event log — no trust in the live server
required. `server/audit.py` is the engine; it reconstructs every roll and checks
three things:

- **Accuracy (the rules).** Each roll is re-derived from its own recorded
  `dice_before` + `target`: locked dice never re-roll or unlock, every unlocked
  die is freshly drawn, auto-lock fires *exactly* on a target match, and
  `matched` / `newly_locked` / `round_roll_num` / the per-round `seq` all
  reconstruct. Each player's `dice_before` is chained to their previous
  `dice_after`, proving the server never altered a board between rolls.
- **Realism.** Every inter-roll `dt_ms` respects the 250 ms server rate limit (a
  faster roll is impossible through the normal path → injected/tampered data),
  the win flag (`matched == 10`) lines up with the emitted `round_won`, there is
  one winner per round (the first to ten by `seq`), and the target cycles
  1→2→…→6→1.
- **Fairness.** A chi-square goodness-of-fit test of newly-rolled faces against
  uniform 1/6 (overall *and* per player — only `rolled_values`, so dice locked
  on target don't inflate the target face), plus a per-player target-match-rate
  test, so no participant can be statistically advantaged. The stats are pure
  Python (no numpy/scipy); p-values are exact against textbook critical values.

The report ends in a **PASS/FAIL verdict** (FAIL only on a rule/timing/winner
violation; fairness anomalies are WARN — a single statistical flag is expected
by chance and is not proof of bias).

### HTTP API (public, read-only)

```
GET /api/games/{code}/audit?alpha=0.01&format=json|text|markdown
```

Unauthenticated by design — the point is that *anyone* with a game code can
verify the game was fair. It reads only the append-only `events` log (never live
state) and redacts raw player IDs to 8-char prefixes. `alpha` tunes the fairness
significance threshold (default 0.01, clamped to [1e-6, 0.5]). 404 if the code
has no recorded events; 503 if telemetry is disabled.

```bash
curl -s "https://tensies.app/api/games/ABCDE/audit?format=text"
```

### CLI (ops)

The same engine backs a script for forensic/offline use; it connects straight to
Postgres (`$POSTGRES_DSN`) so it works even with the app down:

```bash
docker compose exec web python scripts/audit_game.py ABCDE          # text report
docker compose exec web python scripts/audit_game.py ABCDE --json    # machine-readable
docker compose exec web python scripts/audit_game.py ABCDE --markdown report.md
```

Exit status: 0 PASS, 1 if any ERROR-level finding, 2 on usage/connection error.

## Deferred

- **Achievement engine.** Every event needed to back arbitrary criteria is already recorded. When we add the engine, it reads from `player_stats` + the event log; no instrumentation work needed.
- **Replay viewer UI.** Data is ready; client work pending.
- **Auth on Grafana.** Anonymous read-only by current decision.
- **Retention pruning.** "Retain forever."
- **Multi-host deployment.** Single-node docker-compose is the assumed topology.
