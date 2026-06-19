# Feedback

External code reviews, second opinions, and the decisions that followed. Each entry is a dated transcript — reviewer turn, Claude Code verification turn, and (where it happened) a decision/implementation record.

## Index

| Date | Source | Topic | Outcome |
|------|--------|-------|---------|
| [2026-06-16](2026-06-16-gemini-general-review.md) | Gemini | General repo review — architecture, frontend, edge-cases, AI collaboration | Mostly accurate; corrected grace period (60s not 30s), pushed back on over-engineering framing and maintainability concern; no code changes |
| [2026-06-16](2026-06-16-grok-general-review.md) | Grok | Gameplay & UX critique framed against physical Tenzi | Central claim (turn-based pacing) refuted; haptic feedback, skippable overlay, variants noted as future nice-to-haves; no code changes |
| [2026-05-30](2026-05-30-tensies-code-review.md) | ChatGPT share link | Full repo analysis — security, deployment, telemetry correctness | Agreed on reconnect token (→ shipped), Grafana XSS, telemetry transaction split; pushed back on multi-worker framing |
| [2026-06-01](2026-06-01-security-audit.md) | Security audit | Deployment creds, DoS caps, dep CVEs, WS origin/size, name XSS | Folded into the multi-instance (Redis) change: C1/H1/H2/H3/M1/M2/M3/L1/L2/I1/I2/I4 addressed; L3/L4 deferred |

## Open items

*Last checked: 2026-06-16*

| Feedback | Item | Status | Commit | What changed |
|----------|------|--------|--------|--------------|
| [2026-05-30](2026-05-30-tensies-code-review.md) | Writer transaction split | ⏳ open | — | `writer.py:80` still wraps event insert + all rollup handlers in one `con.transaction()` with no savepoints. |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Stats semantics (`total_rounds` / `total_games`) | ✅ addressed | [08dc872](https://github.com/radiantnode/tensies/commit/08dc872587e2acb13dec017b2f2d6226b6f45919), [232f4c8](https://github.com/radiantnode/tensies/commit/232f4c8af5e52fbbd0ea0625b4ce8be502ad7328) | `total_rounds` moved from `_h_round_won` to `_h_round_ended` (all participants); `total_games` increment added in `_h_game_ended`. |
| [2026-05-30](2026-05-30-tensies-code-review.md) | Production config / CI / resource caps | 🟡 partial | — | Prod compose, non-root Dockerfile, bearer-gated endpoints, rate limits, resource caps all shipped. **CI still open.** |
| [2026-06-01](2026-06-01-security-audit.md) | PII retention (L3) | ⏳ deferred | — | No telemetry retention policy yet. |
| [2026-06-01](2026-06-01-security-audit.md) | HTTP security headers (L4) | ✅ addressed | [2f9c055](https://github.com/radiantnode/tensies/commit/2f9c05521b9e7359772fee8a710932cd3f2f33d5) | Strict CSP + HSTS middleware in `server/security.py`. Same-origin, no `'unsafe-inline'`, per-directive env overrides. |
