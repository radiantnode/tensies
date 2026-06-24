# Docs

## Reference

| Document | Description |
|----------|-------------|
| [Feedback](feedback/README.md) | External code review transcripts — verified second opinions, implementation decisions, and open item tracking |
| [Asset Pipeline](ASSET_PIPELINE.md) | Prod build pipeline — esbuild bundle/minify, asset fingerprinting, pre-compression, and before/after benchmarks |
| [PWA Install](PWA_INSTALL.md) | Installable PWA — the standalone/full-screen plumbing (manifest, meta tags, safe-area layout) and the "Add to Home Screen" install UX (banner, animated walkthrough, native prompt) |
| [Telemetry](TELEMETRY.md) | Telemetry architecture — event flow, Postgres schema, Prometheus metrics, Grafana Live channels, and how to extend them |
| [Roll Trust](ROLL_TRUST.md) | Verifiable randomness — drand beacon integration, roll verification |
| [Discord](DISCORD.md) | Discord bot integration — live-updating game cards, coalesced edits |
| [Audio Sharing](audio-sharing/README.md) | Share a game code over audio — FSK encoding, frequency map, FFT decoder |
| [CI Plan](CI_PLAN.md) | GitHub Actions CI design — test surfaces, job layout, runner requirements |
| [Changelog](CHANGELOG.md) | Player-facing changelog — grouped by day, newest first |

## Test runs

| Suite | Description |
|-------|-------------|
| [Game](test-runs/game/README.md) | Integration test logs from the `test-game` skill — full gameplay loop, multiplayer sync, reconnect, pause, animation integrity |
| [Telemetry](test-runs/telemetry/README.md) | Pipeline test logs from the `test-telemetry` skill — services health, event→Postgres→Prometheus integrity, Grafana dashboards, dice fairness |
