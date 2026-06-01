// globalSetup — refuses to run against a Chromium build other than the one the
// baselines were captured with. At maxDiffPixels:0, sub-pixel font hinting
// differs between Chromium builds and silently produces false diffs, so an
// accidental browser upgrade would look like a rewrite regression. Fail loud
// instead. Override with ALLOW_BROWSER_MISMATCH=1 (expect possible noise).
const { chromium } = require('@playwright/test');

// Keep in sync with baselines/CAPTURE-ENV.txt when you re-baseline.
const EXPECTED = '141.0.7390.37';

module.exports = async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE_PATH || undefined });
  const version = browser.version();
  await browser.close();

  if (version === EXPECTED) {
    console.log(`[browser-guard] Chromium ${version} matches baseline build`);
    return;
  }
  const msg =
    `\n[browser-guard] Chromium ${version} != baseline-capture build ${EXPECTED}.\n` +
    `Pixel baselines are only valid against the exact build they were captured\n` +
    `with. Install the matching browser (@playwright/test ${require('@playwright/test/package.json').version} ` +
    `-> npx playwright install chromium), or point PW_EXECUTABLE_PATH at a\n` +
    `matching Chromium. To override (and accept possible false diffs), set\n` +
    `ALLOW_BROWSER_MISMATCH=1. Do NOT re-baseline just to silence this.\n`;
  if (process.env.ALLOW_BROWSER_MISMATCH) {
    console.warn(msg + '[browser-guard] continuing because ALLOW_BROWSER_MISMATCH is set.');
    return;
  }
  throw new Error(msg);
};
