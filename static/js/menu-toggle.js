// @ts-check
/**
 * Rapid-tap guard shared by the hamburger menus (nav menu + in-game menu).
 *
 * A menu open/close is a CSS fade, and the touch guard synthesizes a click
 * alongside the native one on a quick second tap — so an unguarded toggle can
 * thrash open↔closed on rapid taps (the "rapid-tap break"). This wraps the
 * toggle so taps landing while a fade is mid-flight are ignored.
 *
 * @param {object} opts
 * @param {() => boolean} opts.isOpen  current open state
 * @param {() => void} opts.open       open the menu
 * @param {() => void} opts.close      close the menu
 * @param {number} [opts.ms]  lock window; must stay a touch longer than the
 *   menu's opacity-fade duration in CSS so the state always fully settles.
 * @returns {() => void} a guarded toggle handler
 */
export function makeMenuToggle({ isOpen, open, close, ms = 320 }) {
  /** @type {number} truthy (a timer id) while a fade is mid-flight. */
  let lock = 0;
  return () => {
    if (lock) return;
    if (isOpen()) close();
    else open();
    clearTimeout(lock);
    lock = window.setTimeout(() => { lock = 0; }, ms);
  };
}
