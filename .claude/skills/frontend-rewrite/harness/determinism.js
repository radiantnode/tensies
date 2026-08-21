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
  //
  // Stubbing Date.now() ALONE is not enough, and the gap was live for a while:
  // `new Date()` with no arguments reads the system clock directly and does not
  // consult Date.now, so anything built that way stayed un-pinned. The lobby
  // stamp's date (stampDate() in components/lobby-stamp.js) is exactly that, so
  // the baselines silently encoded whatever day they were captured on. The
  // failure is indirect and easy to misread: the spec masks `.stamp-date`, but a
  // date whose glyphs have different widths resizes the element, which resizes
  // the MASK, and the mask edge is the diff. Seen 2026-08-21 — five lobby tests
  // failing on 40 pixels because "20" became "21".
  //
  // So pin the constructor too. Argument-taking forms are left alone; only the
  // no-arg "now" case is redirected.
  const FIXED = 1767225600000; // 2026-01-01T00:00:00Z
  const RealDate = Date;
  // eslint-disable-next-line no-global-assign
  Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(FIXED);
      else super(...args);
    }
    static now() { return FIXED; }
  };
  // Date.parse / Date.UTC come along via static inheritance.
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
  // Freeze any autoplaying <video> (the landing/intro background videos) to a
  // fixed frame. CSS-animation pausing below doesn't touch video playback, so a
  // looping bg-video otherwise never yields two stable consecutive screenshots.
  // Seek to the MIDPOINT (not 0, which is the black first frame) so the captured
  // background shows real content; the frame at a fixed timestamp is identical
  // across capture and verify, so it stays deterministic.
  await page.evaluate(() => Promise.all(
    [...document.querySelectorAll('video')].map((v) => new Promise((res) => {
      let done = false;
      const finish = () => { if (!done) { done = true; res(); } };
      const freeze = () => {
        try {
          v.pause();
          v.loop = false;
          const mid = (v.duration && isFinite(v.duration)) ? v.duration / 2 : 0;
          v.addEventListener('seeked', finish, { once: true });
          v.currentTime = mid;
        } catch { finish(); }
      };
      if (v.readyState >= 1 /* HAVE_METADATA: duration is known */) freeze();
      else v.addEventListener('loadedmetadata', freeze, { once: true });
      setTimeout(finish, 600); // safety net if no seek/metadata event fires
    })),
  ));
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
