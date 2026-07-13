// @ts-check

/**
 * iOS Safari double-tap-zoom prevention.
 *
 * Intercepts touchstart in the capture phase (the earliest possible point) so
 * iOS never recognises two quick taps as a zoom gesture:
 * - multi-touch (pinch): always prevented (`maximum-scale=1` covers this too);
 * - double-tap: prevented only for the second tap within 300 ms — but if that
 *   tap targets an interactive control (the roll button, a menu item), it's
 *   converted into a click so rapid tapping keeps working without ever zooming;
 * - first / slow taps: never prevented, clicks fire normally.
 *
 * The synthesized click matters because preventing the touchstart also cancels
 * the browser's emulated click, so without it a quick second tap on e.g. the
 * "Tap to confirm" End Game control would silently do nothing.
 */
const TAPPABLE = '#roll-btn, .menu-item, .btn, button';

export function installTouchGuard() {
  let lastTouchStart = 0;
  document.addEventListener('touchstart', (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
      return;
    }
    const now = Date.now();
    if (now - lastTouchStart <= 300) {
      event.preventDefault();
      const target = /** @type {Element} */ (event.target);
      const hit = /** @type {HTMLElement | null} */ (target.closest?.(TAPPABLE) ?? null);
      if (hit && !(/** @type {HTMLButtonElement} */ (hit).disabled)) hit.click();
    }
    lastTouchStart = now;
  }, { passive: false, capture: true });
}
