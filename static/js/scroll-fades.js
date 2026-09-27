// @ts-check

/**
 * Edge-fade affordances for inner scrollers: `can-scroll-up` / `can-scroll-down`
 * on a scrollable element so CSS can fade the edges where content is hidden.
 *
 * Written the way iOS Safari needs it (iOS Safari Gotchas §5–§6):
 *  - Scrolling runs on the compositor and the `scroll` event lands late during
 *    a fling, so a handler that computes state in that event paints a frame
 *    behind the page. While the element is moving, the state is read from a
 *    requestAnimationFrame loop instead — started on touchstart/wheel so it is
 *    already up when the fling begins, stood down after a few still frames.
 *  - Taking a fade is immediate; giving one up waits RELEASE_MS of agreement,
 *    with a timeout so the release still lands after the loop stops. One odd
 *    frame cannot flash a fade off and on.
 *  - iOS reports the rubber-band as an offset outside the content (scrollTop
 *    below 0 at the top, past the maximum at the bottom). Geometry is read at
 *    rest — the bounce taken back out — so a hard flick to an end cannot
 *    misfire the fade.
 */

const RELEASE_MS = 120;
const STILL_FRAMES = 10;

/**
 * Where a scroller's offset would be at rest: its scrollTop with the
 * rubber-band overscroll taken back out (§6).
 * @param {HTMLElement} el
 */
export function restScrollTop(el) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  return Math.min(Math.max(el.scrollTop, 0), max);
}

/** The document's scroll offset at rest — window.scrollY without the bounce (§6). */
export function restScrollY() {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(Math.max(window.scrollY, 0), max);
}

/** @typedef {{ 'can-scroll-up'?: number | null, 'can-scroll-down'?: number | null }} Releases */
/** @type {WeakMap<HTMLElement, Releases>} */
const releases = new WeakMap();

/**
 * @param {HTMLElement} el
 * @param {'can-scroll-up' | 'can-scroll-down'} cls
 */
function wants(el, cls) {
  const top = restScrollTop(el);
  return cls === 'can-scroll-up'
    ? top > 1
    : top + el.clientHeight < el.scrollHeight - 1;
}

/**
 * @param {HTMLElement} el
 * @param {'can-scroll-up' | 'can-scroll-down'} cls
 * @param {boolean} instant
 */
function settle(el, cls, instant) {
  let r = releases.get(el);
  if (!r) { r = {}; releases.set(el, r); }
  const want = wants(el, cls);
  if (want || instant) {
    const pending = r[cls];
    if (pending) { clearTimeout(pending); r[cls] = null; }
    el.classList.toggle(cls, want);
    return;
  }
  // Release: only after the geometry has said "no" for a beat.
  if (!el.classList.contains(cls) || r[cls]) return;
  r[cls] = setTimeout(() => {
    r[cls] = null;
    if (!wants(el, cls)) el.classList.remove(cls);
  }, RELEASE_MS);
}

/**
 * Sync the fade classes to the element's geometry. `instant` applies both
 * directions at once with no release hold — for renders and resizes, where
 * the geometry changed rather than the scroll position.
 * @param {HTMLElement} el
 * @param {{ instant?: boolean }} [options]
 */
export function updateScrollFades(el, { instant = false } = {}) {
  settle(el, 'can-scroll-up', instant);
  settle(el, 'can-scroll-down', instant);
}

/**
 * Apply the fades for a first paint with transitions off (§7): a state set
 * before the element's first paint would otherwise start a CSS transition in
 * WebKit that parks at its start and shows the previous state for a second.
 * @param {HTMLElement} el
 */
export function primeScrollFades(el) {
  el.setAttribute('data-boot', '');
  updateScrollFades(el, { instant: true });
  void el.offsetHeight;
  el.removeAttribute('data-boot');
}

/**
 * Keep an element's fades in step with its scrolling: a rAF loop while it is
 * moving (§5), started on scroll, touchstart and wheel, stood down after
 * STILL_FRAMES frames without movement. Returns a disposer.
 * @param {HTMLElement} el
 */
export function followScrollFades(el) {
  let running = false;
  let still = 0;
  let seen = -1;
  const frame = () => {
    if (!running) return;
    const y = el.scrollTop;
    if (y === seen) still++; else { still = 0; seen = y; }
    updateScrollFades(el);
    if (still > STILL_FRAMES) { running = false; return; }
    requestAnimationFrame(frame);
  };
  const follow = () => {
    still = 0;
    if (!running) { running = true; requestAnimationFrame(frame); }
  };
  const opts = { passive: true };
  el.addEventListener('scroll', follow, opts);
  el.addEventListener('touchstart', follow, opts);
  el.addEventListener('wheel', follow, opts);
  return () => {
    running = false;
    el.removeEventListener('scroll', follow);
    el.removeEventListener('touchstart', follow);
    el.removeEventListener('wheel', follow);
  };
}
