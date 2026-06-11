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
 *
 * `force` skips that early-return. It exists for the fatal-error path: when a
 * terminal error lands while a previous swap's view transition hasn't applied
 * yet, the target can still read as "active" and a plain call would no-op —
 * stranding the user on the loading screen with the error set but invisible.
 * Forcing re-runs the swap (the browser skips the in-flight transition), so
 * the resting state is guaranteed.
 *
 * `onSwap` runs at the moment the screen state is committed: inside the view
 * transition's update phase right after the class flip (so layout-dependent
 * work — the dice scatter needs the zone's pixel rect — sees the screen
 * displayed, and the board is complete before the transition's first animated
 * frame), or synchronously when the target is already active.
 *
 * `staged` takes the non-view-transition path for screens with 3-D content:
 * the target is built invisibly at its final geometry (`.staging`) while the
 * current screen stays up, then the current screen dissolves over the live,
 * complete result (`.dissolving`). No raster is ever taken, so WebKit's
 * preserve-3d flattening (the Safari dice bug) can't occur, and the outgoing
 * overlay covers the board until the dice are rendered.
 * @param {string} id Screen element id: 'loading' | 'landing' | 'join' | 'lobby' | 'game'.
 * @param {{ force?: boolean, staged?: boolean, onSwap?: () => void }} [options]
 */
export function showScreen(id, { force = false, staged = false, onSwap } = {}) {
  const target = byId(id);
  if (!force && target.classList.contains('active')) {
    onSwap?.();
    return settledTransition();
  }
  if (staged) {
    target.classList.add('staging');
    onSwap?.();
    // Commit a frame later: the staged content is laid out (and the dice
    // placed against the real rect) before the reveal.
    requestAnimationFrame(() => {
      const previous = /** @type {HTMLElement | null} */ (document.querySelector('.screen.active'));
      document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
      target.classList.remove('staging');
      target.classList.add('active');
      if (previous && previous !== target) {
        previous.classList.add('dissolving');
        const settle = () => {
          previous.classList.remove('dissolving');
          previous.removeEventListener('transitionend', onEnd);
        };
        /** @param {TransitionEvent} event */
        const onEnd = (event) => {
          // Child transitions bubble — only the overlay's own opacity fade counts.
          if (event.target === previous && event.propertyName === 'opacity') settle();
        };
        previous.addEventListener('transitionend', onEnd);
        setTimeout(settle, 700); // fallback: a swallowed event can't strand a ghost overlay
      }
    });
    return settledTransition();
  }
  const swap = () => {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    target.classList.add('active');
    onSwap?.();
  };
  if (document.startViewTransition) {
    const transition = document.startViewTransition(() => {
      // The 3-D dice must not be rasterized by the transition: WebKit flattens
      // preserve-3d in the new-view capture, stacking all six faces (every die
      // reads as a 6; 90°-rotated ones vanish edge-on). `vt-settling` hides
      // them (game.css) for the duration; added before swap() so dice created
      // by onSwap's render are born hidden, removed once the transition
      // settles — `.finally` so a skipped transition can't strand the class.
      target.classList.add('vt-settling');
      swap();
    });
    transition.finished.finally(() => target.classList.remove('vt-settling'));
    return transition;
  }
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
