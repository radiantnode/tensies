// @ts-check

/**
 * Add-to-Home-Screen orchestration: platform detection + install plumbing.
 *
 * Apple gives iOS Safari no install prompt — the only path is the Share sheet's
 * "Add to Home Screen" — so we surface an animated walkthrough instead. Android
 * Chrome *does* fire `beforeinstallprompt`; we stash it and fire the native
 * dialog on demand, with the same walkthrough as a fallback.
 *
 * Detection is purely UA-based and returns null on desktop / in-app browsers /
 * already-installed, so the banner + menu entry never render where they'd be
 * meaningless (the pixel harness runs a desktop-Linux UA → null → nothing).
 */

const DISMISS_KEY = 'tensies_a2hs_dismissed';

/** Captured Android `beforeinstallprompt` event, replayed by the guide's CTA. */
/** @type {any} */
let deferredPrompt = null;

/** True when launched from the home screen (installed PWA) — nothing to offer. */
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || /** @type {any} */ (window.navigator).standalone === true;
}

/**
 * Dev-only override (`?a2hs=ios|android` on localhost) so the gated UI can be
 * driven in a desktop browser / Playwright without spoofing the whole UA.
 * @returns {'ios'|'android'|null}
 */
function forcedPlatform() {
  const host = location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return null;
  try {
    const q = new URLSearchParams(location.search).get('a2hs');
    if (q === 'ios' || q === 'android') return q;
  } catch { /* malformed query — ignore */ }
  return null;
}

/**
 * Which install flow applies, or null when none.
 * - `ios`     → Safari Share-sheet walkthrough (no native prompt exists)
 * - `android` → native prompt (with a ⋮-menu walkthrough fallback)
 * @returns {'ios'|'android'|null}
 */
export function getPlatform() {
  const forced = forcedPlatform();
  if (forced) return forced;
  if (isStandalone()) return null;

  const ua = navigator.userAgent;
  // iPadOS 13+ reports a desktop Safari UA, so fall back to the touch-Mac tell.
  const isIOS = /iphone|ipad|ipod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    // Add to Home Screen is a Safari-only affordance; Chrome/Firefox/Edge on
    // iOS can't do it, so the walkthrough would only mislead.
    if (/crios|fxios|edgios/i.test(ua)) return null;
    return 'ios';
  }
  if (/android/i.test(ua)) return 'android';
  return null;
}

/** Whether the user has dismissed the landing banner before. */
export function bannerDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

/** Remember that the landing banner was dismissed (it won't re-offer). */
export function dismissBanner() {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode — fine */ }
}

/** Whether to auto-offer the landing banner (installable + not yet dismissed). */
export function shouldOfferInstall() {
  return getPlatform() !== null && !bannerDismissed();
}

/** Whether a native (Android) install prompt is currently available. */
export function hasNativePrompt() {
  return deferredPrompt !== null;
}

/**
 * Fire the captured native install prompt, if any.
 * @returns {Promise<boolean>} whether the user accepted.
 */
export async function triggerNativeInstall() {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  prompt.prompt();
  try {
    const { outcome } = await prompt.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

/**
 * Wire the global install lifecycle listeners. Called once at app boot.
 * Captures the Android prompt and tears the offer down once installed.
 */
export function setupInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Suppress Chrome's mini-infobar; we drive the prompt from our own UI.
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    dismissBanner();
    document.dispatchEvent(new CustomEvent('a2hs-installed'));
  });
}

/**
 * Open the install walkthrough for the current (or forced) platform.
 * Routed through a document-level event so the banner and the nav menu don't
 * need a direct handle on the <a2hs-guide> element.
 */
export function openGuide() {
  const platform = getPlatform();
  if (!platform) return;
  document.dispatchEvent(new CustomEvent('a2hs-open', { detail: { platform } }));
}

/**
 * The primary install action (banner CTA). On Android with a captured native
 * prompt there's nothing to teach — fire Chrome's one-tap install dialog
 * directly. Everywhere else (Android without a prompt — Firefox, in-app
 * browsers, criteria-not-met — or iOS, which has no install API at all) fall
 * back to the step-by-step walkthrough.
 */
export async function requestInstall() {
  const platform = getPlatform();
  if (!platform) return;
  if (platform === 'android' && hasNativePrompt()) {
    await triggerNativeInstall();
    return;
  }
  openGuide();
}
