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

## Branch protection — the part that makes it "proper"

Workflows are decoration until they gate merges. On `main`:

- Require `lint`, `frontend`, `integration`, `docker` as **status checks**.
- Require PRs, and require branches be up to date before merge.
- Promote `security`/CodeQL to required once they run clean.

## Suggested rollout

1. **PR 1 — core gate:** `ci.yml` with jobs 1–4 + the `pyproject.toml` ruff
   config. Mark the four jobs required.
2. **PR 2 — security layer:** the `security` job, CodeQL workflow, and
   Dependabot config (scanners non-blocking at first so findings surface without
   wedging merges).

## Open questions / decisions deferred

- **GHCR publishing on `main`** — yes/no, and tagging scheme (`sha`, `latest`)?
- **pytest wrapper** for the two script tests — nicer CI annotations vs. leaving
  them as-is?
- **Required-check promotion** timing for the security scanners.
