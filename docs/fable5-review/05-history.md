# Project History — 643 Commits in 42 Days

**2026-05-25 → 2026-07-05 · one developer, pairing with Claude.** The commit trailers tell you who was at the keyboard: Claude Opus 4.6 (87, +15 with 1M context), Claude Sonnet 4.6 (83), Claude Opus 4.8 (31, +68 with 1M context), and lately Claude Fable 5 (22). The changelog's own 1.0.0 entry supplies the origin story — a bar regular who sketched the first board on the spot and kept tinkering from his barstool — and a footnote for the ages: *"the git history only starts here because he forgot to run git init until the game already worked. Whoops."*

## The eras

| Era | Dates | What shipped |
|---|---|---|
| **Big Bang Day** | May 25 (28 commits) | An already-working game lands as the initial commit — 171-line `main.py`, an 800-line `index.html`, and the napkin design as `resources/Sketch.pdf`. The rest of day one is dice *feel*: physics, gather-shake-scatter, collisions, the bar-top photo. Plus an experiment reversed within 24 hours: `edb5212 Move dice rolling to client side`. |
| **Trust & Reconnect** | May 26–27 | `381b83f Make dice rolls server-authoritative` undoes the day-one client rolling — trust beat latency within a day. 30 s reconnect grace. The test-game skill and dated run logs begin (first run: FAIL 18/20; fixed within 40 minutes). |
| **The Great Refactor + Telemetry** | May 28 | Three structural splits in one day (server package, CSS, ES modules), then a 3,040-line telemetry pipeline: Postgres + Prometheus + Grafana Live. |
| **Harness, Pause, Changelog** | May 29–30 (62) | Multiplayer test harness, the pause system built and hardened in ~24 hours, reconnect-token auth shipped same-day in response to external feedback, the feedback system itself, and an afternoon teaching the changelog to talk like a bartender. |
| **The Warm Bar Glow-Up** | May 31 (**126 commits** — biggest day) | The warm design system, the ember glow, leather Back chips, "Fellow Bar Rats," and the ~50-commit winner-overlay saga. |
| **Redis, Security, Rewrite #1** | June 1 (33) | *The Cap Cana vacation release.* `e107b5c` turns a single-process toy into a horizontally scalable service, folding in a security audit (C1/H1–H3/M1–M3/L1–L2). Same day: a 3-server/6-player multi-instance test log, the pixel-perfect rewrite harness — and all eight views rewritten pixel-zero and swapped in. From a resort. |
| **Prod Hardening** | June 7–8 | HSTS + strict CSP middleware, digest-pinned prod images, nginx LB, the esbuild asset pipeline, and the doctrine commit: `ed53c0d docs: note Tensies is mobile-only`. |
| **Rewrite-v2** | June 10–11 | A *second* full rewrite one week after the first — blank canvas, @layer CSS, strict checkJs — every view commit stamped "pixel-verified at zero diff," closing with `d0ee6d5 test-game: 28/28`. |
| **PWA + Audio Share** | June 12–13 | Installable manifest, portrait guard — and `64bf71d Add experimental audio code share`: the game code as FSK sine tones between barstools. |
| **Accounts & Identity** | June 13–15 | WebAuthn passkey accounts with stats transfer (1,433 lines), public profiles at `/@username`, and the stat-correctness fixes prompted by the May 30 ChatGPT review. |
| **Outside Opinions** | June 16 | Grok and Gemini review transcripts land in docs/feedback/ (see anecdotes). |
| **End Game, drand, Discord, CI** | June 17–19 | Host-ended games with final stats; the drand League-of-Entropy beacon → roll pipeline → `/verify` endpoint → Roll Trust docs, in three days; the Discord notifier + `/verify` slash command; GitHub Actions + Dependabot + CodeQL. |
| **The Dependabot Flood** | June 20 (52) | CI's hazing ritual: most of the second-busiest day is Dependabot merge noise. Also SECURITY.md — humbled twice (see anecdotes) — and a 4,333-line soundboard field test. |
| **A2HS & the FAB** | June 21–24 | The animated install walkthrough (1,857 lines), unified icons, the circular floating roll button. |
| **The Quiet Week** | June 25–29 | **Zero commits.** The only real gap in 42 days. |
| **Video Intro & Final Polish** | June 30 – July 5 | The game-start video intro (with the iOS autoplay-permission trick), lobby leave/roster polish, a dedicated docs-correction day (July 4: eight `Docs:` commits re-measuring stale facts), and the July 5 finale: double-duty sign-in, case-insensitive usernames, Founding Roller badges, changelog 1.23.0 "Regular's Tab." |

## Feature evolution stories

### Dice physics — 20+ iterations on day 1, then a philosophical reversal
May 25 is a study in feel-tuning: realistic physics → rapid-roll race fix → gather-shake-scatter → Euclidean spacing → *increase the gap again* (the fix-of-the-fix) → `004c7f8 Fix dice collision: replace random-retry placement with jittered grid` — the fix done *properly*, an algorithm swap instead of parameter tuning. Then the reversal: client-side rolling (May 25) undone by server-authoritative rolling (May 26). The aftershocks took two more days and produced two load-bearing invariants that survive today: `roll_count` in `myDiceKey()` (`7902496`, the re-roll-lands-on-same-values hang) and `delayed_broadcast` itself (`0b46049 Sync roll broadcast with roller's reveal animation`).

### The winner overlay — a four-act saga
**Act 1** (May 28): `4cd834c Fix winner overlay sticking when a spurious roll is queued during it`. **Act 2** (May 31): ~50 design commits in one day, including a total restart mid-stream (`2fd0e63 Remove all winner-overlay text (fresh start)`), a halo widened and then reverted, five consecutive commits nudging the winner's name by tenths of a rem (−2.6 → −4.2 → −3.9 → −3.5 → −3.2), and the broken-dice lose state — `static/logo-loser.svg` was touched **16 times**, mostly that day. **Act 3** (June 7–8): the opposite bug — the overlay *flashing away* when a broadcast lands mid-reveal; the June 8 "show winner sooner" improvement honestly logged as having *widened* the race (Step 22 FAIL: "overlay closed at 1153ms"). **Act 4** (June 11): `b6926a6` — the celebration-echo guard that finally held (June 15 log: "0 flashes across 20 overlays"). The test technique itself became a project memory: measure overlay open *duration*, not just that it opened.

### The pause system — built in a day, hardened the same night
May 29–30 in order: menu shell → host-only pause toggle → paused screen for non-hosts → survive-phone-down (1 h window) → host status panel → and then the big one, `0f5d10c Harden pause against host abandonment, win-during-pause, and mid-roll pause` — the three edge cases (host handoff, `round_advance_pending`, `postRevealState`) still called out as load-bearing in CLAUDE.md today. Verified the hard way: they set `PAUSE_MAX=8s` and let the watchdog actually kill a live game (`7238ebd`).

### The changelog as a product
May 30 contains the most charming commit run in the repo: create the skill → reframe around player benefit → tune the voice for the bar-night audience → `16c30e8 Drop "table" from changelog voice — you're at a bar` → catch the remaining "table" references → install the humanizer → wire it into the skill → give each day a bar codename → add semver → *use 0.x dev versions* → **reverse that same day** (`4aae641 changelog: 1.x baseline — root commit was already a full game`) → litigate emoji policy across three commits (tasteful pass; bullets only, never headings; at least one per release) → and finally write 1.0.0 as the real origin story. The changelog has since been regenerated three more times and `docs/CHANGELOG.md` has 30 touches — it is maintained like a feature because it is one.

### Reconnect — from 30-second grace to cryptographic tokens
30 s grace (May 27) → doubled to 60 s under the harness → the May 30 ChatGPT review flags slot-hijacking → reconnect-token auth ships *the same day* (`bb7bb11`) → pause extends the client window to ~1 h → and a false bug becomes doctrine: shared localStorage between Playwright clients faked a "host reconnect" bug, hence the isolated-profiles rule. July 2's voluntary-leave action finally gave intentional departure its own no-grace path.

### Two full frontend rewrites in ten days
Rewrite #1 (June 1) invented the method: build the pixel harness *first*, capture real-app baselines, rewrite view-by-view at zero diff, componentize, swap (−4,200 lines). Rewrite-v2 (June 10–11) did it *again* from a blank canvas for structure (@layer CSS, strict checkJs, concern-per-module). The discipline caught what pixels can't see, too — `59377e0 Restore reconnect logic missing from the frontend rewrite` — and what only Safari can: `44c605e fix: hold 3-D dice out of view-transition rasters`.

### Audio share — a modem made of barstools
June 12: the lobby "Play" button chirps the code; join "Listen" decodes it. Five letters as FSK sine tones (A=1860 Hz … Z=3360 Hz, 60 Hz spacing, checksum letter, frame ×4), pure Web Audio, zero dependencies. Then louder TX, cross-frame voting, checksum repair, sonar-ring UI. June 13 spawned a standalone soundboard field-testing tool with 24 candidate "voices"; June 15 delivered the data: **`d6bfac6` — 6 sessions, 744 tests, 19,136 lines, the largest commit in the repo.** The verdict: Pure Sine and Triangle are "Tier 1 — Bulletproof (100%)"; steel-drum came last at 8/36; portamento-dream "sounds like a synthesizer falling asleep." June 20 added a loud-bar test at 60% volume and SONIC-BRAND.md — a genuinely researched memo on the Netflix ta-dum and the Intel bong, concluding: don't make the data tones catchy; bookend them with a fixed mnemonic.

### Provably-fair rolling — three days, cleanly layered
Beacon client → roll pipeline + `/verify` → player-facing Roll Trust UI with shield badge → docs → prod wiring, June 17–19. The design kept `apply_roll()` pure (optional `dice_values` parameter), which is exactly why the verify endpoint can replay any roll. The Discord `/verify` slash command lets anyone audit a game from chat. Default off.

## Statistics

**Commits per week:** 255 (May 25–31) → 62 (Cap Cana week) → 98 (rewrite-v2/PWA/passkeys) → 124 (profiles/drand/CI) → 20 (wind-down) → 0-gap → 84 (final polish). Busiest days: May 31 (126), June 20 (52), May 30 (49).

**Biggest commits:** soundboard field data 19,136 · rewrite swap 4,551 · soundboard S7 4,333 · rewrite-v2 scaffold 3,967 · telemetry pipeline 3,040 · A2HS walkthrough 1,861 · passkeys 1,433 · Redis migration 1,367.

**Most-touched files:** `index.html` 95 · `overlays.css` 52 · `game.css` 32 · `lobby.css` 31 · `landing.css` 29 · `CHANGELOG.md` 30 · `routes.py` 28 · **the test-game skill 26** · **CLAUDE.md 21** · `logo-loser.svg` 16. The process was versioned like a feature.

**Fix ratio:** ~75 of 643 commits (~12%) mention "fix"; only **5 reverts** in six weeks — iteration went forward, not backward. **31 releases** (1.0.0 → 1.23.0), every one with a bar codename. **26 game test-run logs + 5 telemetry logs**, from FAIL 18/20 (May 27) to 34/34 with real WebAuthn and prod-bundle smoke tests (July 3).

## Churn vs stability — the healthiest chart in the project

**Stable from (nearly) day one — the hard parts, remarkably:** `gamestore.py` (4 touches since the Redis migration), `fanout.py` (2), `state.py` (4), `security.py` (4), `auth.py` (3 since birth), `game.py` (9 in six weeks). **Endless churn — the feel surface:** `index.html` (95), the CSS files, the screen components, and the two most-churned files of all — `static/game.js` (19) and `static/style.css` (18) — *don't even exist anymore*; they were split on May 28 and their successors rewritten twice after that.

The distributed-systems core was designed once, verified with multi-instance integration tests, and left alone, while the pixels above it were re-sanded continuously. That is exactly the right shape.
