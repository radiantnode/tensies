// globalSetup — two jobs:
//
// 1. Refuse to run against a Chromium build other than the one the baselines
//    were captured with. At maxDiffPixels:0, sub-pixel font hinting differs
//    between Chromium builds and silently produces false diffs, so an accidental
//    browser upgrade would look like a rewrite regression. Fail loud instead.
//    Override with ALLOW_BROWSER_MISMATCH=1 (expect possible noise).
//
// 2. Restart the web service with CREATE_RATE_MAX=9999 so the 25-test suite
//    (each test creates a real game) doesn't exhaust the default 10/min limit.
//    The service is re-upped against the repo-root docker-compose.yml; an
//    already-running container is recreated in-place (same image, new env).
//    After docker compose returns, we poll until the HTTP server actually accepts
//    connections (the container healthcheck passes before uvicorn is ready).
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { chromium } = require('@playwright/test');

// Keep in sync with baselines/CAPTURE-ENV.txt when you re-baseline.
const EXPECTED = '149.0.7827.55';

// Absolute path to the repo root (four levels up from this file).
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const BASE_URL = process.env.TENSIES_URL || 'http://localhost:8888';

function waitForHttp(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const { hostname, port, pathname } = new URL(url);
    function attempt() {
      const req = http.get({ hostname, port: port || 80, path: pathname || '/' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() >= deadline) return reject(new Error(`${url} not ready after ${timeoutMs}ms`));
        setTimeout(attempt, 250);
      });
      req.setTimeout(500, () => { req.destroy(); });
    }
    attempt();
  });
}

module.exports = async () => {
  // ── 1. browser version guard ──────────────────────────────────────────────
  const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE_PATH || undefined });
  const version = browser.version();
  await browser.close();

  if (version === EXPECTED) {
    console.log(`[browser-guard] Chromium ${version} matches baseline build`);
  } else {
    const msg =
      `\n[browser-guard] Chromium ${version} != baseline-capture build ${EXPECTED}.\n` +
      `Pixel baselines are only valid against the exact build they were captured\n` +
      `with. Install the matching browser (@playwright/test ${require('@playwright/test/package.json').version} ` +
      `-> npx playwright install chromium), or point PW_EXECUTABLE_PATH at a\n` +
      `matching Chromium. To override (and accept possible false diffs), set\n` +
      `ALLOW_BROWSER_MISMATCH=1. Do NOT re-baseline just to silence this.\n`;
    if (process.env.ALLOW_BROWSER_MISMATCH) {
      console.warn(msg + '[browser-guard] continuing because ALLOW_BROWSER_MISMATCH is set.');
    } else {
      throw new Error(msg);
    }
  }

  // ── 2. bootstrap server with a raised rate limit ──────────────────────────
  // The suite creates ~25 games; the default CREATE_RATE_MAX (10/min) would
  // exhaust mid-run. Re-up the web service with CREATE_RATE_MAX=9999 so the
  // limiter is never the bottleneck. After docker compose returns we poll until
  // the HTTP server actually accepts connections — the container healthcheck
  // can pass before uvicorn finishes binding.
  console.log('[browser-guard] bootstrapping web service with CREATE_RATE_MAX=9999 …');
  try {
    execSync('docker compose up -d web --wait', {
      cwd: REPO_ROOT,
      env: { ...process.env, CREATE_RATE_MAX: '9999' },
      stdio: 'inherit',
    });
    await waitForHttp(BASE_URL);
    console.log('[browser-guard] web service ready');
  } catch (e) {
    console.warn('[browser-guard] bootstrap failed — proceeding, but rate-limit errors may occur:', e.message);
  }
};
