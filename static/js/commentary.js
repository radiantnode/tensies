// @ts-check

/**
 * TAS commentary display — shows/hides text above the roll button.
 * @module
 */

/** @type {ReturnType<typeof setTimeout> | null} */
let hideTimer = null;

/**
 * Show TAS commentary above the roll button, then fade it out.
 * @param {string} text
 */
export function showCommentary(text) {
  const el = document.getElementById('tas-commentary');
  if (!el) return;

  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

  el.textContent = text;
  el.classList.remove('fading');
  // Force reflow so removing 'fading' takes effect before adding 'visible'.
  void el.offsetWidth;
  el.classList.add('visible');

  hideTimer = setTimeout(() => {
    el.classList.add('fading');
    hideTimer = setTimeout(() => {
      el.classList.remove('visible', 'fading');
      hideTimer = null;
    }, 500);
  }, 3000);
}

/** Clear any visible commentary immediately (e.g. on re-render). */
export function hideCommentary() {
  const el = document.getElementById('tas-commentary');
  if (el) {
    el.classList.remove('visible', 'fading');
    el.textContent = '';
  }
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
}
