# Session pass-off

Handoff for the next session on branch **`claude/project-communication-ubyenz`**.
Read this first, then continue from "Next actions."

## TL;DR

This session was a documentation-accuracy pass plus an environment setup thread.
We audited `CLAUDE.md` and the `.claude/` skill docs against the real code, fixed
the discrepancies, captured working preferences, and started (but did not finish)
wiring Docker Hub auth so the `docker-compose` stack can run in the sandbox.

All work is committed and pushed. Working tree is clean. Nothing is half-edited.

## What got done (commits, oldest first)

| Commit | Summary |
|--------|---------|
| `4ceb731` | Added a **Working agreement** section to `CLAUDE.md` + fixed 6 stale architecture claims (see below). |
| `15397e8` | Aligned `CLAUDE.md` test resolution to the pixel harness (**390×844 @2×**). |
| `5b21f52` | Harness `README.md`: pinned-browser example `chromium-1194` → `1187`. |
| `8c9494a` | Harness `NOTES.md`: pinned Chromium `141.0.7390.37` → `140.0.7339.16`. |
| `b739cc0` | **test-game**: exposed `window._state` (localhost-gated) in `state.js`; fixed stale file refs. |
| `417fcde` | **test-telemetry**: fixed a backwards target-cycle assertion + minor staleness. |
| `4c78fa5` | Fixed `frontend-rewrite` frontmatter key, harness baseline description, and a `CLAUDE.md` target-cycle line. |
| `01fd448` | Recorded the **prefer-docker-compose** preference + sandbox pull-limit caveat in `CLAUDE.md`. |

### CLAUDE.md accuracy fixes (in `4ceb731` unless noted)
- "Inline critical CSS" was wrong — it's an external `static/css/critical.css`
  loaded via `<link>` (only the loading *markup* is inline).
- `server/security.py` (CSP/HSTS middleware) was undocumented — now in the
  layout + env-var notes.
- `static/js/touch.js` (iOS double-tap-zoom guard) was missing from the layout.
- Cache-busting section was stale — rewrote to cover the prod/dev `FRONTEND_DIST`
  split (prod **does** have a build step: `scripts/build_assets.mjs` + nginx).
- WS protocol tables were missing `reconnect`, `pong`, and `reconnect_token`.
- Target cycle was written backwards (`6→5→4…`); corrected to `1→2→3→4→5→6→1`
  (`next_target = t%6+1`, initial target `1`) in `4c78fa5`.

### Skill-doc fixes
- **test-game**: every `evaluate` snippet used a global `_state` the app never
  exposed (the preamble even said it would `ReferenceError`). Fix: `state.js` now
  sets `window._state = state` **only on `localhost`/`127.0.0.1`** (dev + local
  prod smoketest, never a public deploy). Rewrote the preamble, corrected the
  line-246 claim. Also fixed stale paths: `handleMessage` lives in
  `static/js/net.js` (not `ws.js`); pause lives in
  `static/js/components/game-screen.js` (not `menu.js`).
- **test-telemetry**: Step 7 asserted targets cycle `6→5→4` — **wrong**, would
  FAIL a correct game. Now `1→2→3`. Also de-hardcoded the partition-month example
  and switched to the primary `/<CODE>` deep-link.
- **frontend-rewrite**: frontmatter key was `user-invocable` (hyphen) vs
  `user_invocable` (underscore) in the other four skills — aligned to underscore.
- **harness/README.md**: baselines are mobile-only (25 PNGs, one `mobile` project,
  no desktop), not "17 states × mobile/desktop".

## Verification done / NOT done
- **Verified live**: the `window._state` fix. Brought the app up (see Docker note
  for how) and confirmed in a Playwright `evaluate` that `window._state` resolves
  to the full 20-key bag and the verbatim Step-8 snippet runs without error.
- **NOT run**: the full `test-game` / `test-telemetry` suites end-to-end. The
  other doc fixes were verified by reading the code, not by executing the suites.

## Decisions the user made (don't relitigate)
- **Test viewport stays 390×844 @2×** to match the pixel harness. The user
  originally wanted **iPhone 15 Pro Max (430×932 @3×)** but chose not to
  re-baseline. If they revisit it, it requires a deliberate re-baseline
  (re-target `playwright.config.js` + regenerate all baseline PNGs against the
  pinned Chromium build).
- **Prefer the docker-compose stack.** Always try `docker compose up -d` first
  (start the daemon if needed); fall back to local-Redis + the no-DB wrapper only
  when image pulls genuinely can't succeed — and say so when you do.

## Docker / sandbox state (important)
- `dockerd` **starts fine** here: `setsid dockerd >/tmp/dockerd.log 2>&1 &`
  (the daemon is just not auto-started).
- The registry is reachable, but **Docker Hub blocks unauthenticated pulls**
  with a per-IP rate limit, and **no images are cached**. So `docker compose up`
  could not pull images this session.
- **The user added Docker Hub credentials as environment variables**, but they
  are **NOT visible in this container** — env-config changes apply to a **new**
  session/container. **The next session should have them.** Verify with
  `printenv | grep -i docker`.
- **No-Docker fallback** (works without the daemon; no telemetry stack):
  ```bash
  redis-server --daemonize yes --port 6379
  PYTHONPATH=.claude/skills/frontend-rewrite/harness:. \
    uvicorn run_without_db:app --host 127.0.0.1 --port 8888
  ```
  (Python deps + Chrome were installed this session; a fresh container won't have
  them — `pip install -r requirements.txt` and
  `npx -y playwright install chrome` if needed.)

## Next actions (pick up here)
1. **Confirm the Docker Hub env-var names.** The user was asked but the new
   session should just check: `printenv | grep -i docker`. Suggested names were
   `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (read-only PAT).
2. **Write a SessionStart hook** that, on each session, starts `dockerd` and runs
   `docker login` from those vars (no-op if absent), so the compose stack comes up
   authenticated automatically. There's a `session-start-hook` skill for the
   scaffolding. This was promised but NOT yet written.
3. **Verify the stack pulls clean**: `docker compose up -d`, then
   `curl -sf http://localhost:8888/ | grep TENSIES`. If it works, the
   prefer-docker-compose preference is now actually satisfiable.
4. **Do not paste the token into chat** — it's a secret; rely on the env vars.

## Known loose ends (not blocking)
- **Humanizer submodule is not populated** (`.claude/skills/humanizer/SKILL.md`
  missing). The `changelog` skill's Phase 5 will fail until
  `git submodule update --init --recursive` is run (needs network).

## Orientation facts
- Branch: `claude/project-communication-ubyenz`; push with
  `git push -u origin claude/project-communication-ubyenz`. Do **not** open a PR
  unless asked.
- App is mobile-only, multiplayer over Redis. Verify frontend at 390×844 with
  ≥2 clients (Playwright host/guest MCP instances). See `CLAUDE.md` working
  agreement.
- This file (`SESSION_PASSOFF.md`) is a throwaway handoff — delete it once the
  next session has absorbed it.
