# Tensies — Security Audit + Remediation

**Date:** 2026-06-01

An external security audit of the FastAPI/WebSocket server, frontend, telemetry
pipeline, and deployment config. The findings below are summarised by ID; the
remediation column records what was done while moving game state to Redis for
multi-instance support (the change that activated several of these findings).

Scope decision by the owner: fold in everything the multi-instance work touches
or makes worse **plus broader deployment hardening**; for the Grafana stored-XSS
(M1), add server-side name sanitization but leave the Grafana sanitization flag
as-is (prior won't-fix). Deferred: L3 (PII retention) and L4 (HTTP headers).

## Findings & remediation

| ID | Finding | Status | What changed |
|----|---------|--------|--------------|
| **C1** | Default creds on published admin/DB services | ✅ addressed | New `docker-compose.prod.yml`: Postgres/Redis/Prometheus/Grafana on an internal network (only the app port published), all creds required from env, anonymous Grafana off, admin password + Live origins from env, pinned image versions. Dev compose marked local-only. New Redis service is password-protected and never published, in dev too. |
| **H1** | Unbounded game/connection/create DoS | ✅ addressed | `MAX_GAMES` (global, checked in Lua create), `MAX_PLAYERS_PER_GAME`, `MAX_CONNECTIONS_PER_IP` (Redis counter), create/join rate limits (`rate_allow`, Redis fixed-window) — all enforced in Redis so they hold across instances. |
| **H2** | Starlette `FileResponse` Range DoS (CVE-2025-62727), reachable via `/static` | ✅ addressed | Bumped to `fastapi==0.136.3` (allows `starlette>=0.46.0`) and pinned `starlette==1.2.1`. |
| **H3** | Starlette BadHost Host-header bypass (CVE-2026-48710) | ✅ addressed | Same Starlette 1.2.1 pin. |
| **M1** | Stored XSS into Grafana via player names | ✅ addressed (server-side) | `sanitize_name()` strips HTML/control chars at intake, so names are clean everywhere they flow (game state + telemetry). Grafana sanitization flag left as-is per owner decision. |
| **M2** | Unauthenticated `/metrics` + `/stats/*` | ✅ addressed | Bearer-token gate (`METRICS_TOKEN`/`STATS_TOKEN`); prod Prometheus scrapes with a mounted token file; unset = open (rely on network ACL). |
| **M3** | No WS `Origin` validation (CSWSH) | ✅ addressed | `ALLOWED_ORIGINS` allowlist checked before `ws.accept()`; `*` disables (dev). |
| **L1** | Predictable game codes (`random`) | ✅ addressed | `gamestore.make_code()` uses `secrets.choice`. |
| **L2** | No WS message-size cap | ✅ addressed | `MAX_WS_MESSAGE_BYTES`; oversized frames rejected before `json.loads`. |
| **I1/I2** | No lockfile / float h11 | ✅ addressed | `requirements.lock` (full pinned closure); pinned `h11==0.16.0` (CVE-2025-43859). |
| **I4** | `:latest` image tags | ✅ addressed | Pinned versions in `docker-compose.prod.yml` (digest pinning noted as the final step). |
| **L3** | Indefinite PII (IP/UA) retention | ⏳ deferred | Out of this change's scope (telemetry retention policy). |
| **L4** | Missing HTTP security headers (CSP etc.) | ⏳ deferred | Out of this change's scope. |
| **I5** | Things done well | — | Parameterized SQL, hashed reconnect token, `textContent` rendering — unchanged. |

## Verification

Two app instances sharing one Redis (`tests/ws_multi_instance_test.py`, 16/16):
cross-instance create/join, bidirectional fan-out, simultaneous rolling with a
single round winner (Lua CAS), reveal-ack handshake, cross-instance reconnect +
host-role preservation, bad-token rejection, name sanitization, message cap.
Plus a live probe of a restricted instance: `/metrics` 401 without/with-wrong
token and 200 with the right token; WS rejects a disallowed Origin (HTTP 403)
and accepts the allowlisted one. The browser UI path was not run here (no Chrome
in the sandbox); the client connect logic is unchanged (`location.host/ws`).
