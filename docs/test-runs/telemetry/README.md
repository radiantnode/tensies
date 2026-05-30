# Telemetry Test Runs

Integration test logs from the `test-telemetry` skill. Each run exercises the full
telemetry pipeline: services health, event-to-Postgres-to-Prometheus integrity, all
five Grafana dashboards, dice fairness, timeline sanity, and anomaly detection.

## Index

| Date | Scope | Result | Passed | Warned | Total | Highlight |
|------|-------|--------|--------|--------|-------|-----------|
| [2026-05-30T16:15:00](2026-05-30T16-15-00.md) | Telemetry | ⚠️ WARN | 15 | 3 | 18 | Known WARNs recur (player_count=0, live-games No data); pre-existing game contaminated games_ended delta |
| [2026-05-29T19:08:00](2026-05-29T19-08-00.md) | Telemetry | ⚠️ WARN | 15 | 3 | 18 | player_count=0 on clean end (skill criterion updated); live-games No-data panels identified; test-query Postgres error |
| [2026-05-29T17:05:00](2026-05-29T17-05-00.md) | Telemetry | ⚠️ WARN | 17 | 1 | 18 | First run; per-game "Status"/"Round / Target" panels No data (live\_games query mismatch) |
