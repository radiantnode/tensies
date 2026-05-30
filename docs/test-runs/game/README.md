# Game Test Runs

Integration test logs from the `test-game` skill. Each run exercises the full gameplay
loop across two isolated Playwright instances.

## Index

| Date | Scope | Result | Passed | Total | Highlight |
|------|-------|--------|--------|-------|-----------|
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
