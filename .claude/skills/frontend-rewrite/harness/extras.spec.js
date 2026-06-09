// States reached through real interaction against the live app (no frame
// synthesis needed — the outcomes are already deterministic).
const { test, expect } = require('./fixtures');
const { seedPage, settle } = require('./determinism');

test('join-error', async ({ page }) => {
  await seedPage(page);
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.click('#show-join-btn');
  await page.waitForSelector('#join.active');
  await page.fill('#join-name-input', 'Alpha');
  await page.fill('#code-input', 'ZZZZZ');           // a code that doesn't exist
  await page.click('#join-form button[type="submit"]');
  await page.waitForFunction(() =>
    (document.getElementById('join-error')?.textContent || '').trim().length > 0);
  await settle(page);
  await expect(page).toHaveScreenshot('join-error.png');
});

test('nav-menu-changelog', async ({ page }) => {
  await seedPage(page);
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.click('#app-header-menu-btn');
  await page.waitForSelector('#nav-menu.open');
  await page.click('.menu-whats-new-btn');
  await page.waitForSelector('#nav-menu.show-changelog');
  await settle(page);
  // The changelog prose is regenerated over time; masking the body keeps this
  // baseline about the panel chrome (header, Back button) and avoids a false
  // diff every time the changelog content changes.
  await expect(page).toHaveScreenshot('nav-menu-changelog.png', {
    mask: [page.locator('.menu-changelog-body')],
  });
});
