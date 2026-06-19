# Handoff — CI / GitHub Actions work

Status of the CI buildout for Tensies, so anyone (or any session) can pick it up
cold. Work lives on branch **`claude/github-actions-ci-plan-018fit`** →
**PR [#10](https://github.com/radiantnode/tensies/pull/10)**.

## Where things stand

**PR #10 is open and green** (core CI jobs passing). It delivers Phase 1 of the
plan plus dependency monitoring and static analysis:

- `.github/workflows/ci.yml` — four parallel jobs: `lint`, `frontend`,
  `integration`, `docker`.
- `pyproject.toml` — ruff config.
- `.github/dependabot.yml` — weekly Dependabot (pip, npm, github-actions, docker).
- `.github/workflows/codeql.yml` + `.github/codeql/codeql-config.yml` — CodeQL
  for Python + JavaScript.
- `docs/CI_PLAN.md` — the full plan (this is the source of truth for phases).

Code Scanning is enabled on the repo (confirmed via the GitHub Advanced Security
bot comment on the PR), so CodeQL uploads results rather than erroring.

## The CI jobs, briefly

| Job | Runs | Needs |
|-----|------|-------|
| `lint` | `ruff check .` | Python 3.12 |
| `frontend` | `npm ci` + `python tests/assets_test.py` (real esbuild build) | Node 22 + Python |
| `integration` | two `uvicorn` instances on a shared Redis service + `python tests/ws_multi_instance_test.py` | Redis service, `TELEMETRY_ENABLED=0` |
| `docker` | build-only of the `web` + `nginx` Dockerfile targets | buildx + GHA cache |

CodeQL is a separate workflow (PR + push-to-main + weekly cron); findings land in
the Security tab and do **not** block CI.

## Decisions worth knowing

- **No `ruff format` gate.** The codebase is hand-formatted (aligned SQL,
  intentional wrapping); a blanket reformat would bury real diffs. Lint is
  `ruff check` only.
- **ruff config** (`pyproject.toml`): line-length 100; rules `E/F/W/I/B/UP`.
  `E501` ignored under `server/telemetry/*` (embedded SQL / Prometheus help
  strings). `loadtest.py` and `.claude/` excluded.
- **Telemetry off in CI** (`TELEMETRY_ENABLED=0`) → Redis is the only service the
  integration job needs (no Postgres/Grafana).
- **The integration test must run TWO instances** on shared Redis — that's the
  point of `ws_multi_instance_test.py` (cross-instance fan-out / reconnect / host
  transfer). A single-process shortcut wouldn't exercise those paths.
- **Action versions are major-tag pinned** (`@v4` etc.), not SHA-pinned yet.
  SHA-pinning is deferred to Phase 3; Dependabot's `github-actions` updates make
  it low-maintenance once done.
- **`requirements.lock` is a hand-regenerated freeze**, so Dependabot tracks
  `requirements.txt`; refresh the lock when accepting a pip bump.

## Fixes made along the way (behavior-preserving)

- **Queue-init race in `tests/ws_multi_instance_test.py`** — `__aenter__` spawned
  the `_pump()` task and immediately awaited `wait()`, but `self._q` was created
  inside `_pump()`. Passed locally by scheduling luck; failed on the first CI
  run with `AttributeError: 'Client' object has no attribute '_q'`. Fixed by
  creating the queue in `__aenter__` before spawning the pump task.
- Small lint fixes to land green: import ordering; explicit `zip(..., strict=True)`
  on two equal-length `hmget` pairings; `asyncio.TimeoutError` → builtin
  `TimeoutError` (identical object in 3.12).

## Running the tests locally

```bash
# Unit-ish: lint
pip install ruff && ruff check .

# Frontend (needs Node 22)
npm ci && python tests/assets_test.py

# Integration (needs redis-server)
redis-server --save "" --appendonly no --daemonize yes --port 6379
export REDIS_URL=redis://localhost:6379/0 TELEMETRY_ENABLED=0 ALLOWED_ORIGINS='*'
INSTANCE_ID=a uvicorn main:app --host 127.0.0.1 --port 8101 &
INSTANCE_ID=b uvicorn main:app --host 127.0.0.1 --port 8102 &
# wait for GET / on both, then:
python tests/ws_multi_instance_test.py
```

## What's next (from `docs/CI_PLAN.md`)

- **Phase 2 — test floor:** a fast `unit` job + `tests/unit/test_game.py`
  (pytest) covering `game.py` (round cycle, `apply_roll` result dict, token
  verify, `sanitize_name`); a direct `try_finish_round` single-winner test
  against Redis; coverage reporting (non-blocking); WS-job timeout/retry
  hardening.
- **Phase 3 — security layer:** dependency/image scanners (pip-audit, npm audit,
  Trivy), `SECURITY.md`, and SHA-pinning the workflow actions.
- **Branch protection:** once #10 merges, make `lint`/`frontend`/`integration`/
  `docker` required status checks on `main`; require up-to-date branches.

## Open questions (deferred)

- GHCR publishing on `main` (yes/no, tagging scheme)?
- Coverage: report-only or fail under a floor once the unit layer exists?
- When to promote CodeQL / the security scanners to required checks.
