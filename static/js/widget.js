// @ts-check
// Standalone script for the /api/widget page (not part of the app bundle —
// fingerprinted separately by scripts/build_assets.mjs, like widget.css).
// Stamps the render time after the health text using the CLIENT clock, so the
// widget snapshot shows when it was last refreshed in the phone's local time.
const el = document.getElementById('updated');
if (el) {
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, '0');
  const ap = now.getHours() < 12 ? 'a' : 'p';
  el.textContent = `Updated ${h}:${m}${ap}`;
}
