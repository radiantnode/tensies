# Feedback

External code reviews, second opinions, and the decisions that followed. Each entry is a dated transcript — reviewer turn, Claude Code verification turn, and (where it happened) a decision/implementation record.

## Index

| Date | Source | Topic | Outcome |
|------|--------|-------|---------|
| [2026-06-09](2026-06-09-chatgpt-feedback-review.md) | ChatGPT static review + self-review | Reliability/edge-case review — roll state machine, fire-and-forget tasks, Pub/Sub delivery, telemetry consistency | Verified all claims; ChatGPT's self-review then converged on the second opinion (H2 escalated to terminal, fan-out reframed, M1/M3/M6 → backlog). Agreed plan: H1 → README → H2 → telemetry → CI. **Owner chose review only — nothing implemented.** |
| [2026-05-30](2026-05-30-tensies-code-review.md) | ChatGPT share link | Full repo analysis — security, deployment, telemetry correctness | Agreed on reconnect token (→ shipped), Grafana XSS, telemetry transaction split; pushed back on multi-worker framing |
| [2026-06-01](2026-06-01-security-audit.md) | Security audit | Deployment creds, DoS caps, dep CVEs, WS origin/size, name XSS | Folded into the multi-instance (Redis) change: C1/H1/H2/H3/M1/M2/M3/L1/L2/I1/I2/I4 addressed; L3/L4 deferred |

## Open items

*Last checked: 2026-06-09*

| Feedback | Item | Status | Commit | What changed |
|----------|------|--------|--------|--------------|
| [2026-06-09](2026-06-09-chatgpt-feedback-review.md) | H1 — in-game error wedges roll UI | ⏳ open | — | — |
| [2026-06-09](2026-06-09-chatgpt-feedback-review.md) | H2 — round-advance recovery (reaper) | ⏳ open | — | — |
| [2026-06-09](2026-06-09-chatgpt-feedback-review.md) | M1 / M2 / M3 — Pub/Sub resync, `send()` timeout, token rotation | ⏳ open | — | — |
| [2026-06-09](2026-06-09-chatgpt-feedback-review.md) | M7 — CI / Dependabot (no `.github/`) | ⏳ open | — | — |
| [2026-06-09](2026-06-09-chatgpt-feedback-review.md) | L1 / L2 — README drift, env-parser fail-fast | ⏳ open | — | — |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Reconnect token | ✅ addressed | [bb7bb11](https://github.com/radiantnode/tensies/commit/bb7bb1105e7aa113deb2006d2f623b0a7a236f57) | Minted a per-player `secrets.token_urlsafe(32)` on create/join, stored its SHA-256 hash on the player record, sent the raw token privately to the owning client, and required it (constant-time) in `handle_reconnect`. Token never appears in state snapshots. |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Grafana XSS exposure | ✅ addressed (server-side) | — | Names sanitized at intake (`sanitize_name`), closing the stored-XSS vector at the source. Grafana sanitization flag left as-is per the earlier owner decision. See the [2026-06-01 audit](2026-06-01-security-audit.md) (M1). |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Writer transaction split | ⏳ open | — | — |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Stats semantics (`total_rounds` / `total_games`) | ⏳ open | — | — |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Single-worker documentation | ✅ resolved | this change | Game state externalized to Redis (`server/gamestore.py`) + cross-instance fan-out (`server/fanout.py`); the app now runs as multiple instances behind a round-robin LB. The single-worker ceiling is gone; multi-instance is documented in `CLAUDE.md`. |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Production config / CI / resource caps | 🟡 partial | this change | `docker-compose.prod.yml` + non-root Dockerfile + pinned deps/lockfile + resource caps + endpoint auth added (see [2026-06-01 audit](2026-06-01-security-audit.md)). **CI still open.** |
| [2026-06-01](2026-06-01-security-audit.md) | Security audit (C1/H1–H3/M1–M3/L1–L2/I1–I2/I4) | ✅ addressed | this change | See the [audit doc](2026-06-01-security-audit.md) for the per-finding table. |
| [2026-06-01](2026-06-01-security-audit.md) | PII retention (L3), HTTP security headers (L4) | ⏳ deferred | — | Out of scope for the multi-instance change. |
