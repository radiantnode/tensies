# Pixel-verification harness

The judge for the frontend rewrite. It captures byte-exact baselines from the
**current** frontend, then fails any rewritten view whose pixels differ. The
pass/fail decision is pure arithmetic on PNG bytes — not a judgment call.

Driven entirely by the **Playwright CLI** (`@playwright/test`). Never the MCP.

## Install (once)

```bash
cd .claude/skills/frontend-rewrite/harness
npm install
npx playwright install chromium
```

If the environment cannot download a browser (sandbox / blocked CDN), point at
an already-installed Chromium of a matching major instead — the wire protocol is
stable across adjacent builds:

```bash
export PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
```

## Running the app to capture against

**Normal:** `docker compose up -d` (web on :8888), then use `TENSIES_URL=http://localhost:8888`.

**No Docker / blocked image registry:** run the real app without the
Postgres+Grafana stack via the bundled wrapper (telemetry's DB boot is stubbed;
the production `/` route and cache-busting are unchanged):

```bash
pip install -r ../../../../requirements.txt
PYTHONPATH=.:$PWD setsid uvicorn run_without_db:app --host 127.0.0.1 --port 8888 \
  > /tmp/uv.log 2>&1 < /dev/null &   # run from the repo root
```

(If `docker compose` itself fails with no socket, the daemon just isn't started:
`dockerd >/tmp/dockerd.log 2>&1 &` — but image pulls still need registry access.)

## 1. Capture baselines from the CURRENT app

Point the harness at the running old app and record. Commit the result so the
ground truth is frozen in git before any rewriting begins.

```bash
TENSIES_URL=http://localhost:8888 npm run baseline
git add baselines && git commit -m "pixel baselines from current frontend"
```

## 2. Verify a rewritten view

Point at the new app (parallel dir or swapped — same URL once served). Zero
diff = pass.

```bash
TENSIES_URL=http://localhost:8888 npm run verify              # all views
TENSIES_URL=http://localhost:8888 npm run verify:one lobby-3p # one view
npm run report                                                # open last HTML report (diff images)
```

Exit code is non-zero on any diff; `results/` and the HTML report contain
`*-expected`, `*-actual`, and `*-diff` PNGs for every failure.

## Knobs

| env | default | meaning |
|-----|---------|---------|
| `TENSIES_URL` | `http://localhost:8888` | which app the browser hits |
| `PIXEL_TOLERANCE` | `0` | max differing pixels allowed (raise only for AA wobble, with sign-off) |

Viewports live in `playwright.config.js` `projects[]`. Edit them to the exact
devices being targeted — pixel-perfect is meaningless without a fixed viewport.

## Files

| file | role |
|------|------|
| `playwright.config.js` | viewports, zero-tolerance compare, OS-agnostic baseline paths |
| `determinism.js` | `seedPage` (RNG/time), `settle` (fonts + freeze animation), `pinWebSocket` (server-driven frames) |
| `states.json` | catalog of single-page states (copy from `states.example.json`) |
| `views.spec.js` | data-driven specs for every `type:"static"` state |
| `multiplayer.example.spec.js` | template for lobby / game-board / overlay states |
| `baselines/` | committed ground-truth PNGs |
| `results/`, `report/` | diff artifacts (gitignored) |

## Why it constrains the rewrite

Baselines come from the real running old app, so the comparison is against
ground truth, not anyone's memory of the design. The same spec runs both times,
so the only variable is the code under test. A 1px padding change moves
thousands of pixels and the run goes red. Coverage is the only soft spot: a
state with no baseline is unprotected, which is why the state catalog is built
with the user up front.
