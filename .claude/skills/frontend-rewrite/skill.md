---
name: frontend-rewrite
description: "Rewrite the Tensies frontend (HTML, CSS, JavaScript) from a blank canvas, one view at a time, with every view verified pixel-perfect against the current frontend before moving on. Plan-mode driven: the user enumerates the views that matter, the skill orders the work, confirms every step, scaffolds a fresh vanilla-web-component canvas, then builds and pixel-verifies each view in turn. Use when the user asks to rewrite, rebuild, or modernise the frontend without changing how it looks."
user_invocable: true
---

# Tensies Frontend Rewrite (pixel-perfect)

Rewrite the entire frontend from a **blank canvas** while guaranteeing the
result looks identical to the current app, view by view. The guarantee is not
your judgment — it is a byte-level pixel diff run by the harness in
`.claude/skills/frontend-rewrite/harness/`. You are kept on the *outside* of that
check: you build, the harness decides pass/fail.

Read this whole file before starting. Then run the phases in order.

## Non-negotiables (read first)

These are hard constraints set by the user. Violating any one is a failure of
the task, not a style preference.

1. **Blank canvas.** Assume no existing HTML/CSS/JS. Do not copy old files
   forward. The old `static/` exists only as the visual source of truth to
   diff against, never as code to lift.
2. **Never take creative liberties.** You reproduce the current look exactly.
   Zero "improvements", re-spacing, re-coloring, font swaps, or "while I'm here"
   tweaks. If the diff is non-zero, the new code is wrong, not the old design.
   Any intentional visual change must be proposed and approved by the user
   first, never slipped in.
3. **Playwright CLI only, never the MCP.** All verification runs through
   `@playwright/test` (`npm run baseline` / `npm run verify` in the harness).
   Do **not** call any `mcp__playwright*` tool for this skill.
4. **Plan mode for everything.** Every phase and every view starts in plan mode.
   Present the plan, get explicit approval (ExitPlanMode), and confirm each work
   step before you act. Never batch ahead without a green light.
5. **The diff must reach zero.** A view is not "done" until its harness run
   passes (`PIXEL_TOLERANCE=0`). No exceptions without explicit user sign-off on
   a documented, specific tolerance.

## Engineering standard for the new code

The rewrite targets **vanilla web components + a native router** (no framework,
no build step) — the user chose this for smallest payload and fastest load, and
it matches the existing `<player-card>` / `<round-target>` custom elements.
Hold to these throughout:

**Architecture (decided in build):** every screen is its own custom element
(`<loading-screen>`, `<landing-screen>`, `<join-screen>`, `<lobby-screen>`,
`<game-screen>`, plus `<nav-menu>`, overlays, etc.) rendering into **light DOM**
— the host element *is* the `#id.screen` so the existing global CSS applies
unchanged. Light DOM (not shadow) is required here because the design leans on
cross-screen selectors (`#landing .game-menu-btn`, `body:has(#nav-menu.open) …`)
and the loading↔landing `view-transition-name` morph, none of which survive a
shadow boundary. `index.html` is a thin shell that just lists the components;
each component owns its own markup, events, and behaviour. The shared top bar is
one `<app-header>`, not copied per screen.

- **Best practices, everywhere.** Semantic HTML, accessible roles, modern CSS
  (custom properties, logical properties, container/media queries as needed),
  ES modules.
- **Never duplicate code.** One source of truth per concept. Shared markup
  becomes a custom element; shared style becomes a token or utility; shared
  logic becomes a module. If you write the same thing twice, refactor.
- **Components, lean HTML.** `index.html` stays small — structure lives in
  custom elements, not a wall of markup. No bloat.
- **Quick load.** Minimal critical path, no blocking resources, defer/module
  scripts, no heavy dependencies. Inline only what must paint first.
- **Preload everything.** `<link rel="preload">` / `modulepreload` for fonts,
  CSS, and the JS the first paint needs; warm the rest so view transitions are
  instant. Preload the **whole module graph** (not just the entry) so it fetches
  in parallel instead of waterfalling.
- **Render once for static screens, update in place for dynamic ones.** A
  component's `connectedCallback` builds its markup once (guard re-entry). For
  state-driven views (lobby list, players bar, game board) do NOT re-`innerHTML`
  on every WS frame — that re-parses HTML and resets dice scatter, focus, and
  in-flight animations, and is slow at ~60fps. Reuse keyed elements (a
  `<player-card>` per player id), fingerprint with `myDiceKey()` to skip
  needless renders, and event-delegate rebuilt controls (the roll button). Use
  `<template>.cloneNode(true)` over `innerHTML` for repeated nodes.
- **Smooth transitions.** Use the View Transitions API (already in use) for
  screen changes; respect `prefers-reduced-motion`.
- **Permalinkable pages.** Every view has a real URL via the History API; deep
  links and refresh land on the right view (the app already deep-links join
  codes — preserve and extend that to all views).

## The harness is the judge

Everything you need is in `harness/` (see its `README.md`). One-time setup:

```bash
cd .claude/skills/frontend-rewrite/harness && npm install && npx playwright install chromium
```

- Capture ground truth from the **current** app: `TENSIES_URL=<old> npm run baseline`
- Verify a rewritten view: `TENSIES_URL=<new> npm run verify:one <view-name>`
- Zero differing pixels = pass. Any diff prints `*-expected/-actual/-diff` PNGs.

Determinism is handled from the outside only (no app-code seam): `seedPage`
pins client RNG/time, `settle` waits on fonts and freezes animation, and
`pinWebSocket` rewrites server `state` frames so dice/roster are fixed for
server-driven views. Details in `harness/determinism.js`.

**Read `harness/NOTES.md` before capturing anything.** It is the field guide
from building the current baseline set: the one-host frame-synthesis technique
(synthesize any view by rewriting the post-create frame — no need to play a real
game), exactly what `seedPage` pins and why, the `has_rolled` requirement for
started games, the confirmed WS frame shapes, a selector cheat-sheet, the
time-sink gotchas (the `showScreen` View-Transition race, pause status hidden
inside the menu, `pkill -f uvicorn` self-kill), the full 17-state catalog with
the approach for each, and a known latent app bug to preserve-or-fix. The
running specs (`stateful.spec.js`, `extras.spec.js`, `views.spec.js`) are the
worked references; copy their patterns.

---

## Phase 1 — The user defines every view that matters

Pixel-perfect only covers states you capture, so this catalog **is** the boundary
of the guarantee. In plan mode, work with the user to enumerate every view and
every meaningful state of each. Do not start from your own guess — ask them, then
cross-check against the codebase so nothing is missed.

A complete, **already-built** 17-state catalog exists — see the table in
`harness/NOTES.md` and the committed baselines in `harness/baselines/`. Start the
conversation from that inventory (landing, join, join-error, nav-menu, changelog,
lobby solo/3p/guest/5p, game board, in-game menu, paused host/guest, winner,
loser, disconnect-waiting, fatal-error) rather than from a blank page, then
confirm with the user whether anything is missing or any new state matters. Also
cross-check `static/index.html` and `CLAUDE.md` so nothing slipped.

For each state record: a short **name**, the **URL/route**, the **viewport(s)**
it matters at, and how to **reach** it. The catalog is encoded in three places to
copy from: `harness/states.json` (single-page "static" states), `stateful.spec.js`
(synthesized server-driven states), and `extras.spec.js` (real-interaction
states). Note which approach each new state needs — `NOTES.md` explains all three.

**Confirm the catalog with the user before leaving this phase.** Adding a missed
state later is cheap; shipping a view that was never protected is the failure mode
this phase exists to prevent.

## Phase 2 — Capture and commit baselines from the CURRENT app

Before touching anything, freeze the ground truth.

1. Make sure the current app is running and reachable (default `http://localhost:8888`).
2. `cd harness && TENSIES_URL=http://localhost:8888 npm run baseline`.
3. Eyeball a few generated PNGs in `baselines/` with the user and confirm they
   look right. From here on, trust is in the arithmetic, not in either of you.
4. Commit them: `git add .claude/skills/frontend-rewrite/harness/baselines && git commit`.
   Committing baselines **before** any rewrite commit means the PR shows they
   predate your changes and were not tampered with.

If a state cannot be captured reproducibly (flaky, non-deterministic), fix the
harness driving for it now — never weaken the tolerance to make it pass.

## Phase 3 — Determine the logical build order

In plan mode, propose the order to rebuild the views and explain the reasoning.
Order by **dependency and shared foundation**, not by screen importance:

- Shared shell first (document head, tokens/variables, base reset, router,
  loading screen, transition plumbing) — it underlies every view.
- Then the simplest leaf views (landing, join) to validate the canvas end-to-end
  against a real pixel diff before tackling stateful ones.
- Then stateful/multiplayer views (lobby → game board → players bar → overlays),
  which build on components proven by the earlier views.

Present the ordered list and **get approval before building anything.**

## Phase 4 — Scaffold the new canvas (ask the user as you go)

In plan mode, set up the fresh framework and the things every view shares.

1. **Ask the user where the new frontend should live** — a parallel directory
   (e.g. `static-next/`, keeps the old app serving and baselines re-capturable
   throughout, swap at the end) **or** in place over `static/`. This was left for
   runtime; do not assume. Wire serving accordingly (the only HTTP route is
   `GET /` in `server/routes.py`, and `server/assets.py` does cache-busting over
   `static/css` + `static/js` — account for both if you relocate).
2. Stand up the shared shell per the engineering standard above: lean
   `index.html`, the design tokens, base styles, the native router (History API,
   permalinkable), the View-Transitions wrapper, preload/modulepreload wiring,
   and the loading screen.
3. **Ask before each foundational decision the user should own** (file layout,
   token names, router URL scheme). Confirm the scaffold builds and serves an
   empty-but-valid shell before building any real view.

Do not duplicate anything from the old code; rebuild it clean.

## Phase 5 — Per-view build-and-verify loop

Repeat for each view in the Phase-3 order. Every view runs the full loop; never
skip the verify because a view "obviously matches."

For each view:

1. **Plan the view (plan mode).** Reference the baseline PNG and the old
   `static/` source for the exact look. State which components you will create or
   reuse (never duplicate), the markup, the styles, and the route. ExitPlanMode
   for approval. **Confirm before building.**
2. **Build it** to the engineering standard. Reuse existing components; extract
   new shared ones rather than copy-paste.
3. **Verify against the baseline:**
   `cd harness && TENSIES_URL=<new-app> npm run verify:one <view-name>`.
4. **Work until perfect.** On any diff, open the `*-diff` PNG, find the exact
   discrepancy (spacing, color, font metrics, radius, shadow), fix the new code,
   re-run. Loop until the run is green at `PIXEL_TOLERANCE=0`. You are correcting
   the new code toward the old pixels — never adjust the baseline or raise
   tolerance to force a pass.
5. **Send the user the completed view.** Use the passing actual screenshot
   (`harness/results/.../*-actual.png`, or `report/`) via SendUserFile so they
   see exactly what shipped.
6. **Confirm before continuing.** Get explicit approval to move to the next view.
   If the user wants a change, treat it as an approved intentional deviation:
   update the old design? No — re-capture the baseline only if the user is
   changing the *target*, and record that decision explicitly.

Commit after each verified view with a clear message, so progress is durable and
reviewable view by view.

## Phase 6 — Finish

When every catalogued view passes:

1. Run the **full** suite once more (`npm run verify`) — all views, all
   viewports, green.
2. If building in a parallel dir, swap it in (update `server/routes.py` /
   `server/assets.py` as needed) and delete the old `static/` only after the full
   suite passes against the swapped-in app. Re-run the full suite post-swap.
3. Run the project's own `test-game` skill to confirm behavior (not just looks)
   still holds end-to-end.
4. Summarize for the user: views rebuilt, all pixel-verified at zero tolerance,
   any approved intentional deviations listed explicitly. Confirm they are happy
   before considering the rewrite complete.

## Guardrails recap

- The harness decides pass/fail; you do not eyeball-approve your own pixels.
- Zero tolerance unless the user signs off on a specific documented exception.
- Plan and confirm every phase and every view. No running ahead.
- No creative liberties, no duplicated code, no MCP Playwright.
- A view with no baseline is unprotected — keep the catalog complete.
