// @ts-check
/**
 * The app's viewport — which is the window on a phone and is NOT the window
 * anywhere else.
 *
 * Off a phone (a desktop window, an iPad) css/bezel.css draws the app in a
 * phone-sized box in the middle of the page: <body> is that box, every
 * viewport unit in the shell resolves to its size, and <main> scrolls the
 * screens in place of the document. CSS handles all of that on its own. What
 * it cannot reach is the handful of places JS reads the window directly —
 * the die size chosen by width, the scroll offset the nav menu parks and
 * restores, the screen swap's scroll-to-top — and those ask here instead.
 *
 * The signal is the `--bezel-on` custom property the bezel rule sets on
 * <html>, so the media query that decides lives in exactly one place (the
 * stylesheet) and this module never has to agree with it.
 */

import { restScrollTop, restScrollY } from './scroll-fades.js';

/** Whether the app is drawn in the bezel's phone-sized box (bezel.css). */
export function isBezel() {
  return getComputedStyle(document.documentElement).getPropertyValue('--bezel-on').trim() === '1';
}

/**
 * The app's viewport in client coordinates: the window, or under the bezel
 * the box — which is <body>'s border box, since body IS the box.
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function appViewport() {
  if (isBezel()) {
    const r = document.body.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

/** The element that scrolls the screens under the bezel, or null on a phone
 *  (where the document does). */
function screenScroller() {
  return isBezel() ? document.querySelector('main') : null;
}

/** The screens' scroll offset at rest (the rubber-band taken out, §6). */
export function appScrollY() {
  const m = screenScroller();
  return m ? restScrollTop(m) : restScrollY();
}

/**
 * Scroll the screens to `y` — the document on a phone, <main> under the
 * bezel. Under the bezel the nav menu scrolls body instead (bezel.css), so
 * that is put back to its top too: the menu starts at the top every open.
 * @param {number} y
 */
export function appScrollTo(y) {
  const m = screenScroller();
  if (m) {
    m.scrollTop = y;
    document.body.scrollTop = 0;
  } else {
    window.scrollTo(0, y);
  }
}

/**
 * Put the bezel's aside (index.html #bezel-aside) in the top layer, where it
 * can be drawn beside the box rather than clipped inside it. Opened
 * unconditionally: on a phone bezel.css keeps it display: none, so an open
 * popover that never paints costs nothing, and the stylesheet stays the one
 * place that decides. Guarded for engines without the Popover API, which
 * simply never show it.
 */
export function showBezelAside() {
  const aside = document.getElementById('bezel-aside');
  try {
    if (aside && 'showPopover' in aside && !aside.matches(':popover-open')) aside.showPopover();
  } catch {
    /* Not openable (already open, or no top layer here): nothing to show. */
  }
}
