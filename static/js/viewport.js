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
  for (const id of ['bezel-aside', 'bezel-foot']) {
    const el = document.getElementById(id);
    try {
      if (el && 'showPopover' in el && !el.matches(':popover-open')) el.showPopover();
    } catch {
      /* Not openable (already open, or no top layer here): nothing to show. */
    }
  }
  playBezelFoot();
}

/**
 * Mikey plays in under the phone — simmonstx.com's end-card choreography, cue
 * for cue (Base.astro): the discs pop with overshoot while the whole mark
 * turns a quarter in from the left, the bore opens, the eyes pop and blink,
 * the two lines wipe in beside him (the place line rising, the legal line
 * fading up with its tracking settling), and a second blink. Once; nothing
 * loops. The site waits for its band to scroll into view; here the footer
 * is on screen from the first paint, so it plays at once.
 *
 * Only under the bezel (the footer is display: none on a phone), and not for
 * someone who has asked for reduced motion or a browser without the Web
 * Animations API — they get the finished lockup as the HTML draws it.
 */
function playBezelFoot() {
  const foot = document.getElementById('bezel-foot');
  const mark = foot?.querySelector('.bezel-foot-mark');
  if (!foot || !mark || !isBezel() || !('animate' in mark)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const back = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const out = 'cubic-bezier(0.33, 1, 0.68, 1)';
  const inout = 'cubic-bezier(0.65, 0, 0.35, 1)';
  /** @param {Element} el @param {Keyframe[]} frames @param {KeyframeAnimationOptions} opts */
  const add = (el, frames, opts) => el.animate(frames, { fill: 'both', ...opts });
  const [discA, discB] = mark.querySelectorAll('.mikey__disc');
  const bore = mark.querySelector('.mikey__bore');
  const eyes = mark.querySelectorAll('.mikey__eye');
  const places = foot.querySelectorAll('.bezel-foot-place');
  const legal = foot.querySelector('.bezel-foot-legal');
  if (!discA || !discB || !bore || eyes.length < 2 || !places.length || !legal) return;
  add(mark, [{ transform: 'rotate(-90deg)' }, { transform: 'rotate(0deg)' }], { duration: 1300, easing: out });
  add(discA, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 550, easing: back });
  add(discB, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 550, delay: 180, easing: back });
  add(bore, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 600, delay: 700, easing: inout });
  // One timeline per eye: the pop, then a blink at 2.1s and at 5.1s. The eyes
  // sit on a 45° line, so a lid closes along the face's own vertical — the
  // down-right diagonal — not the page's.
  /** @param {number} sx @param {number} sy */
  const tilt = (sx, sy) => `rotate(-45deg) scale(${sx}, ${sy}) rotate(45deg)`;
  /** @param {number} delay */
  const eye = (delay) => {
    const D = 5400;
    /** @param {number} t */
    const at = (t) => t / D;
    /** @param {number} t */
    const blink = (t) => [
      { offset: at(t), transform: tilt(1, 1), easing: inout },
      { offset: at(t + 80), transform: tilt(1, 0.1) },
      { offset: at(t + 100), transform: tilt(1, 0.1), easing: inout },
      { offset: at(t + 200), transform: tilt(1, 1) },
    ];
    return [
      { offset: 0, transform: tilt(0, 0) },
      { offset: at(delay), transform: tilt(0, 0), easing: back },
      { offset: at(delay + 350), transform: tilt(1, 1) },
      ...blink(2100), ...blink(5100),
      { offset: 1, transform: tilt(1, 1) },
    ];
  };
  add(eyes[0], eye(1400), { duration: 5400 });
  add(eyes[1], eye(1520), { duration: 5400 });
  // The lines reveal left to right at full width, so nothing reflows and
  // Mikey never moves; the place line rises as it comes.
  const wipe = [{ clipPath: 'inset(-10px 100% -10px 0)' }, { clipPath: 'inset(-10px 0% -10px 0)' }];
  for (const place of places) {
    add(place, wipe, { duration: 900, delay: 2400, easing: inout });
    add(place, [{ transform: 'translateY(24px)' }, { transform: 'translateY(0)' }], { duration: 850, delay: 2450, easing: out, composite: 'add' });
  }
  add(legal, wipe, { duration: 900, delay: 2400, easing: inout });
  add(legal, [{ opacity: 0, letterSpacing: '0.06em' }, { opacity: 1, letterSpacing: '0em' }], { duration: 900, delay: 3000, easing: out });
}
