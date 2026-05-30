# Telemetry Test Runs

Integration test logs from the `test-telemetry` skill. Each run exercises the full
telemetry pipeline: services health, event-to-Postgres-to-Prometheus integrity, all
five Grafana dashboards, dice fairness, timeline sanity, and anomaly detection.

## Index

| Date | Scope | Result | Passed | Warned | Total | Highlight |
|------|-------|--------|--------|--------|-------|-----------|
| [2026-05-30T18:03:09](2026-05-30T18-03-09.md) | Telemetry | ✅ PASS | 18 | 0 | 18 | First 18/18 clean run; Step 9 WARN eliminated — "Active games"/"Round progress" query live_games (cleared on end), now asserted live during game in Step 5 instead |
| [2026-05-30T17:49:44](2026-05-30T17-49-44.md) | Telemetry | ⚠️ WARN | 17 | 1 | 18 | Clean run; only WARN is expected live-games No-data (3rd recurrence); 0% roll delta, 0 drops |
| [2026-05-30T16:15:00](2026-05-30T16-15-00.md) | Telemetry | ⚠️ WARN | 15 | 3 | 18 | Known WARNs recur (player_count=0, live-games No data); pre-existing game contaminated games_ended delta |
| [2026-05-29T19:08:00](2026-05-29T19-08-00.md) | Telemetry | ⚠️ WARN | 15 | 3 | 18 | player_count=0 on clean end (skill criterion updated); live-games No-data panels identified; test-query Postgres error |
| [2026-05-29T17:05:00](2026-05-29T17-05-00.md) | Telemetry | ⚠️ WARN | 17 | 1 | 18 | First run; per-game "Status"/"Round / Target" panels No data (live\_games query mismatch) |
