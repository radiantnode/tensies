// @ts-check

/**
 * Get an element the shell guarantees to exist, throwing if it doesn't.
 * Centralises the null-check that `document.getElementById` forces on every
 * caller; a miss here is a programming error, not a recoverable state.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Required element #${id} is missing`);
  return el;
}

/**
 * HTML-escape a value for interpolation into an innerHTML template string.
 * Server-sourced strings (names, locations, photo URLs) must pass through
 * here at the interpolation site — sanitize_name upstream is defense in
 * depth, not a licence for output-unsafe templates.
 * @param {unknown} value
 * @returns {string}
 */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c
  ));
}
