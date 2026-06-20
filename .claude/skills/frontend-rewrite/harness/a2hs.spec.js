// Pixel baselines for the Add-to-Home-Screen UI (landing banner + the iOS
// walkthrough). These are interactive + animated states, so they get a
// hand-written spec rather than living in states.json.
//
// The `?a2hs=ios` query is the localhost-only dev override (see a2hs.js) that
// forces the iOS install flow regardless of user-agent, so the gated UI renders
// under the harness's desktop UA.
const { test, expect } = require('./fixtures');
const { seedPage, settle } = require('./determinism');

// seedPage pins Math.random + Date.now, but the mock status-bar clock reads
// `new Date()` — pin the whole Date so that's byte-stable too.
async function pinClock(page) {
  await page.addInitScript(() => {
    const FIXED = 1767225600000; // 2026-01-01T00:00:00Z
    const RealDate = Date;
    // @ts-ignore - test-only shim
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [FIXED])); }
      static now() { return FIXED; }
    };
  });
}

test('a2hs-banner', async ({ page }) => {
  await seedPage(page);
  await pinClock(page);
  await page.goto('/?a2hs=ios');
  await page.waitForSelector('#landing.active');
  await page.waitForSelector('.a2hs-banner');
  await settle(page);
  await expect(page).toHaveScreenshot('a2hs-banner.png');
});

// Each walkthrough step: open the guide, then click the step's dot — that stops
// the auto-advance and pins the phone to that scene — and capture.
for (const n of [1, 2, 3, 4]) {
  test(`a2hs-step${n}`, async ({ page }) => {
    await seedPage(page);
    await pinClock(page);
    await page.goto('/?a2hs=ios');
    await page.waitForSelector('#landing.active');
    await page.click('.a2hs-banner-main');
    await page.waitForSelector('.a2hs-overlay[open]');
    await page.click(`.a2hs-dot[data-step="${n}"]`);
    await page.waitForSelector(`.a2hs-phone[data-step="${n}"]`);
    await settle(page);
    await expect(page).toHaveScreenshot(`a2hs-step${n}.png`);
  });
}
