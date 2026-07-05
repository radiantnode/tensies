# Pixel Verification Tests

49 tests, 49 mobile baselines (390×844 · 2× dpr · Chromium 149.0.7827.55; `rotate-overlay` is the one landscape capture, 844×390).
Run with `npm run verify` from `harness/`; all must pass at `maxDiffPixels 0` before any frontend change ships.

The landing/intro background videos (`feature/video-intro`) are frozen to their first frame at capture time — `settle()` in `determinism.js` pauses every `<video>` and pins `currentTime` to 0 — so the looping playback doesn't defeat the two-stable-consecutive-screenshots check.

---

## Static views — `views.spec.js`

Driven by `states.json`. Each navigates to a URL, clicks through steps, and screenshots the settled page.

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 1 | <img src="harness/baselines/landing-mobile.png" width="60"> | Landing screen at `/`; name input, Create Game button, Join Game with Code button, hamburger | [views.spec.js:15](harness/views.spec.js#L15) |
| 2 | <img src="harness/baselines/join-empty-mobile.png" width="60"> | Join screen after clicking "Join Game with Code"; name input, code input, Listen (audio code) button with equalizer icon, Back chip | [views.spec.js:15](harness/views.spec.js#L15) |
| 3 | <img src="harness/baselines/nav-menu-open-mobile.png" width="60"> | Nav menu slid down from the hamburger; about blurb and "See What's New" button | [views.spec.js:15](harness/views.spec.js#L15) |

---

## Real-interaction states — `extras.spec.js`

Reached by driving the live app through actual clicks and form submissions.

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 4 | <img src="harness/baselines/join-error-mobile.png" width="60"> | Join form submitted with a non-existent code (`ZZZZZ`); inline error message visible below the form, Listen button between code input and submit | [extras.spec.js:6](harness/extras.spec.js#L6) |
| 5 | <img src="harness/baselines/rotate-overlay-mobile.png" width="120"> | Phone held sideways (844×390 landscape — the only non-portrait baseline); the CSS orientation guard covers the layout: dice logo-mark, TENSIES wordmark, "rotate your device to portrait" prompt | [extras.spec.js:21](harness/extras.spec.js#L21) |
| 6 | <img src="harness/baselines/nav-menu-changelog-mobile.png" width="60"> | "What's New" changelog panel open; changelog body masked (content changes) — protects panel chrome: header, Back button, scroll fades | [extras.spec.js:34](harness/extras.spec.js#L34) |

---

## Add-to-Home-Screen — `a2hs.spec.js`

The install banner + iOS walkthrough. The `?a2hs=ios` localhost dev override forces the iOS flow under the harness UA; `Date` is fully pinned so the mock status-bar clock is byte-stable. Each step click stops the auto-advance and pins that scene.

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 45 | <img src="harness/baselines/a2hs-banner-mobile.png" width="60"> | Landing with the "Add to Home Screen" banner docked at the top; "Faster launch, full screen & more", Add button, dismiss × — over the (frozen) landing video background | [a2hs.spec.js:25](harness/a2hs.spec.js#L25) |
| 46 | <img src="harness/baselines/a2hs-step1-mobile.png" width="60"> | iOS install walkthrough, step 1 phone scene; step dots, Back chip | [a2hs.spec.js:38](harness/a2hs.spec.js#L38) |
| 47 | <img src="harness/baselines/a2hs-step2-mobile.png" width="60"> | Walkthrough step 2 phone scene | [a2hs.spec.js:38](harness/a2hs.spec.js#L38) |
| 48 | <img src="harness/baselines/a2hs-step3-mobile.png" width="60"> | Walkthrough step 3 phone scene | [a2hs.spec.js:38](harness/a2hs.spec.js#L38) |
| 49 | <img src="harness/baselines/a2hs-step4-mobile.png" width="60"> | Walkthrough step 4 phone scene | [a2hs.spec.js:38](harness/a2hs.spec.js#L38) |

---

## Synthesized server-driven states — `stateful.spec.js`

A single real WebSocket connection; `pinWebSocket` rewrites every inbound `state` frame into the exact roster, dice, and target needed. `seedPage` pins `Math.random` and `Date.now` so dice scatter and countdown timers are byte-stable.

### Lobby

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 7 | <img src="harness/baselines/lobby-3p-mobile.png" width="60"> | 3-player lobby, current player is host; player list, game code chip, Start button, Share + Play (audio code) buttons | [stateful.spec.js:44](harness/stateful.spec.js#L44) |
| 8 | <img src="harness/baselines/lobby-solo-mobile.png" width="60"> | Lobby with only the host; single-player list, Start button, Share + Play (audio code) buttons | [stateful.spec.js:96](harness/stateful.spec.js#L96) |
| 9 | <img src="harness/baselines/lobby-guest-mobile.png" width="60"> | Lobby as a non-host guest; "Waiting for host to start…" title with no Start button; the Fellow Bar Rats list (others only, own row excluded) shows the host with a plain gold **HOST** label (no pill) | [stateful.spec.js:105](harness/stateful.spec.js#L105) |
| 10 | <img src="harness/baselines/lobby-5p-mobile.png" width="60"> | Lobby at 5 players (max); list overflow and scroll-fade behavior | [stateful.spec.js:117](harness/stateful.spec.js#L117) |

### Game board

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 11 | <img src="harness/baselines/game-board-mobile.png" width="60"> | Started game mid-round, 3 players with mixed locked/unlocked dice; players bar, round target die, roll button | [stateful.spec.js:54](harness/stateful.spec.js#L54) |
| 12 | <img src="harness/baselines/game-menu-open-mobile.png" width="60"> | In-game menu (slides down from the top bar) open over the blurred board; Pause Game toggle and End Game button | [stateful.spec.js:130](harness/stateful.spec.js#L130) |
| 13 | <img src="harness/baselines/paused-host-mobile.png" width="60"> | Paused game as host with menu open; 60:00 countdown, "Everyone is here" count, Resume toggle | [stateful.spec.js:146](harness/stateful.spec.js#L146) |
| 14 | <img src="harness/baselines/paused-board-mobile.png" width="60"> | Paused game as host, menu closed; board visible, Roll button reads "Paused" | [stateful.spec.js:359](harness/stateful.spec.js#L359) |
| 15 | <img src="harness/baselines/paused-guest-mobile.png" width="60"> | Paused game as non-host; pause overlay with the TENSIES wordmark, animated dice loader (replaced the progress bar; the static logo mark was removed), and "Waiting for Alpha to resume the game" | [stateful.spec.js:166](harness/stateful.spec.js#L166) |
| 16 | <img src="harness/baselines/disconnect-waiting-mobile.png" width="60"> | Peer (Bravo) disconnected mid-game; loading screen with the animated dice loader (pink 6 + ivory 4, replaced the old progress bar) and reconnect message | [stateful.spec.js:182](harness/stateful.spec.js#L182) |
| 17 | <img src="harness/baselines/game-ended-mobile.png" width="60"> | Game ended by host mid-round; redirects to game-detail screen with one-shot "Game ended" label, player list, stats, and Roll Trust verification | [stateful.spec.js:200](harness/stateful.spec.js#L200) |
| 18 | <img src="harness/baselines/fatal-error-mobile.png" width="60"> | Terminal error frame received (simulates pause-cap expiry); session cleared, landing returns with error message inline | [stateful.spec.js:289](harness/stateful.spec.js#L289) |

### Round winner

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 19 | <img src="harness/baselines/winner-win-mobile.png" width="60"> | Round-won overlay when I am the winner; "Winner" banner, my name, countdown timer bar | [stateful.spec.js:68](harness/stateful.spec.js#L68) |
| 20 | <img src="harness/baselines/winner-lose-mobile.png" width="60"> | Round-won overlay when someone else (Cosmo) won; the viewer sees the **"Loser"** banner, the shattered-dice logo, and **their own name** (Alpha) — losers never see the winner's name in the overlay | [stateful.spec.js:82](harness/stateful.spec.js#L82) |

### Players bar variants

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 21 | <img src="harness/baselines/players-bar-variants-mobile.png" width="60"> | Bar clipped to show all four card states at once: **is-me**, **leading** (most wins), **hot** (≥7 matched), **disconnected** — needs a paused game so the board stays visible with a disconnected peer | [stateful.spec.js:336](harness/stateful.spec.js#L336) |

---

## Auth-dependent states — `auth.spec.js`

States that require a fake JWT in `localStorage` before page load (so `refreshAuth()` / `getAuthUser()` see the signed-in state on first render). Server-driven views (game board) additionally intercept the outbound `auth` WS action and return a synthetic `auth_ok` — the fake JWT has a bogus signature the server would reject.

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 34 | <img src="harness/baselines/signin-mobile.png" width="60"> | Sign-in/sign-up screen reached via nav menu `.menu-auth-btn`; no JWT needed. Gold-glow default avatar above the title; single "Sign In / Sign Up" button does double duty (signs in if the account exists, else registers) | [auth.spec.js:26](harness/auth.spec.js#L26) |
| 35 | <img src="harness/baselines/landing-signed-in-mobile.png" width="60"> | Landing with JWT injected; name input hidden, label hidden, `@TestUser` pill in header | [auth.spec.js:39](harness/auth.spec.js#L39) |
| 36 | <img src="harness/baselines/onboarding-mobile.png" width="60"> | Post-signup welcome screen; JWT + `sessionStorage('tensies_onboarding')` seeded, navigated to `/welcome`; `@TestUser` username and vanity URL | [auth.spec.js:51](harness/auth.spec.js#L51) |
| 37 | <img src="harness/baselines/nav-menu-signed-in-mobile.png" width="60"> | Nav menu when signed in; shows "Sign out" instead of "Sign in or Sign up" | [auth.spec.js:67](harness/auth.spec.js#L67) |
| 38 | <img src="harness/baselines/game-board-signed-in-mobile.png" width="60"> | Game board with JWT + WS auth intercept; `@TestUser` pill visible next to hamburger, same dice layout as signed-out for diffing | [auth.spec.js:143](harness/auth.spec.js#L143) |
| 39 | <img src="harness/baselines/game-board-signed-out-mobile.png" width="60"> | Game board without JWT; no pill, same dice layout as signed-in companion | [auth.spec.js:154](harness/auth.spec.js#L154) |

### Profile

Profile pages use `page.route()` to intercept the `/api/profile/*` fetch with deterministic JSON, so baselines are stable without a live database user.

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 40 | <img src="harness/baselines/profile-with-stats-mobile.png" width="60"> | Profile with stats + recent games; 8 stat cards (Games, Wins, Win Rate, Rounds, Rolls, Best Time, Best Rolls, Time Played), recent multiplayer games with winner/loser avatars, gold/muted scores, per-game stats. `founding_member: true` → gold-gradient "★★★ Founding · avatar · Roller ★★★" designation flanking the avatar | [auth.spec.js:206](harness/auth.spec.js#L206) |
| 41 | <img src="harness/baselines/profile-with-photo-mobile.png" width="60"> | Profile with `profile_photo_url` set + recent games; same layout as above (incl. the Founding Roller designation) but avatar src swapped to the photo URL | [auth.spec.js:221](harness/auth.spec.js#L221) |
| 42 | <img src="harness/baselines/profile-empty-mobile.png" width="60"> | Profile with `stats: null`; avatar, username, member-since, "No games played yet" empty state. `founding_member: false` → the non-founding control (no designation; avatar sits alone) | [auth.spec.js:237](harness/auth.spec.js#L237) |

### Game detail

Game detail pages use `page.route()` to intercept `/api/game/*` and `/api/game/*/verify` fetches with deterministic JSON. The verification animation runs through its JS-driven phases (setTimeout-based, not CSS) before the final state is captured.

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 43 | <img src="harness/baselines/game-detail-verified-mobile.png" width="60"> | Game detail with all 95 rolls verified via drand beacons; game code, play time, duration, player list with wins, Roll Trust shield badge, green checkmarks per player, "All 95 rolls verified" verdict, drand attribution | [auth.spec.js:311](harness/auth.spec.js#L311) |
| 44 | <img src="harness/baselines/game-detail-no-data-mobile.png" width="60"> | Game detail for a pre-drand game with no beacon data; same layout but "No beacon data for this game" verdict instead of checkmarks, no per-player rows | [auth.spec.js:326](harness/auth.spec.js#L326) |

---

## Element clips — `stateful.spec.js`

### Round target die — each face value

`<round-target>` clipped to the element, independent of board scatter.

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 22 | <img src="harness/baselines/target-die-1-mobile.png" width="60"> | Target die **1** — one centre pip | [stateful.spec.js:379](harness/stateful.spec.js#L379) |
| 23 | <img src="harness/baselines/target-die-2-mobile.png" width="60"> | Target die **2** — two diagonal pips | [stateful.spec.js:379](harness/stateful.spec.js#L379) |
| 24 | <img src="harness/baselines/target-die-3-mobile.png" width="60"> | Target die **3** — three diagonal pips | [stateful.spec.js:379](harness/stateful.spec.js#L379) |
| 25 | <img src="harness/baselines/target-die-4-mobile.png" width="60"> | Target die **4** — four corner pips | [stateful.spec.js:379](harness/stateful.spec.js#L379) |
| 26 | <img src="harness/baselines/target-die-5-mobile.png" width="60"> | Target die **5** — four corners + centre | [stateful.spec.js:379](harness/stateful.spec.js#L379) |
| 27 | <img src="harness/baselines/target-die-6-mobile.png" width="60"> | Target die **6** — six pips, two columns | [stateful.spec.js:379](harness/stateful.spec.js#L379) |

### Play die — each face value

The regular ivory bone die, clipped to the first unmatched `.die-scene` on the board (all ten of my dice carry the value; the target differs so the cube is non-matched). Each clip pins the face value, the `--die-face` bone material, the drilled `PIP_POSITIONS` pip layout, and the seeded scatter pose.

| # | Screenshot | Checks | Spec |
|---|-----------|--------|------|
| 28 | <img src="harness/baselines/play-die-1-mobile.png" width="60"> | Play die **1** — one centre pip | [stateful.spec.js:398](harness/stateful.spec.js#L398) |
| 29 | <img src="harness/baselines/play-die-2-mobile.png" width="60"> | Play die **2** — two diagonal pips | [stateful.spec.js:398](harness/stateful.spec.js#L398) |
| 30 | <img src="harness/baselines/play-die-3-mobile.png" width="60"> | Play die **3** — three diagonal pips | [stateful.spec.js:398](harness/stateful.spec.js#L398) |
| 31 | <img src="harness/baselines/play-die-4-mobile.png" width="60"> | Play die **4** — four corner pips | [stateful.spec.js:398](harness/stateful.spec.js#L398) |
| 32 | <img src="harness/baselines/play-die-5-mobile.png" width="60"> | Play die **5** — four corners + centre | [stateful.spec.js:398](harness/stateful.spec.js#L398) |
| 33 | <img src="harness/baselines/play-die-6-mobile.png" width="60"> | Play die **6** — six pips, two columns | [stateful.spec.js:398](harness/stateful.spec.js#L398) |
