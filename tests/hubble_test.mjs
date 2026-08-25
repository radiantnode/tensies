// Unit tests for the pure core of static/js/hubble.js — the precedence rules
// between the three signals, and the parsing of everything that arrives as
// untrusted text on a URL.
//
//   node --test tests/hubble_test.mjs
//
// Only `classify()` is covered here, on purpose. It holds all the logic and no
// environment, so it can be tested exhaustively and quickly. The wiring around
// it — the sessionStorage latch, the <html> stamp, surviving a router push —
// is behaviour of a real browser and is verified in one, not simulated here.
//
// The module is browser code: importing it evaluates detect() and a localhost
// test seam that both touch globals Node doesn't have. detect() catches its
// own failures by design; the seam does not, so the minimum globals are stubbed
// before the import rather than the module being softened to suit a test.
globalThis.location = /** @type {any} */ ({ search: '', hostname: 'nodetest' });
globalThis.document = /** @type {any} */ ({ referrer: '' });
globalThis.window = /** @type {any} */ (globalThis);

import assert from 'node:assert/strict';
import test from 'node:test';

const { classify } = await import('../static/js/hubble.js');

const HUBBLE = 'https://hubble.on.simmons.network';

/** classify() with the quiet defaults filled in — every test states only the
 *  part of the environment it is actually about. */
const run = (env) => classify({
  search: '', referrer: '', framed: false, stored: null, ...env,
});

const WALL = '?hubble=1&surface=wall&zoom=3';

test('nothing at all is not Hubble', () => {
  const ctx = run({});
  assert.equal(ctx.active, false);
  assert.equal(ctx.source, null);
  assert.equal(ctx.surface, null);
  assert.equal(ctx.zoom, null);
});

test('a plain framed page with no Hubble signal is not Hubble', () => {
  assert.equal(run({ framed: true, referrer: 'https://example.com/' }).active, false);
});

// ── 1. The declaration ───────────────────────────────────────────────────────

test('the param carries the whole context', () => {
  const ctx = run({ search: WALL, framed: true });
  assert.deepEqual({ ...ctx }, {
    active: true, surface: 'wall', zoom: 3, framed: true, source: 'param',
  });
});

test('the param is trusted without being framed, so the wall is reproducible by hand', () => {
  const ctx = run({ search: WALL, framed: false });
  assert.equal(ctx.active, true);
  assert.equal(ctx.zoom, 3);
  // The distinction stays reportable rather than being flattened away.
  assert.equal(ctx.framed, false);
});

test('hubble=0 and a missing hubble param are both not a declaration', () => {
  assert.equal(run({ search: '?hubble=0&zoom=3' }).active, false);
  assert.equal(run({ search: '?surface=wall&zoom=3' }).active, false);
});

test('zoom is clamped to what Hubble itself will emit', () => {
  assert.equal(run({ search: '?hubble=1&zoom=40' }).zoom, 6);
  assert.equal(run({ search: '?hubble=1&zoom=0' }).zoom, 1);
  assert.equal(run({ search: '?hubble=1&zoom=-5' }).zoom, 1);
  assert.equal(run({ search: '?hubble=1&zoom=2.5' }).zoom, 2.5);
});

test('an unreadable zoom is null, not a number nobody meant', () => {
  assert.equal(run({ search: '?hubble=1&zoom=abc' }).zoom, null);
  assert.equal(run({ search: '?hubble=1&zoom=' }).zoom, null);
  assert.equal(run({ search: '?hubble=1' }).zoom, null);
  assert.equal(run({ search: '?hubble=1&zoom=Infinity' }).zoom, null);
});

test('an unknown surface is null but still Hubble', () => {
  const ctx = run({ search: '?hubble=1&surface=fridge' });
  assert.equal(ctx.active, true);
  assert.equal(ctx.surface, null);
});

// ── 2. The referrer ──────────────────────────────────────────────────────────

test('framed by Hubble with no param is Hubble, contextless', () => {
  const ctx = run({ framed: true, referrer: `${HUBBLE}/display` });
  assert.equal(ctx.active, true);
  assert.equal(ctx.source, 'referrer');
  assert.equal(ctx.surface, null);
  assert.equal(ctx.zoom, null);
});

test('framed by anyone else is not Hubble', () => {
  assert.equal(run({ framed: true, referrer: 'https://hubble.example.com/' }).active, false);
  // Same host, wrong scheme — origin comparison, not a substring match.
  assert.equal(run({ framed: true, referrer: 'http://hubble.on.simmons.network/' }).active, false);
});

test('the referrer alone, unframed, is not Hubble', () => {
  // A person following a link from the dashboard is not the dashboard.
  assert.equal(run({ framed: false, referrer: `${HUBBLE}/display` }).active, false);
});

test('an unparseable referrer is inert rather than throwing', () => {
  assert.equal(run({ framed: true, referrer: 'not a url' }).active, false);
});

// ── 3. The latch ─────────────────────────────────────────────────────────────

const STORED = { active: true, surface: 'wall', zoom: 3, framed: true, source: null };

test('the latch carries context forward once the URL has been rewritten', () => {
  const ctx = run({ framed: true, referrer: 'https://tensies-prod.on.simmons.network/', stored: STORED });
  assert.deepEqual({ ...ctx }, {
    active: true, surface: 'wall', zoom: 3, framed: true, source: 'session',
  });
});

test('a latch does not replay into a different kind of context', () => {
  // Written inside the frame, read at top level: refused.
  assert.equal(run({ framed: false, stored: STORED }).active, false);
  // And the mirror of that.
  assert.equal(run({ framed: true, stored: { ...STORED, framed: false } }).active, false);
});

// ── Precedence between them ──────────────────────────────────────────────────

test('a fresh param beats a remembered zoom', () => {
  const ctx = run({ search: '?hubble=1&surface=wall&zoom=5', framed: true, stored: STORED });
  assert.equal(ctx.source, 'param');
  assert.equal(ctx.zoom, 5);
});

test('a declaration that is silent about zoom does not resurrect the old one', () => {
  const ctx = run({ search: '?hubble=1', framed: true, stored: STORED });
  assert.equal(ctx.source, 'param');
  assert.equal(ctx.zoom, null, 'Hubble not saying is null, not a stale 3');
});

test('a referrer match reports itself without blanking a known context', () => {
  // The regression this guards: `source` is the strongest *evidence*, but
  // surface and zoom must come from the best *carrier*. A referrer match
  // carries neither, so it must not overwrite the latch with nulls.
  const ctx = run({ framed: true, referrer: `${HUBBLE}/display`, stored: STORED });
  assert.equal(ctx.source, 'referrer');
  assert.equal(ctx.surface, 'wall');
  assert.equal(ctx.zoom, 3);
});

test('the returned context is frozen', () => {
  const ctx = run({ search: WALL });
  assert.throws(() => { /** @type {any} */ (ctx).zoom = 99; }, TypeError);
});
