// Home-screen widget (/api/widget) pixel baselines.
//
// Unlike every other view, the widget is a standalone SERVER-rendered HTML card,
// not the SPA. So we stub the /api/widget response with the REAL template
// (static/html/widget.html) substituted with deterministic data — exactly the
// $-placeholder fill server/widget.py does. The real widget.css / widget.js /
// logo load as ordinary /static sub-resources from the dev server, so the actual
// stylesheet and script stay under pixel test; only the backend DATA is synthetic
// (the same philosophy as the profile / game-detail route stubs in auth.spec.js).
//
// widget.js stamps the render time with `new Date()`. seedPage() pins Date.now,
// which `new Date()` ignores, so the stamp would drift — we fully pin Date here
// (the a2hs pattern). timezoneId is UTC in the config, so the frozen instant
// renders a fixed "Updated 12:00a".
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');
const { seedPage, settle } = require('./determinism');

const TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../../../../static/html/widget.html'), 'utf8');

// Fill the real template's $-placeholders the way server/widget.py does. Assets
// stay real /static/... URLs so the dev server serves the file under test.
function render(fields) {
  const subs = {
    refresh: '300',
    css_href: '/static/css/widget.css',
    js_href: '/static/js/widget.js',
    logo_href: '/static/images/logo.svg',
    ...fields,
  };
  let html = TEMPLATE;
  for (const [k, v] of Object.entries(subs)) html = html.split('$' + k).join(v);
  return html;
}

// One recent-games <li>, byte-for-byte the _ROW markup in server/widget.py.
const row = (code, matchup, ago) =>
  `      <li><span class="code">${code}</span>`
  + `<span class="matchup">${matchup}</span>`
  + `<span class="ago">${ago}</span></li>`;

// Covers every _matchup shape (vs / solo / +N), a name pair long enough to
// trip the .matchup ellipsis, and each _ago bucket (now/m/h/d) — plus enough
// rows to overflow the card so the bottom fade mask is exercised.
const POPULATED_ROWS = [
  row('FWQYI', 'Shifty Octopus vs Jazzy Panda', 'now'),
  row('VNDNP', 'Salty Penguin (solo)', '3m'),
  row('AQJBO', 'Grumpy Yak vs Alpha +2', '18m'),
  row('WHMAE', 'Verylongusername McLongface vs Anotherlongname', '2h'),
  row('UDTMJ', 'Bravo vs Cosmo', '5h'),
  row('RPXKV', 'TestUser (solo)', '1d'),
  row('SSSFA', 'Jazzy Panda vs Salty Penguin +1', '2d'),
  row('QLMZR', 'Alpha vs Bravo', '4d'),
].join('\n');

const EMPTY_ROW = '      <li class="empty">No finished games yet</li>';

// Fully pin Date so widget.js's `new Date()` render-time stamp is byte-stable.
async function pinDate(page) {
  await page.addInitScript(() => {
    const FIXED = 1767225600000; // 2026-01-01T00:00:00Z
    const Real = Date;
    const Fake = function (...a) { return a.length ? new Real(...a) : new Real(FIXED); };
    Fake.prototype = Real.prototype;
    Fake.now = () => FIXED;
    Fake.parse = Real.parse;
    Fake.UTC = Real.UTC;
    window.Date = Fake;
  });
}

async function openWidget(page, html) {
  await seedPage(page);
  await pinDate(page);
  await page.route('**/api/widget**', (route) => route.fulfill({
    status: 200, contentType: 'text/html; charset=utf-8', body: html,
  }));
  // The card is a wide web widget (~440×203), not a phone screen. Capture at its
  // target width (the .card clamps its own height to 203); element-clipped to
  // .card below, the way rotate-overlay uses a bespoke viewport.
  await page.setViewportSize({ width: 440, height: 240 });
  await page.goto('/api/widget?key=test');
  await page.waitForSelector('.card');
  // Wait until the real widget.js has stamped the (pinned) render time.
  await page.waitForFunction(() =>
    document.getElementById('updated')?.textContent?.startsWith('Updated'));
  await settle(page);
}

test('widget-populated', async ({ page }) => {
  // Healthy system: green dot, live/playing/today counts, and the recent list.
  await openWidget(page, render({
    health_class: 'ok',
    health_text: 'All systems go',
    active: '3',
    online: '2',
    today: '12',
    rows: POPULATED_ROWS,
  }));
  await expect(page.locator('.card')).toHaveScreenshot('widget-populated.png');
});

test('widget-empty', async ({ page }) => {
  // Telemetry DB offline: amber "warn" dot, "–" today count, empty games row.
  await openWidget(page, render({
    health_class: 'warn',
    health_text: 'Stats DB offline',
    active: '0',
    online: '0',
    today: '–',
    rows: EMPTY_ROW,
  }));
  await expect(page.locator('.card')).toHaveScreenshot('widget-empty.png');
});
