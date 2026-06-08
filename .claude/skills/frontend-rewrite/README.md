# Frontend rewrite skill

A pixel-perfect frontend verification system. When I rewrite or change the UI, this makes sure the result looks exactly like the original. Not "looks about right" — byte-for-byte identical at the pixel level. Pass/fail is arithmetic on PNG bytes, not a judgment call.

**[TESTS.md](TESTS.md)** covers all 25 states with inline screenshots, what each one checks, and a direct link to the spec code. Start there.

---

## The core idea

The web UI renders entirely from WebSocket frames. That one fact makes everything else possible. A single real connection can synthesize any view in the app — mid-game boards, pause overlays, disconnected peers, round winners — by rewriting the inbound `state` frame into whatever I need. No real multiplayer session required.

Combined with a deterministic client (pinned `Math.random`, pinned `Date.now`, frozen animations, settled fonts), the screenshots come out byte-identical on every run. Capture those as baselines, verify any future change against them, and any 1-pixel difference fails the run.

---

## How to run it

```bash
# One-time setup
cd harness && npm install && npx playwright install chromium

# Verify the current app against committed baselines
npm run verify

# Re-capture baselines before a planned visual change
npm run baseline

# Check a single view
npm run verify:one game-board
```

The harness bootstraps itself: `globalSetup` in `browser-guard.js` restarts the web service with a raised rate limit before the suite runs, then polls until the HTTP server is actually accepting connections. Nothing to prep manually.

---

## Three ways to capture a state

Not every state is reachable the same way. The harness uses three strategies.

### 1. Static (`views.spec.js` + `states.json`)

States that need nothing from the server. Navigate to a URL, click through a few steps, screenshot. Landing, join screen, nav menu all fall here.

```json
{
  "name": "nav-menu-open",
  "type": "static",
  "path": "/",
  "steps": [
    { "waitFor": "#landing.active" },
    { "click": "#landing-menu-btn" },
    { "waitFor": "#nav-menu.open" }
  ]
}
```

### 2. Real interaction (`extras.spec.js`)

States that need the live server to produce a real outcome: a join with a bad code, a changelog panel after a real network round-trip. Drive the app the way a user would.

### 3. Synthesized (`stateful.spec.js`)

The main technique. Open a real WebSocket connection, intercept every inbound frame with `pinWebSocket`, and rewrite the `state` payload into the view I want. One connection, any view.

```js
await pinWebSocket(page, (msg, myPid) => {
  if (msg.type === 'state') return {
    ...msg,
    started: true, paused: true, host: myPid,
    round_num: 1, target: 3, pause_remaining_ms: 3600000,
    players: { /* exact roster */ },
  };
  return msg;
});
```

The key detail: capture the real `player_id` from the `welcome` frame. Host-vs-guest rendering keys off whether `state.host` matches your own pid. Set it to your pid for the host view; set it to someone else's for the guest view. Same connection, completely different UI.

---

## Making screenshots byte-stable

Screenshots of a live app are non-deterministic by default. Dice scatter randomly, countdowns count down, animations are mid-frame. These three helpers eliminate all of that without touching app code.

**`seedPage(page)`** — call before `page.goto()`. Injects a fixed-seed `Math.random` (mulberry32) and a frozen `Date.now` into the page before any app script runs. Pins dice scatter, player-name placeholders, and all time-derived UI like the pause countdown and winner timer.

**`settle(page)`** — call after reaching the target state, right before the screenshot. Waits for `document.fonts.ready`, then injects a `<style>` that pauses all infinite animations and hides text carets. One `requestAnimationFrame` flushes the styles before capture.

**`pinWebSocket(page, transform)`** — routes the WebSocket connection through a transform function. Each parsed inbound frame goes through `transform(msg)`; whatever it returns is what the page sees. Combined with `seedPage`, this makes server-driven views byte-stable.

Playwright's own `animations: 'disabled'` setting handles finite CSS animations, fast-forwarding them to their end state.

The proof that it worked: a second verify run is always zero-diff. If anything leaked, run two goes red.

---

## Engineering standard

Every view this system protects was built to these rules. Anything new should follow the same.

- Vanilla web components, light DOM. No framework, no build step. Each screen is a custom element whose host element *is* the `#id.screen`, so global CSS applies unchanged. Light DOM (not shadow) because the design uses cross-screen selectors and `view-transition-name` morphs that don't survive a shadow boundary.
- No inline styles. The server sends `style-src 'self'` CSP. All CSS lives in `static/css/`. The harness sets `bypassCSP: true` only for the test context so `settle()`'s `addStyleTag` works.
- No copy-paste. A utility used in two places becomes a module function. A markup pattern used in two places becomes a custom element or an exported template string.
- Keyed DOM updates. Dynamic lists update elements in place by player id. No `innerHTML` wipes on every WebSocket frame — that resets scatter, breaks animations, and is slow.
- `disconnectedCallback` for every `document.addEventListener`. Store the bound handler on `this._handler` in `connectedCallback`; remove it in `disconnectedCallback`. Components that skip this accumulate listeners if re-parented.
- `prefers-reduced-motion` in JS too. CSS `animation-duration: 0.001ms` suppresses visuals but does nothing to `setTimeout` delays that pace an animation. Any JS timer that exists only to pace an animation has to check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and collapse to zero.
- Images in `static/images/`, not the `static/` root.

---

## Adding a new test

1. Baseline first. Before touching any code, capture the current state of every affected view: `npm run baseline:one <view>`. Commit the baseline before the change so the diff is attributable.

2. Pick the right approach. Static for no-server states, real interaction for outcomes that need a round-trip, synthesized for anything server-driven.

3. For synthesized states, copy the `host()` helper from `stateful.spec.js`. Write a `pinWebSocket` transform that produces the view you want, and gate the screenshot on a state-unique selector. Not just `#screen.active`, but something only that state shows: `#winner-overlay[open]`, `#menu-pause-status:not([hidden])`, the error text, etc.

4. Gating on the right selector matters. A mis-rendered state that silently fell back to the loading screen still screenshots something and would bake a wrong baseline. See the `fatal-error` test for the pattern: wait until `landing.active AND loading NOT active AND error text present`.

5. Add a row to `TESTS.md` with the inline screenshot and a link to the spec line.

6. Run `npm run verify` twice in a row. Both must be zero-diff. If run two differs from run one, there is a determinism leak.

---

## Lessons learned the hard way

**The rate-limit trap.** The suite creates about 25 real games. The server's default `CREATE_RATE_MAX` (10/min) exhausted mid-run, producing silent failures where tests appeared to time out but were actually hitting an error on the landing screen. The fix: `globalSetup` bootstraps the server with `CREATE_RATE_MAX=9999`. That lives in the harness, not in `docker-compose.yml`.

**Baselines captured under rate-limiting are wrong.** When `npm run baseline` ran with the limit active, some tests timed out and their baseline files were never written. They silently kept stale files from a previous run. Always confirm baselines were written: re-run verify immediately after baseline, and a clean verify proves the baselines are live.

**`--wait` is not enough.** Docker Compose's `--wait` flag waits for the container healthcheck to pass, not for uvicorn to start accepting TCP connections. The `globalSetup` polls the HTTP endpoint directly after `docker compose up` returns.

**The view-transition morph races with state delivery.** `showScreen()` returns early if the target screen is already active mid-transition. A fatal error delivered too soon after `create` strands the user on the loading screen with the error set but hidden. The `fatal-error` test delays the error 900ms to reproduce production timing. This is also a latent app bug: any faster fatal path would surface it.

**Disconnected peers route the board to loading.** `showFor` sends the viewer to the reconnect screen when any player has `disconnected:true`, unless the game is paused (the paused branch runs first). To screenshot a disconnected player-card in the bar, the frame has to be `paused:true`. That is why `players-bar-variants` is a paused board.

**`waitForSelector` on a closed menu hangs forever.** A closed `#game-menu` is `display:none`. Playwright's default `waitForSelector` waits for visible and never resolves. Use `waitForFunction` on the class, or pass `{ state: 'hidden' }` to wait for it to disappear.

---

## Files

| Path | Purpose |
|------|---------|
| [TESTS.md](TESTS.md) | All 25 states with inline screenshots and spec links |
| [skill.md](skill.md) | Full engineering spec — read before building anything |
| [harness/](harness/) | The Playwright test suite |
| [harness/determinism.js](harness/determinism.js) | `seedPage`, `settle`, `pinWebSocket` |
| [harness/stateful.spec.js](harness/stateful.spec.js) | Synthesized server-driven states — copy from here |
| [harness/extras.spec.js](harness/extras.spec.js) | Real-interaction states |
| [harness/views.spec.js](harness/views.spec.js) | Data-driven static states from `states.json` |
| [harness/browser-guard.js](harness/browser-guard.js) | `globalSetup`: browser version guard and server bootstrap |
| [harness/NOTES.md](harness/NOTES.md) | WS frame shapes, selector cheat-sheet, gotchas, full state catalog |
| [harness/baselines/](harness/baselines/) | Committed ground-truth PNGs |
