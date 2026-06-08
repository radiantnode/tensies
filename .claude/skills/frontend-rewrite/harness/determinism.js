// Determinism helpers — make every screenshot byte-stable WITHOUT touching app
// code. Everything here is injected from the outside at capture time.
//
// What is NOT solved here: dice values come from the SERVER (apply_roll), so a
// client-side Math.random stub does not pin them. For server-driven state
// (game board mid-round, players bar), intercept the WebSocket instead — see
// pinWebSocket() below and multiplayer.example.spec.js.

// Runs in the page BEFORE any app script. Pins client-side randomness so the
// generated player-name placeholder, game code, and any client RNG are stable.
function seedScript() {
  // mulberry32 — deterministic, fixed seed.
  let s = 0x9e3779b9 >>> 0;
  Math.random = function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Pin time-derived UI (countdowns, "now") to a fixed instant.
  const FIXED = 1767225600000; // 2026-01-01T00:00:00Z
  Date.now = () => FIXED;
  if (typeof performance !== 'undefined') {
    const realNow = performance.now.bind(performance);
    let base = null;
    performance.now = () => { if (base === null) base = realNow(); return realNow() - base; };
  }
}

// Call BEFORE page.goto() so the seed lands ahead of app scripts.
async function seedPage(page) {
  await page.addInitScript(seedScript);
}

// Call AFTER reaching the target state, immediately before the screenshot.
// Waits for web fonts, then hard-pauses infinite animations and hides carets.
async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-play-state:paused!important;` +
      `transition:none!important;caret-color:transparent!important}`,
  });
  // One rAF so the paused styles flush before capture.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
}

// For server-driven views: rewrite inbound `state`/`round_won` WS frames so dice
// and roster are deterministic. `transform(msg)` receives the parsed frame and
// returns the (mutated) frame. Requires Playwright >= 1.48 (routeWebSocket).
async function pinWebSocket(page, transform) {
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((raw) => {
      try {
        const msg = JSON.parse(raw);
        ws.send(JSON.stringify(transform(msg) ?? msg));
      } catch {
        ws.send(raw); // pass binary / non-JSON through untouched
      }
    });
    ws.onMessage((raw) => server.send(raw)); // client -> server unchanged
  });
}

module.exports = { seedPage, settle, pinWebSocket };
