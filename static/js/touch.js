// Prevent double-tap zoom on iOS Safari.
//
// We intercept touchstart in capture phase (earliest possible point) so iOS
// never gets a chance to recognise two quick taps as a zoom gesture.
// - Multi-touch (pinch): always prevented (maximum-scale=1 covers this too).
// - Double-tap: prevented only for the 2nd tap within 300 ms — the roll button
//   is disabled by then anyway, so the blocked click is always a no-op.
// - First tap / slow taps: default is never prevented, clicks fire normally.

let lastTouchStart = 0;

document.addEventListener('touchstart', function (e) {
  if (e.touches.length > 1) {
    e.preventDefault();
    return;
  }
  const now = Date.now();
  if (now - lastTouchStart <= 300) {
    e.preventDefault();
    // Even though we're blocking the zoom gesture, if this tap was aimed at
    // the roll button and the button is ready, treat it as a click. This way
    // rapid tapping keeps rolling without ever triggering zoom.
    const btn = document.getElementById('roll-btn');
    if (btn && !btn.disabled && e.target.closest && e.target.closest('#roll-btn')) {
      btn.click();
    }
  }
  lastTouchStart = now;
}, { passive: false, capture: true });
