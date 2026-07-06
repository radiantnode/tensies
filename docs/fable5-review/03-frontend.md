# Frontend Review — Code Quality & Design

## Verdict

This is one of the better no-framework frontends I've reviewed. It is not "reinventing React badly" — it's applying the two or three ideas that actually matter (keyed reconciliation, snapshot-driven one-way rendering, a single mutable store) by hand, in ~5.3k lines of JS, with comments that explain *why* at every load-bearing decision. The CSS layer discipline is real, the weird bits (FSK audio share, iOS autoplay banking, staged reveals) are engineered rather than hacked, and the pixel harness (390×844@2×, `maxDiffPixels: 0`) backs the whole thing.

The gap between claim and reality is in exactly one place: **"strict-checked JS" is aspirational.** `tsc -p jsconfig.json` currently reports 31 errors and CI has no typecheck step. That's the highest-leverage fix on this list, because everything hand-rolled here (the reconciliation guards, the animation state machine) has no framework guardrail — the type system *is* the guardrail, and it's unplugged.

## Bugs

### 1. Missing `>` in the recent-game row template — **bug**

`static/js/components/profile-screen.js:246`

The template is `<div class="recent-game" data-game-code="${...}"` — no closing `>` — immediately followed by `<span class="recent-score ...">`. The HTML parser consumes the span's opening tag as junk *attributes* of the div, so the `recent-score` span never exists: the `${r.wins}/${r.rounds}` score renders as bare unstyled text and the win/loss styling class is lost. The click-to-detail handler still works (`data-game-code` lands before the breakage), which is probably why it slipped through pixel review — the harness has no baseline for a signed-in profile with history.

### 2. The strict-JS claim doesn't hold — **bug (process)**

`jsconfig.json` + `// @ts-check` everywhere, but `tsc --noEmit` yields **31 errors**, including:

- `state.gameJustEnded` written at `net.js:314`, read at `game-detail-screen.js:113-114`, **never declared in the state bag** — the typed contract `state.js` advertises is broken.
- `net.js:240` — `case 'auth_ok'` is not in the `ServerMessage` union (`types.js:77`), so the whole handler body operates on `never`. The protocol table in CLAUDE.md lists `auth_ok`; `types.js` never got the memo.
- `auth.js:264` — `result.stats` doesn't exist on `registerPasskey`'s declared return type.
- `onboarding-screen.js:100-117` — stats typed as bare `object`, ten property-access errors.

CI runs ruff, an esbuild bundle test, and integration tests — but no `tsc`. Either add a typecheck job or stop claiming strictness; right now the annotations are decaying. Notice the pattern across the whole repo: every invariant with an enforcement mechanism (pixel harness, Lua CAS, test-game) stayed true; this is the one invariant on the honor system, and it drifted.

## Concerns

### 3. `tryReveal()` polls forever with no deadline

`static/js/animations.js:183-187`

`tryReveal()` polls for `pendingRollState` every 50 ms with no bail-out. If the server's roll response never arrives (dropped frame, or a rejection — see next item), `awaitingAck` stays true and the roll button stays disabled until some other frame resets the machine. The server has `ROLL_ACK_TIMEOUT`; the client has no mirror of it. A `Date.now() > rollShakeEnd + N` bail into a plain `renderGame(state.currentState)` would cap the failure.

### 4. In-game non-fatal errors are silently dropped

`static/js/net.js:357`

The comment "(In-game errors are handled once the game view exists.)" is a scaffold-era leftover: non-fatal `error` frames received in-game are dropped today. Combined with #3, a server-side roll rejection produces a stuck, spinning roll button with no message.

### 5. The lobby list re-inserts rows on every render

`static/js/components/lobby-screen.js:144`

`list.appendChild(row)` runs unconditionally for every row on every render — the exact anti-pattern `game-render.js:89` documents and guards against ("only move a card when it isn't already in its target slot", because re-insertion cancels in-flight transitions). A second snapshot arriving mid-entrance (common — every join triggers a render) restarts or kills the row's fade-in. The players-bar got the guard; the lobby list didn't.

### 6. The touch guard swallows rapid second taps everywhere except the roll button

`static/js/touch.js:22-27`

The second tap within 300 ms is `preventDefault()`-ed for **all** targets, but only the roll button gets the synthesized `click()`. The worst collision is End Game's tap-to-confirm flow (`game-screen.js:88-98`), which *invites* a quick second tap — tapping "Tap to confirm" within 300 ms of the first tap does nothing, and the user must tap a third time. Whitelist `.menu-item` targets or synthesize clicks generically.

### 7. `innerHTML` interpolation on profile/game-detail screens

`profile-screen.js:146,235,217`, `game-detail-screen.js:109,213` — covered in detail in [02-security.md](02-security.md) finding 5. The lobby builds equivalent rows with `textContent`; these two screens should too.

## Nits

- The header username-pill sync is copy-pasted five times with slight divergences (`landing-screen.js:102-122`, `lobby-screen.js:104-118`, `game-screen.js:156-167` — a `<span>` here, an `<a>` everywhere else — `profile-screen.js:57-68`, `game-detail-screen.js:30-41`). One shared `syncUsernamePill(container)` deletes ~60 lines and ends the drift.
- `roll.js:20-22` clears `pendingWinName`/`pendingWinTarget` but not `pendingWinRound`/`pendingWinIsLoser` — harmless because `pendingWinName` gates everything, but asymmetric with `resetRollState()` and exactly the drift a one-enum state machine wouldn't allow.
- Dead CSS: `.die-wrapper.landing` + `@keyframes die-bounce-land` (`dice.css:81-89`) — no JS ever adds the class. Related dead cargo: `pendingWinTarget` is threaded through the whole roll pipeline only to be `void`-ed in `overlays.js:98`.
- `join-screen.js:34` — `inputmode="latin"` isn't a valid value; browsers silently ignore it, so the intended keyboard hint never applied.
- `game-detail-screen.js:11-13` — a `@typedef` colliding with the exported class of the same name, and `router.js:112` casting the screen through `unknown`. This corner of the typing story is visibly improvised.

## What's genuinely excellent

- **The light-DOM component pattern** (`components/*`). The host element *is* the `#id.screen`, so global `@layer` CSS applies directly with no shadow-root duplication, and each screen exposes a tiny imperative API (`render(snap)`, `showError`) driven by the router/net layer. Data flows one way — server snapshot → `showFor()` → screen render. That's the good part of React without the framework.
- **Deliberate dependency direction** (`router.js:14-21`, `app.js:24`). The router doesn't import `net.js`; the one reverse dependency (resuming a session at boot) is injected as `bootstrap({ resumeSession })`. Cyclic-import avoidance made explicit instead of relying on ESM's tolerance.
- **The keyed `<player-card>` registry** (`game-render.js:83-90`) with the guarded `insertBefore` and the reason written down — the React-reconciler insight, correctly reimplemented in ten lines.
- **The dispatch in `net.js:252-269` is the strongest code in the app.** The private roll response, a broadcast landing mid-reveal, and the celebration echo each get a named, ordered, commented branch — `isCelebrationEcho()` records the measured regression it fixes ("observed at 1153ms and 759ms instead of the full ~3s") and enumerates the non-echo cases that must still interrupt. A hand-rolled FSM whose fragility is compensated by unusually honest documentation.
- **CSS layer discipline is enforced, not aspirational.** Every rule in all 15 sheets sits inside an `@layer` block; the order is declared once in the first render-blocking sheet; `!important` appears only in the sanctioned reset spots and the reduced-motion kill-switch. Tokens are semantic; selectors are flat classes; IDs really are only JS/test hooks.
- **The Safari preserve-3d workaround is layered defense, not a hack** (`transitions.js:68-111`, `critical.css:365-378`, `game.css:112-117`). Swaps into the game screen take the `staged` path so no view-transition raster is ever taken of the 3-D dice; dice created inside a VT are hidden by `vt-settling` with `.finally` cleanup; both the dissolve and collapse animations carry fallback `setTimeout`s so a swallowed `transitionend` can't strand a ghost overlay. Each mechanism states the WebKit failure mode it prevents.
- **The pure-CSS dice loader** (`critical.css:200-298`) — geometry derived from the logo SVG (documented), squash-and-stretch keyframes with the base rotation kept inside the keyframes so the pose survives every stop, and a reduced-motion block that knows suppressing the animation loses the pose and re-applies it statically.
- **`audio-share.js` is the strongest single file in the codebase.** Measured constants with rationale (the 2048-FFT-window-vs-70 ms-separator-slot tradeoff, the −3.5 dB separator gain, desk-measured noise floors), frequency-change segmentation because over-air ringing makes silence undetectable, and a three-tier decoder — checksum-valid frame, then position-wise majority vote across failed frames, then corroborated single-letter checksum repair. Typed errors, `AbortSignal` support, mic voice-processing disabled, encoder exported as a loopback-test seam. Real engineering, not a gimmick.
- **`video-intro.js` earns its keep through failure containment.** The hidden-looping-autoplay trick is the standard iOS workaround, but every failure mode (metadata never loads, decode stalls, `play()` rejects, `ended` beats the rAF loop) funnels into an idempotent `revealGame` with an 8 s failsafe — a playback failure costs the animation, never a stranded hidden screen.
- **The a2hs system is well-partitioned** — platform detection/plumbing (`a2hs.js`: iPadOS touch-Mac tell, iOS-Chrome exclusion so the Safari-only walkthrough can't mislead, deferred `beforeinstallprompt` replay) cleanly separated from presentation (`a2hs-guide.js`: dialog built on open and disposed on close, auto-advance stops under reduced motion, the mocked status bar shows the user's real clock time).

## What a framework would have given, and what this does better

**Accessibility — mixed, better than typical hand-rolled.** Good: native `<dialog>.showModal()` gives free focus trapping; closed menus are `visibility: hidden` (out of tab order); `aria-live` on error surfaces; `aria-pressed`/`aria-expanded` maintained on toggles; reduced motion respected globally and per-feature. Missing: `#players-bar` declares `role="list"` but the `<player-card>` children never get `role="listitem"`, so the semantics are broken for assistive tech; no focus management on screen swaps; `renderMyArea` nukes `#my-area` via `innerHTML` every roll, silently unfocusing keyboard users; and `maximum-scale=1.0` plus the multi-touch `preventDefault` fully disables pinch zoom — defensible for a game board, but a WCAG 1.4.4 trade-off with no escape hatch on the text-heavy screens (changelog, profile).

**Better than a framework build:** zero dev build step with server-side content-hash busting; a hand-maintained `modulepreload` graph that flattens the import waterfall; first paint is pure inline HTML + one render-blocking CSS file with no JS in the path; total JS shipped is roughly a React runtime *before* any app code; and there's no hydration and no virtual-DOM diff on WS frames — `myDiceKey()` fingerprint gating (including the `roll_count` fix for identical re-rolls) does surgical invalidation a memo-heavy React tree would only approximate.

The cost is equally visible: every reconciliation subtlety (findings 3, 5, and the `roll.js` asymmetry) is a hand-carried invariant. Which is exactly why finding 2 — the unplugged type checker — matters more here than it would in a framework app.
