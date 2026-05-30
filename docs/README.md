# Docs

## Reference

| Document | Description |
|----------|-------------|
| [Feedback](feedback/README.md) | External code review transcripts — verified second opinions, implementation decisions, and open item tracking |
| [Telemetry](TELEMETRY.md) | Telemetry architecture — event flow, Postgres schema, Prometheus metrics, Grafana Live channels, and how to extend them |

## Test runs

| Suite | Description |
|-------|-------------|
| [Game](test-runs/game/README.md) | Integration test logs from the `test-game` skill — full gameplay loop, multiplayer sync, reconnect, pause, animation integrity |
| [Telemetry](test-runs/telemetry/README.md) | Pipeline test logs from the `test-telemetry` skill — services health, event→Postgres→Prometheus integrity, Grafana dashboards, dice fairness |
