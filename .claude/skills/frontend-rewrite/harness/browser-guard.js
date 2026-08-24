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
//
//    This step is DELIBERATELY CONSERVATIVE, because it used to be a foot-gun.
//    It ran a bare `docker compose up -d web` in the repo root, which resolves
//    the project name from the directory (`tensies`) and applies the repo-root
//    docker-compose.yml (dev). On a host where that project name belongs to a
//    *different* stack — e.g. elite01, where `tensies` is the live prod stack
//    behind nginx on 8888 — this recreated the production web container with
//    dev config, failed to bind an already-held port, and left it dead. It did
//    that regardless of TENSIES_URL, and the catch below swallowed the error,
//    so the suite still went green while the site was down (2026-08-20, ~14 min).
//
//    Three rules now, in order:
//      a. TENSIES_SKIP_BOOTSTRAP=1     -> never touch docker.
//      b. target already serving        -> leave it alone (it's someone's stack).
//      c. TENSIES_URL set to non-default-> skip; we cannot know which compose
//                                          project owns that URL, and guessing
//                                          is what caused the outage.
//    Only a default URL that is NOT answering will bring a stack up, and even
//    then the compose file/project can be pinned explicitly via
//    TENSIES_COMPOSE_FILE / TENSIES_COMPOSE_PROJECT.
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { chromium } = require('@playwright/test');

// Keep in sync with baselines/CAPTURE-ENV.txt when you re-baseline.
const EXPECTED = '149.0.7827.55';

// Absolute path to the repo root (four levels up from this file).
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const DEFAULT_URL = 'http://localhost:8888';
const BASE_URL = process.env.TENSIES_URL || DEFAULT_URL;

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

/** Resolve true if `url` answers an HTTP request within `timeoutMs`. */
function isServing(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const { hostname, port, pathname } = new URL(url);
    const req = http.get({ hostname, port: port || 80, path: pathname || '/' }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
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
  // Read the long note at the top of this file before loosening any of this.
  const RATE_NOTE = 'CREATE_RATE_MAX was NOT raised — if the run hits '
    + '"Too many games created", restart that stack yourself with CREATE_RATE_MAX=9999.';

  if (process.env.TENSIES_SKIP_BOOTSTRAP) {
    console.log(`[browser-guard] TENSIES_SKIP_BOOTSTRAP set — not touching docker. ${RATE_NOTE}`);
    return;
  }

  // Already serving? Then a stack we do not own is running there. Never
  // recreate it: that is exactly the outage this guard exists to prevent.
  if (await isServing(BASE_URL)) {
    console.log(`[browser-guard] ${BASE_URL} is already serving — leaving it alone. ${RATE_NOTE}`);
    return;
  }

  // A custom URL that isn't up: we cannot infer which compose project owns it,
  // and guessing means recreating some other stack's containers.
  if (BASE_URL !== DEFAULT_URL) {
    throw new Error(
      `\n[browser-guard] ${BASE_URL} is not answering, and TENSIES_URL is set to a\n`
      + `non-default target, so this script will NOT guess which compose project owns\n`
      + `it. Start that stack yourself, then re-run. For the design stack:\n`
      + `  docker compose -f docker-compose.design.yml up -d\n`,
    );
  }

  // Default URL, nothing serving it: safe to bring the dev stack up. Pin the
  // file/project explicitly when the ambient project name is not the dev one.
  const file = process.env.TENSIES_COMPOSE_FILE;
  const project = process.env.TENSIES_COMPOSE_PROJECT;
  const cmd = ['docker compose']
    .concat(file ? [`-f ${file}`] : [])
    .concat(project ? [`-p ${project}`] : [])
    .concat(['up -d web --wait'])
    .join(' ');

  console.log(`[browser-guard] ${BASE_URL} is down — bootstrapping: ${cmd}`);
  try {
    execSync(cmd, {
      cwd: REPO_ROOT,
      env: { ...process.env, CREATE_RATE_MAX: '9999' },
      stdio: 'inherit',
    });
    await waitForHttp(BASE_URL);
    console.log('[browser-guard] web service ready');
  } catch (e) {
    // Loud, not swallowed. A silent failure here is how a green suite hid a
    // downed production stack for fourteen minutes.
    throw new Error(
      `\n[browser-guard] bootstrap FAILED: ${e.message}\n`
      + `If this says "port is already allocated", another stack owns that port —\n`
      + `do not retry, work out which project it is first (docker ps).\n`
      + `To run without any docker interaction: TENSIES_SKIP_BOOTSTRAP=1\n`,
    );
  }
};
