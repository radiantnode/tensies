// Data-driven specs for single-page ("static") states listed in states.json.
// Each produces one byte-exact snapshot per viewport project. Complex,
// server-driven, or multi-player states get their own hand-written spec
// (see multiplayer.example.spec.js) — do NOT try to force them into this file.
const { test, expect } = require('./fixtures');
const fs = require('fs');
const path = require('path');
const { seedPage, settle } = require('./determinism');

const file = path.join(__dirname, 'states.json');
const states = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8')).filter((s) => s.type === 'static')
  : [];

for (const s of states) {
  test(s.name, async ({ page }) => {
    await seedPage(page);
    await page.goto(s.path || '/');
    for (const step of s.steps || []) {
      if (step.click) await page.click(step.click);
      if (step.fill) await page.fill(step.fill.selector, step.fill.value);
      if (step.press) await page.press(step.press.selector, step.press.key);
      if (step.eval) await page.evaluate(step.eval);
      if (step.waitFor) await page.waitForSelector(step.waitFor);
    }
    await settle(page);
    await expect(page).toHaveScreenshot(`${s.name}.png`, s.screenshot || {});
  });
}
