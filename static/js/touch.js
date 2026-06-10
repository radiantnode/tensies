// @ts-check

/**
 * iOS Safari double-tap-zoom prevention.
 *
 * Intercepts touchstart in the capture phase (the earliest possible point) so
 * iOS never recognises two quick taps as a zoom gesture:
 * - multi-touch (pinch): always prevented (`maximum-scale=1` covers this too);
 * - double-tap: prevented only for the second tap within 300 ms — but if that
 *   tap targets a ready roll button, it's converted into a click so rapid
 *   tapping keeps rolling without ever zooming;
 * - first / slow taps: never prevented, clicks fire normally.
 */
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
      const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
      const target = /** @type {Element} */ (event.target);
      if (btn && !btn.disabled && target.closest?.('#roll-btn')) btn.click();
    }
    lastTouchStart = now;
  }, { passive: false, capture: true });
}
