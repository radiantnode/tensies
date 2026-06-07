// Pixel-verification harness config — driven by the Playwright CLI, never the MCP.
//
//   TENSIES_URL      where to point the browser (old app for baselines, new app to verify)
//   PIXEL_TOLERANCE  max differing pixels allowed (default 0 = byte-perfect)
//
// Baselines are written to ./baselines and are OS/agnostic by design: the
// snapshot path template omits {platform}, so a baseline captured in the dev
// container compares cleanly against a verify run in the same container.
const { defineConfig } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.TENSIES_URL || 'http://localhost:8888';
const MAX_DIFF = Number(process.env.PIXEL_TOLERANCE || 0);

module.exports = defineConfig({
  testDir: __dirname,
  // Refuse to run against a Chromium build other than the baseline one — a
  // browser upgrade would otherwise masquerade as a rewrite regression.
  globalSetup: require.resolve('./browser-guard.js'),
  // *.example.spec.js are copy-me templates, not runnable specs.
  testIgnore: '**/*.example.spec.js',
  snapshotDir: path.join(__dirname, 'baselines'),
  outputDir: path.join(__dirname, 'results'),
  // <state-name>-<project>.png — stable across machines, one file per viewport.
  snapshotPathTemplate: '{snapshotDir}/{arg}-{projectName}{ext}',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: path.join(__dirname, 'report'), open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    timezoneId: 'UTC',
    locale: 'en-US',
    colorScheme: 'light',
    // Belt-and-suspenders determinism; per-test seedPage() also runs.
    // PW_EXECUTABLE_PATH is an escape hatch for sandboxes that cannot download
    // browsers — point it at an already-installed Chromium of a matching
    // Chromium major (the wire protocol is stable across adjacent builds).
    launchOptions: {
      args: ['--font-render-hinting=none', '--disable-skia-runtime-opts'],
      executablePath: process.env.PW_EXECUTABLE_PATH || undefined,
    },
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: MAX_DIFF,
      // Playwright freezes + fast-forwards finite CSS animations to their end
      // state; seedPage() additionally pauses infinite ones.
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  // Mobile only — Tensies is a phone game. Desktop viewport is not tested.
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true } },
  ],
});
