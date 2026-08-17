// @ts-check
/**
 * Hubble — whether this document is being framed by the Hubble wall display,
 * and what Hubble told us about the surface it is drawing us on.
 *
 * Detection only. Nothing here changes how Tensies looks or behaves; it
 * answers a question and stamps the answer where CSS and JS can both read it
 * (`<html data-hubble="wall">`). What to *do* about it is a later decision.
 *
 * ## Why this isn't a one-liner
 *
 * Hubble frames us cross-origin (its `apps/tensies/app.js` holds an <iframe>
 * pointed at this origin, and our own `frame-ancestors` names exactly that one
 * page). Cross-origin means we cannot look up at the parent and ask. So the
 * signal has to arrive over the URL, the referrer, or postMessage — and two of
 * those are available *only on the first document load*:
 *
 *   - Tensies is a History-API SPA. The first `pushState` in `router.js`
 *     (/games/{code}, /@username, a join deeplink) rewrites the URL and the
 *     query param is gone.
 *   - `document.referrer` is Hubble's origin on the frame's first load, and
 *     becomes *our own* origin after any in-frame full navigation.
 *
 * So the rule is: work it out once, latch it, and never re-derive it. The
 * latch is sessionStorage — per-tab, and in a partitioned browser per-frame
 * too, which is exactly the scope we want.
 *
 * ## The three signals, strongest first
 *
 *   1. `?hubble=1&surface=wall&zoom=3` — Hubble puts this on the iframe src.
 *      The only signal that carries *context* rather than a bare boolean.
 *   2. Framed, with `document.referrer` on Hubble's origin. Corroboration,
 *      and the fallback if the param is ever dropped.
 *   3. The sessionStorage latch, for every load after the first.
 *
 * A deliberate choice in (1): **the param is trusted on its own, without
 * requiring that we are framed.** That makes the wall's exact conditions
 * reproducible by hand — open the URL with the param in a normal tab and you
 * get the same state to develop against. The frame check would make that
 * impossible, and it is not buying security: anyone who can set the query
 * string can set the referrer's worth of trust too. `framed` is reported
 * separately so a caller that genuinely needs "really on the wall" can ask.
 */

/** The one page our `frame-ancestors` admits, per `.env.prod`'s
 *  CONTENT_SECURITY_POLICY. Written out here as a third copy of that string —
 *  the other two being the CSP itself and Hubble's own `FRAMED_FROM` — because
 *  it cannot be shared across two repositories and a policy header. If the
 *  wall ever moves origin, all three move together. */
const HUBBLE_ORIGIN = 'https://hubble.on.simmons.network';

/** Latch key. sessionStorage, not localStorage: the answer is a property of
 *  this browsing context, and it should not outlive the tab or leak into one
 *  opened later by a person. */
const STORAGE_KEY = 'tensies_hubble';

/** Surfaces Hubble knows how to be. Anything else is recorded as unknown
 *  rather than believed — a value we do not understand should not become a
 *  CSS selector nobody wrote a rule for. */
const SURFACES = ['wall'];

/** Hubble clamps its own zoom to 1–6 (`apps/tensies/app.js`). Mirrored, not
 *  trusted: this arrives as text on a URL, and the whole point of the number
 *  is that something downstream will size against it. */
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

/**
 * @typedef {object} HubbleContext
 * @property {boolean} active   True when Hubble is holding this document.
 * @property {string | null} surface  Where Hubble is drawing us — 'wall', or
 *   null when it did not say (or said something this version doesn't know).
 * @property {number | null} zoom  Hubble's scale factor, 1–6. At 3 the frame
 *   is laid out at a third of the panel's CSS pixels and drawn three times
 *   over, so a 44px control lands as 132px on the wall.
 * @property {boolean} framed  Whether we are in an iframe at all. Independent
 *   of `active`: a hand-opened `?hubble=1` is active and not framed.
 * @property {'param' | 'referrer' | 'session' | null} source  How we know,
 *   this load. Null when inactive.
 */

/** @type {HubbleContext} */
const INACTIVE = Object.freeze({
  active: false,
  surface: null,
  zoom: null,
  framed: false,
  source: null,
});

/**
 * Read a zoom out of untrusted text.
 * @param {string | null} raw
 * @returns {number | null}
 */
function readZoom(raw) {
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));
}

/**
 * Read a surface out of untrusted text.
 * @param {string | null} raw
 * @returns {string | null}
 */
function readSurface(raw) {
  return raw !== null && SURFACES.includes(raw) ? raw : null;
}

/**
 * The origin half of a referrer, or null if it isn't a URL.
 * @param {string} referrer
 * @returns {string | null}
 */
function referrerOrigin(referrer) {
  if (!referrer) return null;
  try {
    return new URL(referrer).origin;
  } catch {
    return null;
  }
}

/**
 * The pure core: environment in, context out. No DOM, no storage, no side
 * effects — so the precedence rules can be tested directly rather than
 * inferred from a browser's behaviour.
 *
 * @param {object} env
 * @param {string} env.search  `location.search`, leading '?' optional.
 * @param {string} env.referrer  `document.referrer`.
 * @param {boolean} env.framed  Whether this document is in a frame.
 * @param {HubbleContext | null} env.stored  The latch, if one was readable.
 * @returns {HubbleContext}
 */
export function classify({ search, referrer, framed, stored }) {
  const params = new URLSearchParams(search);

  // 1. The declaration Hubble puts on the iframe src.
  const declared = params.get('hubble') === '1';

  // 2. Framed by Hubble, without the param — an older Hubble, or a load that
  //    dropped the query string. Proves *who* is holding us and nothing else.
  const byReferrer = framed && referrerOrigin(referrer) === HUBBLE_ORIGIN;

  // 3. The latch. Only replayed into the same kind of context it was written
  //    in: one written inside the frame must not activate a top-level tab on
  //    this origin, and vice versa. Browsers that partition frame storage give
  //    us that for free; the check is for the ones that don't.
  const latched = stored && stored.framed === framed ? stored : null;

  if (!declared && !byReferrer && !latched) return INACTIVE;

  // Evidence and context are two different questions, and conflating them is
  // the mistake worth avoiding here. `source` reports the *strongest evidence*
  // this load; surface and zoom come from the *best carrier*. A referrer match
  // is strong evidence carrying no context, so on a load where it fires
  // alongside a latch it must not blank a known zoom back to null.
  //
  // A declaration is authoritative even where it is silent: `?hubble=1` with
  // no zoom means Hubble is not saying, and null is a better answer to that
  // than a remembered number from a previous arrangement.
  const surface = declared ? readSurface(params.get('surface')) : latched?.surface ?? null;
  const zoom = declared ? readZoom(params.get('zoom')) : latched?.zoom ?? null;

  return Object.freeze({
    active: true,
    surface,
    zoom,
    framed,
    source: declared ? 'param' : byReferrer ? 'referrer' : 'session',
  });
}

/**
 * Read the latch. Storage can be unavailable outright (a partitioned frame
 * with storage blocked, private mode, quota) — that is a missing signal, not
 * an error, so it degrades to null.
 * @returns {HubbleContext | null}
 */
function readLatch() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      active: true,
      surface: readSurface(parsed.surface),
      zoom: readZoom(parsed.zoom === null ? null : String(parsed.zoom)),
      framed: parsed.framed === true,
      source: null,
    };
  } catch {
    return null;
  }
}

/**
 * Write the latch. Same reasoning as {@link readLatch} for the swallow: a
 * browser that won't store this is a browser we re-derive on next load from
 * the referrer, which is a worse answer but not a broken one.
 * @param {HubbleContext} ctx
 */
function writeLatch(ctx) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      surface: ctx.surface,
      zoom: ctx.zoom,
      framed: ctx.framed,
    }));
  } catch {
    /* Not storable. Signal (2) still covers the next load inside the frame. */
  }
}

/**
 * Work out the context from the live environment, latch it, and stamp it on
 * <html> so CSS can select on it.
 *
 * Wrapped whole: this module is imported first by `app.js`, before component
 * registration and before the router, so anything it throws takes the entire
 * app down with it. A detection module is never worth that, and "we are not
 * in Hubble" is the correct answer to give when we cannot tell.
 *
 * @returns {HubbleContext}
 */
function detect() {
  try {
    const ctx = classify({
      search: location.search,
      referrer: document.referrer,
      framed: window.top !== window.self,
      stored: readLatch(),
    });

    if (ctx.active) {
      writeLatch(ctx);
      // Presence is "Hubble is holding us" (html[data-hubble]); the value is
      // which surface (html[data-hubble="wall"]). A surface we don't recognise
      // is named as such rather than left to look like the wall.
      document.documentElement.dataset.hubble = ctx.surface ?? 'unknown';
    }

    return ctx;
  } catch {
    return INACTIVE;
  }
}

/**
 * This document's Hubble context, resolved once at import.
 * @type {HubbleContext}
 */
export const hubble = detect();

/** Whether Hubble is holding this document. */
export function isHubble() {
  return hubble.active;
}

// Test seam, matching the one in state.js: exposed as window._hubble on
// localhost only, so the harness suites can assert on the resolved context
// through evaluate(). Never present on a public deploy — which includes the
// wall, so this is not how the wall gets checked.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  /** @type {any} */ (window)._hubble = hubble;
}
