// @ts-check
import { byId } from './dom.js';

/**
 * Screen swaps via the View Transitions API, plus the loading-screen
 * minimum-duration gate. Single source of truth for "show this screen" —
 * every navigation goes through here so the loading↔landing morph and
 * cross-fades stay consistent.
 */

const MIN_LOADING_MS = 600;
let loadingShownAt = Date.now();

/**
 * A resolved stand-in for a ViewTransition, returned when no document-wide
 * transition runs (target already active, or the API is unsupported).
 * @returns {{ finished: Promise<void>, updateCallbackDone: Promise<void>, ready: Promise<void> }}
 */
function settledTransition() {
  const done = Promise.resolve();
  return { finished: done, updateCallbackDone: done, ready: done };
}

/**
 * Make `id` the active screen, animated with a view transition when available.
 * Already-active targets are left untouched (a document-wide transition would
 * stomp on in-flight animations); callers still get an awaitable handle.
 * @param {string} id Screen element id: 'loading' | 'landing' | 'join' | 'lobby' | 'game'.
 */
export function showScreen(id) {
  const target = byId(id);
  if (target.classList.contains('active')) return settledTransition();
  const swap = () => {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    target.classList.add('active');
  };
  if (document.startViewTransition) return document.startViewTransition(swap);
  swap();
  return settledTransition();
}

/**
 * Swap to the loading screen with the given message and start its
 * minimum-display clock.
 * @param {string} [text]
 */
export function showLoading(text = 'Loading…') {
  byId('loading-msg').textContent = text;
  loadingShownAt = Date.now();
  showScreen('loading');
}

/**
 * Run `action` once the loading screen has been visible for at least
 * MIN_LOADING_MS (from the last showLoading, or module load = initial paint).
 * Keeps the loading bar from flashing for a single frame.
 * @param {() => void} action
 */
export function leaveLoading(action) {
  const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - loadingShownAt));
  if (remaining === 0) requestAnimationFrame(action);
  else setTimeout(action, remaining);
}
