// Shared test fixture: fail any capture/verify whose page logged a JS error.
// This is the guard against baking (or passing) a WRONG baseline — a state that
// silently mis-rendered (e.g. a JS exception left it on the loading screen) often
// still screenshots *something*. A console.error / uncaught exception means the
// state isn't what we think, so refuse it rather than trust the pixels.
//
// Import { test, expect } from here instead of '@playwright/test'.
const base = require('@playwright/test');

// Benign noise that isn't a render-correctness signal. Extend deliberately.
const IGNORE = [
  /favicon/i,
  /Failed to load resource: net::ERR_/i,
];

const test = base.test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) {
        errors.push(`console.error: ${m.text()}`);
      }
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await use(page);

    base.expect(errors, `page logged JS errors during capture:\n${errors.join('\n')}`).toEqual([]);
  },
});

module.exports = { test, expect: base.expect };
