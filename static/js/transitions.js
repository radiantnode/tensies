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
 * TRIAL (design stack, 2026-08-19, awaiting the owner's call): route every
 * non-instant swap through the staged/dissolve path instead of a view
 * transition. A VT shows a flat raster of the incoming screen, and a raster
 * cannot run a live backdrop-filter — so on iOS the glass can only frost
 * AFTER the cross-fade lands (content first, blur second). The staged path
 * keeps the incoming screen live from frame one: ground, content, and the
 * frost ramp arrive together under the old screen's dissolve, and the whole
 * class of VT raster artifacts (flattened dice, the radar-sweep jump, the
 * late frost) can't occur. Set false to restore view transitions.
 */
const DISSOLVE_NAV = true;

/**
 * Document-scroll mode (owner-directed, 2026-08-19): the PROFILE reads as a
 * normal web page — the document itself scrolls, so long content is never
 * clipped by an inner scroller and iOS Safari collapses its chrome on
 * scroll. Every other screen keeps the fixed app shell. Applied at screen
 * COMMIT (never earlier): flipping the shell to static mid-swap would
 * collapse the outgoing screen's 100% height for a frame. The CSS half
 * lives in critical.css under `html.doc-scroll`.
 * @param {string} id the screen being committed
 */
function setDocScroll(id) {
  const on = id === 'profile';
  document.documentElement.classList.toggle('doc-scroll', on);
  // iOS 26 Safari ignores theme-color entirely (researched 2026-08-19) and
  // samples its liquid-glass tint from an edge-hugging fixed element's
  // background-color, falling back to body's. Give it a deliberate target —
  // the page's own floor — so the pill's tint belongs to the imagery. The
  // strip shows ~4px of floor-black at the screen's very bottom edge, which
  // is invisible over the profile's dark ground. (theme-color stays in the
  // document untouched: iOS ≤18 and Android still read it.)
  let strip = document.getElementById('chrome-tint-strip');
  if (on && !strip) {
    strip = document.createElement('div');
    strip.id = 'chrome-tint-strip';
    strip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(strip);
  } else if (!on) {
    strip?.remove();
  }
  // iOS Safari's LARGE viewport still excludes the collapsed-address-bar
  // strip, and it reports safe-area insets of 0 in scrolling-tab mode
  // (measured on device, 2026-08-19: sat=0 sab=0, 100lvh=815 on a taller
  // screen) — so no CSS unit can reach the bottom band. JS can: the gap is
  // screen.height − 100lvh, fed to the bleed rule as --chrome-gap. Guarded
  // to phone-chrome-sized gaps so desktop windows and the wall (where
  // screen.height has nothing to do with the viewport) never apply it.
  if (on) {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:-10px;width:1px;height:100lvh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const gap = screen.height - probe.offsetHeight;
    probe.remove();
    const apply = gap > 0 && gap <= 80 ? gap : 0;
    document.documentElement.style.setProperty('--chrome-gap', apply + 'px');
  }
  // Entering: start at the top. Leaving: shed any scroll offset before the
  // fixed shell (overflow: hidden) comes back and would trap it.
  window.scrollTo(0, 0);
}

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
 * `instant` skips the view transition and swaps synchronously. Use it for a
 * screen whose first paint animates (e.g. the nearby radar's spinning sweep): a
 * VT would snapshot the sweep at one angle, let the live animation advance
 * during the cross-fade, then jump to the live angle at handoff — a visible
 * flicker. A plain swap has no snapshot, so there's nothing to jump from.
 * @param {string} id Screen element id: 'loading' | 'landing' | 'join' | 'lobby' | 'game'.
 * @param {{ force?: boolean, staged?: boolean, instant?: boolean, onSwap?: () => void }} [options]
 */
export function showScreen(id, { force = false, staged = false, instant = false, onSwap } = {}) {
  const target = byId(id);
  // Reveal the fixed game-board background only on the game screen (see the
  // #game-bg layer in critical.css). Set before any early return so every
  // enter/exit path — staged, view-transition, or plain — stays in sync.
  const inGame = id === 'game';
  document.body.classList.toggle('in-game', inGame);
  // playIntro pauses the landing video on game start; resume it whenever we
  // leave the game so the background isn't frozen back on landing/lobby.
  if (!inGame) {
    const bg = /** @type {HTMLVideoElement | null} */ (document.getElementById('bg-video'));
    if (bg?.paused) bg.play().catch(() => {});
  }
  if (!force && target.classList.contains('active')) {
    onSwap?.();
    return settledTransition();
  }
  if (staged || (DISSOLVE_NAV && !instant)) {
    target.classList.add('staging');
    onSwap?.();
    // Commit a frame later: the staged content is laid out (and the dice
    // placed against the real rect) before the reveal.
    requestAnimationFrame(() => {
      const previous = /** @type {HTMLElement | null} */ (document.querySelector('.screen.active'));
      // Let the outgoing screen tear down timers/listeners — the router toggles
      // .active rather than removing screens, so disconnectedCallback never fires.
      if (previous && previous !== target) /** @type {any} */ (previous).leave?.();
      document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
      target.classList.remove('staging');
      target.classList.add('active');
      setDocScroll(id);
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
    const previous = /** @type {HTMLElement | null} */ (document.querySelector('.screen.active'));
    // Give the outgoing screen a chance to clean up (see the staged branch).
    if (previous && previous !== target) /** @type {any} */ (previous).leave?.();
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    target.classList.add('active');
    setDocScroll(id);
    onSwap?.();
  };
  if (!instant && document.startViewTransition) {
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
