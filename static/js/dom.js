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
