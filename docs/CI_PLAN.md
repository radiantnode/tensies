# CI plan — GitHub Actions

What "proper" continuous integration for Tensies should look like. This is a
design doc, not yet wired up (there is no `.github/workflows/` today). It
captures the test/build surface, the jobs that gate it, and the design choices
that matter so the implementation is mechanical when we pick it up.

## What CI has to cover

The repo has four distinct things that can break, each needing a different
runner setup:

| Surface | What it is | CI needs |
|---------|-----------|----------|
| **Python app** | FastAPI, Python 3.12. Deps pinned in `requirements.txt` + fully-resolved `requirements.lock` (with explicit CVE-closing pins). | Python 3.12 |
| **Frontend bundle** | Vanilla JS — no runtime build, but a real esbuild step at image-build time: `npm ci` → `node scripts/build_assets.mjs` → `dist/`. Node 22. | Node 22 |
| **Asset invariants** | `tests/assets_test.py` runs the *real* Node build as a subprocess, then asserts fingerprinting, CSP-safe (no inlined critical CSS), and `.gz` round-trips. | Python **and** Node |
| **Multi-instance protocol** | `tests/ws_multi_instance_test.py` drives the WS protocol against **two live uvicorn instances** (`:8101`/`:8102`) sharing **one Redis** — exercises cross-instance fan-out, single round-winner, reveal handshake, cross-instance reconnect, host transfer, and the security guards. | Redis + two app processes |
| **Container image** | 3-stage `Dockerfile` (`assets` → `nginx` → `web`). | Docker buildx |

Two things to note about the tests:

- **They are standalone scripts, not pytest.** Each prints `N passed, M failed`
  and `sys.exit(1 if failed else 0)`. CI just invokes them and trusts the exit
  code — no framework migration is required. (A pytest wrapper could come later
  purely for nicer reporting/annotations.)
- **Telemetry is optional.** Setting `TELEMETRY_ENABLED=0` drops the Postgres
  dependency, so the integration job needs only **one** service container
  (Redis), not the full Postgres/Grafana stack.

## Workflow shape

One workflow, `.github/workflows/ci.yml`, with parallel jobs.

```yaml
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read        # least privilege; jobs opt into more as needed
```

Cross-cutting hygiene for every job: pin actions to a commit SHA, set a
`timeout-minutes`, and cache language deps (`actions/setup-python` cache: pip,
`actions/setup-node` cache: npm).

### Job 1 — `lint` (Python 3.12)

- `ruff check` + `ruff format --check`. Requires adding a minimal `[tool.ruff]`
  block to a new `pyproject.toml`.
- Optionally `python -m compileall server main.py` as a near-free import/syntax
  gate.

Fast, no infrastructure.

### Job 2 — `frontend` (Node 22 + Python 3.12)

- `npm ci`, then `python tests/assets_test.py`.
- This is the build + asset-invariant gate; `assets_test.py` shells out to the
  real `build_assets.mjs`, so a broken build or a violated invariant fails here.

### Job 3 — `integration` (the load-bearing one)

- A **`redis` service container** (health-checked).
- `pip install -r requirements.lock` (cached).
- Boot **two** uvicorn instances in the background on `:8101` and `:8102`, both
  pointed at the Redis service, with `TELEMETRY_ENABLED=0` and
  `ALLOWED_ORIGINS=*`.
- Poll `GET /` on each until ready (curl loop) — the app serves `index.html`
  from `static/` without needing the built `dist/`, so no Node is required here.
- Run `python tests/ws_multi_instance_test.py`.
- On failure, dump both servers' logs (`if: failure()`).

> The two-instance topology *is the test*: a single-process shortcut would not
> exercise the Redis pub/sub fan-out or the cross-instance reconnect/host-transfer
> paths the test asserts. CI must run two real processes against shared Redis.

### Job 4 — `docker`

- `docker/build-push-action` building the default `web` target (and
  `target: nginx`) with GHA layer cache (`cache-from/to: type=gha`).
- Build-only on PRs (validates the Dockerfile every change); optionally **push
  to GHCR on `main`** — that variant needs `permissions: packages: write`.

### Job 5 — `security` (matches the repo's CVE-pinning posture)

Start non-blocking (`continue-on-error: true`), promote to required once clean:

- `pip-audit` against `requirements.lock`.
- `npm audit` for the build toolchain.
- **Trivy** image scan on the built container.
- **CodeQL** (`python` + `javascript`) as its own workflow.
- **Dependabot** (`pip`, `npm`, `github-actions`, `docker`) via
  `.github/dependabot.yml`.

## Testing — the suite needs a bottom layer

This is the weakest part of the current setup, and CI should drive fixing it,
not just run what exists.

### What exists today

Both test files are **heavy end-to-end integration tests**, and they are the
*entire* suite — there is no unit layer:

- `tests/assets_test.py` — spawns the real Node build, checks `dist/`. Needs Node.
- `tests/ws_multi_instance_test.py` — two app processes + Redis, drives the live
  WS protocol.

So the cheapest, most deterministic code — the pure logic — has no dedicated
coverage:

| Module | LOC | Tested? | Notes |
|--------|-----|---------|-------|
| `game.py` | 115 | ❌ only indirectly | **Pure, no I/O** — `apply_roll`, `next_target` (6→5→4→3→2→1→6 cycle), `sanitize_name`, `make_reconnect_token`/`verify_token`. Trivially unit-testable; today only exercised as a side effect of the WS test. |
| `gamestore.py` | 442 | ❌ only indirectly | Lua compare-and-set (`try_finish_round`), abuse limiters, `make_code`, snapshot rebuild. The single-round-winner invariant lives here and is only proven by the racy WS test. |
| `security.py` | 87 | ⚠️ partial | Origin allowlist + CSP middleware. The WS test hits the size/sanitize guards but not origin rejection or the CSP header. |
| `broadcast.py` / `reaper.py` | 207 / 61 | ⚠️ partial | Delayed-broadcast ack handshake, host transfer, grace-drop backstop — timing-sensitive, only covered E2E. |

### The two real gaps

1. **No bottom of the pyramid.** Everything is slow and infra-dependent. There's
   no fast `pytest tests/unit/` a dev (or CI's first gate) can run in seconds
   with no Redis/Node. Highest-value single addition: a unit-test file for
   `game.py` — the round-cycle, the `apply_roll` result dict (a contract CLAUDE.md
   calls out), the constant-time token verify, and `sanitize_name` against XSS
   payloads.

2. **The integration test is timing-based and will flake on shared runners.**
   `drive_win` rolls for up to 60s backing off on rate-limits; the
   "simultaneous roll" check is `check(True, ...)` after `sleep`s — it asserts
   nothing beyond "didn't crash". On a slow/loaded Actions runner the win-loop or
   the cross-instance `wait(...)` timeouts (5–6s) can expire spuriously.

### Additions to the plan

- **New `unit` job** (Python only, no services, runs first/fast): add
  `tests/unit/test_game.py` covering `game.py` in full, plus `security.py`
  origin/CSP logic. Natural place to introduce a thin **pytest** layer so CI
  gets per-assertion annotations instead of a script exit code.
- **A `gamestore` test against the real Redis** the integration job already
  provides, asserting the `try_finish_round` single-winner CAS *directly* —
  far more reliable than inferring it from six racing rollers.
- **Coverage reporting** (`pytest-cov`/`coverage.py`) surfaced on PRs,
  non-blocking at first — useful given how much currently rides on one flaky E2E.
- **Harden the WS job:** `timeout-minutes`, an `if: failure()` log dump of both
  servers, and one automatic retry scoped to this job.

## Branch protection — the part that makes it "proper"

Workflows are decoration until they gate merges. On `main`:

- Require `unit`, `lint`, `frontend`, `integration`, `docker` as **status checks**.
- Require PRs, and require branches be up to date before merge.
- Promote `security`/CodeQL to required once they run clean.

## Suggested rollout

1. **PR 1 — core gate:** `ci.yml` with jobs 1–4 + the `pyproject.toml` ruff
   config. Mark the four jobs required.
2. **PR 2 — test floor:** the `unit` job + `tests/unit/test_game.py` (pytest),
   the direct `gamestore`/`try_finish_round` test, and WS-job hardening
   (timeout/log-dump/retry). This is where the suite gains a bottom layer.
3. **PR 3 — security layer:** the `security` job, CodeQL workflow, and
   Dependabot config (scanners non-blocking at first so findings surface without
   wedging merges). Coverage reporting can ride along here, also non-blocking.

## Open questions / decisions deferred

- **GHCR publishing on `main`** — yes/no, and tagging scheme (`sha`, `latest`)?
- **Required-check promotion** timing for the security scanners and coverage.
- **Coverage threshold** — report-only, or fail under a floor once the unit
  layer exists?
