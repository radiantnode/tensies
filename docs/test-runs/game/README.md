# Game Test Runs

Integration test logs from the `test-game` skill. Each run exercises the full gameplay
loop across two isolated Playwright instances.

## Index

| Date | Scope | Result | Passed | Total | Highlight |
|------|-------|--------|--------|-------|-----------|
| [2026-06-17T20:30:00](2026-06-17T20-30-00.md) | Game | ✅ PASS | 31 | 31 | End Game feature (tap-to-confirm, overlay scoreboard, dismiss); overlay consistency 2995–3037ms across 6 rounds; prod bundle `app-be6e5702.js`; auth degraded to JWT (RP_ID mismatch) |
| [2026-06-15T17:49:00](2026-06-15T17-49-00.md) | Game | ✅ PASS | 34 | 34 | First 34-step run with auth (WebAuthn CDP Virtual Authenticator); celebration-echo guard held (0 flashes across 20 overlays); all overlay durations 3002–3045ms |
| [2026-06-11T08:45:00](2026-06-11T08-45-00.md) | Game | ✅ PASS | 28 | 28 | First full suite against rewrite-v2 (blank-canvas frontend, 25/25 pixel baselines at zero diff); all invariants held; known post-reveal `showFor()` race recurred once on prod (759ms, pre-existing — noted on Step 27) |
| [2026-06-08T17:15:00](2026-06-08T17-15-00.md) | Game + Asset Pipeline | ✅ PASS | 28 | 28 | First 28-step run incl. asset pipeline smoketest; Step 22 prior FAIL cleared (all overlays 3002–3040ms); prod build: 7 resources, 12.2KB JS gz, gzip+immutable |
| [2026-06-08T11:35:00](2026-06-08T11-35-00.md) | Game | 🔴 FAIL | 22 | 23 | Step 22: Alpha Winner R8 overlay closed at 1153ms — post-reveal `showFor()` closes live overlay when opponent rolls; widened by 5916a72 (overlay now opens ~350ms sooner) |
| [2026-06-07T10:55:45](2026-06-07T10-55-45.md) | Game | ✅ PASS | 23 | 23 | Full suite incl. multi-round overlay-flash check (14 overlays all ~3000ms, zero flashes); fixed 3 stale skill assertions (`#winner-sub`, target-cycle direction, `ws.close()` auto-reconnect) |
| [2026-06-01T04:14:00](2026-06-01T04-14-00-multi-instance.md) | Game (multi-instance) | ✅ PASS | 12 | 12 | 3 servers · 1 game · 6 players · 10+ rounds; cross-instance fan-out + single-winner Lua CAS + live reconnect; 0 server exceptions / console errors |
| [2026-05-30T20:35:00](2026-05-30T20-35-00.md) | Game | ✅ PASS | 22 | 22 | Reconnect-token feature verified; Steps 05/07 stuck-loading regressions cleared |
| [2026-05-30T15:55:00](2026-05-30T15-55-00.md) | Game | ✅ PASS | 22 | 22 | Pause overlay updated (`<dialog>` UX); skill assertions refreshed |
| [2026-05-30T05:02:24](2026-05-30T05-02-24.md) | Game | ✅ PASS | 44 | 44 | Re-verification sweep after 03:49 fixes; required server swap (PAUSE\_MAX=8s for cap test, normal for rest) — orchestrated outside the skill |
| [2026-05-30T04:55:57](2026-05-30T04-55-57.md) | Game | ✅ PASS | 2 | 2 | Pause cap fires (PAUSE\_MAX=8s); real server restart during pause |
| [2026-05-30T04:08:14](2026-05-30T04-08-14.md) | Game | ✅ PASS | 37 | 37 | Pause edge-case verification re-run; all green |
| [2026-05-30T03:49:54](2026-05-30T03-49-54.md) | Game | ✅ PASS | 44 | 44 | Development session, not a skill run — shipped 3 pause fixes (host abandon, round-win deferral, mid-reveal re-route) then verified them; test log used as build record |
| [2026-05-30T02:16:17](2026-05-30T02-16-17.md) | Game | ✅ PASS | 22 | 22 | Pause feature added (Steps 15–17); skill expanded to 22 steps |
| [2026-05-29T11:42:05](2026-05-29T11-42-05.md) | Game | ✅ PASS | 19 | 19 | Skill updates validated (raw-WS rate-limit method, localStorage hygiene) |
| [2026-05-29T11:31:37](2026-05-29T11-31-37.md) | Game | ✅ PASS | 19 | 19 | Reconnect fixed via isolated Playwright profiles; audited 19-step skill |
| [2026-05-28T15:47:31](2026-05-28T15-47-31.md) | Game + Telemetry | 🔴 FAIL | 21 | 22 | Prior regressions fixed; new FAIL: client reconnect doesn't send action (localStorage inconsistency) |
| [2026-05-28T15:12:05](2026-05-28T15-12-05.md) | Game | 🔴 FAIL | 17 | 22 | 3 regressions: deep-link name drop, invalid-code stuck-loading, late-join stuck-loading |
| [2026-05-28T13:00:00](2026-05-28T13-00-00.md) | Game | ✅ PASS | 19 | 21 | Post-modernize (`<dialog>`, form-submit); 2 NOTEs (950ms broadcast, reconnect tooling) |
| [2026-05-28T06:13:00](2026-05-28T06-13-00.md) | Game | ✅ PASS | 20 | 21 | First run post-refactor (ES modules, `server/` package); 1 NOTE on reconnect tooling |
| [2026-05-27T22:50:00](2026-05-27T22-50-00.md) | Game | ✅ PASS | 21 | 21 | First run with player reconnect feature |
| [2026-05-27T22:07:00](2026-05-27T22-07-00.md) | Game | ✅ PASS | 20 | 20 | Broadcast timing 1029ms (new low at the time) |
| [2026-05-27T21:49:00](2026-05-27T21-49-00.md) | Game | ✅ PASS | 20 | 20 | Error routing fixed; first clean run |
| [2026-05-27T21:09:30](2026-05-27T21-09-30.md) | Game | 🔴 FAIL | 18 | 20 | Error routing to wrong screen (`#landing-error` vs `#join-error`) |
