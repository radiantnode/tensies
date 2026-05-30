# Feedback

External code reviews, second opinions, and the decisions that followed. Each entry is a dated transcript — reviewer turn, Claude Code verification turn, and (where it happened) a decision/implementation record.

## Index

| Date | Source | Topic | Outcome |
|------|--------|-------|---------|
| [2026-05-30](2026-05-30-tensies-code-review.md) | ChatGPT share link | Full repo analysis — security, deployment, telemetry correctness | Agreed on reconnect token (→ shipped), Grafana XSS, telemetry transaction split; pushed back on multi-worker framing |

## Open items

*Last checked: 2026-05-30*

| Feedback | Item | Status | Commit | What changed |
|----------|------|--------|--------|--------------|
| [2026-05-30](2026-05-30-tensies-code-review.md) | Reconnect token | ✅ addressed | [bb7bb11](https://github.com/radiantnode/tensies/commit/bb7bb1105e7aa113deb2006d2f623b0a7a236f57) | Minted a per-player `secrets.token_urlsafe(32)` on create/join, stored its SHA-256 hash on the player record, sent the raw token privately to the owning client, and required it (constant-time) in `handle_reconnect`. Token never appears in state snapshots. |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Grafana XSS exposure | ⛔ won't fix | — | Owner explicitly dropped this item. Risk documented in transcript. |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Writer transaction split | ⏳ open | — | — |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Stats semantics (`total_rounds` / `total_games`) | ⏳ open | — | — |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Single-worker documentation | ⏳ open | — | — |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Production config / CI / resource caps | ⏳ open | — | — |
