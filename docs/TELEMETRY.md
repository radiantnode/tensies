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
| http://localhost:8000 | The game itself |
| http://localhost:8000/metrics | Prometheus scrape target (also the easiest sanity check) |
| http://localhost:3000 | Grafana — anonymous, lands on the **Tensies — Live Games** dashboard |
| http://localhost:9090 | Prometheus UI |
| http://localhost:5432 | Postgres (`tensies`/`tensies`/`tensies`) |

Stats endpoints (return JSON):

```
GET /stats/leaderboard?limit=25
GET /stats/player/{user_id}
GET /stats/game/{game_code}
```

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

`telemetry.emit()` is a plain function — it pushes onto `asyncio.Queue` objects and returns. No I/O, no awaits. `prometheus_client` increments are lock-free atomics. The roll handler in `main.py` calls both freely; latency stays where it was before telemetry existed.

---

## Components

### `telemetry/bus.py`
The pub/sub bus. `bus.subscribe(maxsize=…)` returns a fresh `asyncio.Queue`. `bus.emit(type, **payload)` puts an event onto every subscriber's queue, dropping the oldest on overflow (and counting the drop).

### `telemetry/metrics.py`
All Prometheus metric objects. Single import site — `from telemetry import metrics`. See the full list below.

### `telemetry/store.py`
`asyncpg` pool, the migration runner (reads `migrations/*.sql` in order, idempotent via `schema_migrations`), and `ensure_partitions()` for the monthly events partitions.

### `telemetry/writer.py`
The Postgres writer task. Drains its queue in batches of up to 500 events or 250 ms, inserts into `events`, and runs the per-event rollup handlers (`_h_roll`, `_h_round_won`, …) in the same transaction so dashboards always see consistent state.

### `telemetry/live.py`
The Grafana Live pusher. Subscribes to the bus, translates selected events into InfluxDB line protocol, and POSTs to `http://grafana:3000/api/live/push/tensies` every ~100 ms (or when 200 lines accumulate). Dashboards subscribe to `stream/tensies/<measurement>`.

### `telemetry/pinger.py`
One per WebSocket. Sends `{"type":"ping","t":<monotonic>}` every 5 s; the client echoes back as `{"action":"pong","t":<same>}`; the handler records RTT into Prometheus and an event.

### `telemetry/lifecycle.py`
FastAPI lifespan handler. Starts everything (pool → migrations → writer → live pusher → queue-depth gauge → partition cron) and shuts them down in reverse on exit.

---

## Event taxonomy

Every event is one row in `events(id, ts, game_code, round_num, user_id, session_id, type, seq, payload JSONB)`. Top-level columns are extracted from the emit kwargs for fast indexed lookup; everything else goes into `payload`.

| Type | Triggered by | Key payload fields |
|---|---|---|
| `connection_opened` | WS accept | `session_id`, `peer`, `user_agent` |
| `connection_closed` | WS disconnect | `reason`, `duration_ms`, `messages_in/out`, `bytes_in/out` |
| `session_started` | first `create`/`join`/`reconnect` on a WS | `session_id`, `user_id`, `name` |
| `session_ended` | WS disconnect (only if a session started) | `duration_ms`, `reason`, `rolls`, `games_joined` |
| `reconnected` | `action=reconnect` succeeds | `user_id`, `name` |
| `ws_ping` | pinger receives pong | `rtt_ms` |
| `ack_timeout` | `delayed_broadcast` reveal-ack wait expired | `wait_ms` |
| `rate_limited` | `MIN_ROLL_INTERVAL` rejection | `dt_ms` |
| `game_created` | `new_game()` | `user_id` (host) |
| `player_joined` | `action=join` or `create` | `name`, `player_count` |
| `player_left` | WS disconnect / 30s grace timeout | `reason` (`disconnect`\|`drop`), `player_count` |
| `host_transferred` | drop of host | `from`, `to` |
| `game_started` | host clicks Start | `target`, `player_count` |
| `game_ended` | last player dropped after grace | `reason`, `duration_ms`, `round_count`, `total_rolls` |
| `round_started` | game_started + after every win | `round_num`, `target` |
| `round_ended` | 3s after round_won, before reset | `round_num`, `target` |
| `roll` | every `action=roll` | `target`, `matched`, `new_matches`, `newly_locked[]`, `rolled_values[]`, `dice_before[]`, `dice_after[]`, `locked_before[]`, `locked_after[]`, `dt_ms`, `round_roll_num`, `seq` |
| `round_won` | matched == 10 | `roll_count`, `duration_ms`, `final_dice[]`, `target` |

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

All metrics are prefixed `tensies_`. Buckets are tuned to the game's dynamics — see `telemetry/metrics.py` for the exact values.

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

1. `telemetry.emit("my_event", game_code=…, user_id=…, **payload)` at the call site.
2. If you want rollups (a counter, an aggregate column, anything beyond the raw row), add a handler in `telemetry/writer.py`:
   ```python
   async def _h_my_event(con, ev):
       await con.execute("UPDATE … WHERE …", …)
   _HANDLERS["my_event"] = _h_my_event
   ```
3. If you want it pushed to Grafana Live, add a branch in `telemetry/live._maybe_add()`.
4. Done. Events land in `events` automatically. Existing dashboards keep working.

### Add a new metric

1. Define it in `telemetry/metrics.py` (`Counter` / `Gauge` / `Histogram` with appropriate buckets).
2. Call `.inc()` / `.set()` / `.observe()` at the call site.
3. Add a panel to a dashboard that queries it.

Labels should be low cardinality — never put `user_id` or `game_code` on a Prometheus label. Use the events table for high-cardinality slicing.

### Add a panel

Edit one of the dashboard JSONs and re-deploy. Two query styles to know:

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

Tunables live in `telemetry/writer.py`: `BATCH_MAX`, `BATCH_INTERVAL_S`, and the queue size in `start()`.

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

Replay this stream into the existing `static/game.js` renderer and the round plays back frame-by-frame. The UI for that doesn't exist yet — the data does.

---

## Deferred

- **Achievement engine.** Every event needed to back arbitrary criteria is already recorded. When we add the engine, it reads from `player_stats` + the event log; no instrumentation work needed.
- **Replay viewer UI.** Data is ready; client work pending.
- **Auth on Grafana.** Anonymous read-only by current decision.
- **Retention pruning.** "Retain forever."
- **Multi-host deployment.** Single-node docker-compose is the assumed topology.
