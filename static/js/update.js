// @ts-check

/**
 * Keeping the installed PWA fresh.
 *
 * iOS freezes a standalone PWA's page in memory and resumes it on reopen
 * without reloading the document — so a warm resume can sit on an old build
 * indefinitely. Two independent freshness signals guard against that, sharing
 * one response:
 *
 *   1. The service worker's own update lifecycle — a byte-different /sw.js is
 *      found on navigation (and on the resume poll below). The primary path.
 *   2. The WS `welcome` frame's build id vs the <meta name="app-build"> the
 *      page loaded with — a belt-and-suspenders check that fires even when the
 *      SW hasn't polled yet, or when no SW is available at all.
 *
 * When either says "the server is newer", we reload immediately if it's safe
 * (see AUTO_RELOAD_SCREENS) or surface a tap-to-refresh banner otherwise, so we
 * never yank a player out of a live round.
 */

// ── Idle policy — the ONE place to change when auto-reload is allowed ────────
// A detected update reloads on its own ONLY while one of these is the active
// screen; anywhere else we show the banner and let the player choose. Widen
// this list (e.g. add 'join', 'lobby') to make auto-reload more eager.
const AUTO_RELOAD_SCREENS = ['landing'];

/** sessionStorage key: the build we last auto-reloaded toward (loop guard). */
const RELOADED_KEY = 'tensies_reloaded_build';

let waitingWorker = /** @type {ServiceWorker | null} */ (null);
let updatePending = false;      // an update is ready but deferred (banner shown)
let expectingActivation = false; // we asked a waiting SW to take over
let reloading = false;           // reload-exactly-once guard

function activeScreenId() {
  return document.querySelector('.screen.active')?.id ?? null;
}

function safeToAutoReload() {
  const id = activeScreenId();
  return id !== null && AUTO_RELOAD_SCREENS.includes(id);
}

/** The build the page was served with, from <meta name="app-build">. */
function pageBuild() {
  const meta = document.querySelector('meta[name="app-build"]');
  return meta instanceof HTMLMetaElement ? meta.content : '';
}

function reloadOnce() {
  if (reloading) return;
  reloading = true;
  location.reload();
}

/** Apply a ready update: hand off to the waiting SW, or just reload. */
function applyUpdate() {
  hideBanner();
  if (waitingWorker) {
    expectingActivation = true;
    waitingWorker.postMessage('skipWaiting');
  } else {
    reloadOnce();
  }
}

// ── Tap-to-refresh banner ───────────────────────────────────────────────────
// Built in JS and hidden until needed, so it never touches first paint or the
// pixel baselines. Styled by css/update.css (no inline styles — the CSP forbids
// them).
let banner = /** @type {HTMLButtonElement | null} */ (null);

function ensureBanner() {
  if (banner) return banner;
  const el = document.createElement('button');
  el.id = 'update-banner';
  el.className = 'update-banner';
  el.type = 'button';
  el.hidden = true;
  el.textContent = 'New version available — tap to refresh';
  el.addEventListener('click', applyUpdate);
  document.body.appendChild(el);
  banner = el;
  return el;
}

function showBanner() {
  const el = ensureBanner();
  el.hidden = false;
  el.classList.add('is-visible');
}

function hideBanner() {
  if (!banner) return;
  banner.hidden = true;
  banner.classList.remove('is-visible');
}

/**
 * An update is ready. Apply now if we're on a safe screen; otherwise show the
 * banner and wait for the player (or their next visit to a safe screen).
 * @param {ServiceWorker | null} waiting
 */
function onUpdateReady(waiting) {
  updatePending = true;
  waitingWorker = waiting;
  if (safeToAutoReload()) applyUpdate();
  else showBanner();
}

/**
 * The server reports its build id in the welcome frame. If it differs from the
 * build the page loaded with, the server is newer — treat it as an update.
 * @param {string | undefined} serverBuild
 */
export function checkServerBuild(serverBuild) {
  if (!serverBuild) return;
  const mine = pageBuild();
  if (!mine || mine === serverBuild) return;
  // Loop guard: auto-reload toward a given build at most once (a stale
  // intermediary serving old HTML could otherwise reload us forever). After
  // that, only ever offer the banner.
  const alreadyTried = sessionStorage.getItem(RELOADED_KEY) === serverBuild;
  if (safeToAutoReload() && !alreadyTried) {
    sessionStorage.setItem(RELOADED_KEY, serverBuild);
    onUpdateReady(waitingWorker); // may be null -> plain reload
  } else {
    updatePending = true;
    showBanner();
  }
}

/**
 * Register the service worker, wire its update lifecycle, and re-check for
 * updates whenever the app returns to the foreground.
 */
export function setupUpdates() {
  // Even without a SW, a banner-deferred update should auto-apply once the
  // player drifts onto a safe screen and the app is refocused.
  const onResume = () => {
    if (document.visibilityState !== 'visible') return;
    if (updatePending && safeToAutoReload()) applyUpdate();
  };
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('pageshow', onResume);

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').then((reg) => {
    // A worker installed by a previous page load may already be waiting.
    if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // installed + an existing controller => an UPDATE, not the first-ever
        // install (which has no controller and must stay silent).
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          onUpdateReady(reg.waiting || installing);
        }
      });
    });

    // Poll for a new SW when the app comes back to the foreground — iOS skips
    // this on a warm resume, which is exactly when a PWA drifts out of date.
    const poll = () => { reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') poll();
    });
    window.addEventListener('pageshow', poll);
  }).catch(() => {
    // SW unavailable (private mode, unsupported context) — the app still works;
    // the welcome-frame build check remains as the freshness fallback.
  });

  // The new worker took control after skipWaiting -> load the fresh assets
  // once. Guarded so the first-install clients.claim() doesn't reload the page.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (expectingActivation) reloadOnce();
  });
}
