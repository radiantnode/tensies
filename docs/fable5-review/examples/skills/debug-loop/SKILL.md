---
name: debug-loop
description: "Disciplined bug-hunting protocol: reproduce first, change one thing at a time, and after two failed fixes STOP and enumerate what differs between the working and broken environments before trying again. Use when chasing a bug, especially a stubborn or environment-specific one (Safari-only, prod-only, real-phone-only, multi-instance-only)."
user_invocable: true
---

# Debug loop

The two worst debugging sessions in this project's history both had the same
shape: 3–5 failed fixes in a row, then the *discriminating fact* finally surfaced
(Safari-only; the background image was too short; cloudflared lived on another
host) — and in one case the human found it, not the model. Every one of those
resolved the moment someone named what was different about the broken
environment. This skill front-loads that.

## Protocol

1. **Reproduce before fixing.** Do not propose a fix for a bug you haven't seen
   fail. Drive the real app to the failure at the mobile viewport (390×844); for
   multiplayer, use two isolated clients. If you can't reproduce it, that IS the
   finding — say so and ask for the missing condition.

2. **Form one hypothesis, change one thing.** State what you think is wrong and
   what single change should fix it. One variable per attempt — no shotgun edits.

3. **After TWO failed fixes, STOP.** Do not try a third fix. Instead write an
   environment diff — an explicit table of what differs between where it works
   and where it breaks:

   | Axis | Works | Breaks |
   |------|-------|--------|
   | Browser | Chromium | Safari? |
   | Build | dev (raw modules) | prod (bundled)? |
   | Players | 1 | 2+? |
   | Instances | 1 | multi (fanout)? |
   | Device | simulator | real phone? |
   | Timing | slow/stepped | fast/real-time? |
   | Auth | anonymous | signed-in? |
   | Network | localhost | behind proxy/CF? |

   Fill every row you can, and name the ones you *can't* determine — those are
   what to ask the user, because they're usually the answer.

4. **Only then, attempt three** — targeting the axis the diff implicates.

## Tensies-specific failure smells

- **prod-only:** dev serves raw ES modules; prod serves the esbuild bundle from
  nginx. A bug that only reproduces on the prod build lives in the pipeline or a
  bundling assumption. Rebuild prod and repro there (`/test-game` steps 30–33).
- **Safari-only:** no View Transitions API, and preserve-3d rasters flatten the
  dice. Check the no-VT branch and the staged-swap guard. Test in Firefox too —
  it also lacks VT and exercises the same fallback Chromium never does.
- **multi-instance-only:** fanout ordering, reaper races, ack_events keyed by
  pid. Reproduce with ≥2 app instances on one Redis, not a single process.
- **real-phone-only:** iOS autoplay/permission quirks, the silent switch muting
  Web Audio, touch vs synthetic click. The simulator won't show these.

## Anti-pattern

"Still happening" → tweak → "still happening" → tweak → "still happening". If you
catch yourself here, you've already skipped step 3. Stop and diff the environment.
