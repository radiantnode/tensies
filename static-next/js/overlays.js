// Dialog overlays — winner/loser and the non-host pause wait screen. Both sit
// on top of the still-visible game board. (Loading is a screen, not a dialog.)
const winner = document.getElementById('winner-overlay');
if (winner) winner.addEventListener('cancel', (e) => e.preventDefault());

const pauseOverlay = document.getElementById('pause-overlay');
if (pauseOverlay) pauseOverlay.addEventListener('cancel', (e) => e.preventDefault());

// On resume, hold the pause overlay / menu a beat so the toggle's slide-off is
// visible before things close.
export const RESUME_CLOSE_DELAY_MS = 600;

// ── Pause overlay (non-host) ──
export function showPaused(text) {
  document.getElementById('pause-overlay-msg').textContent = text;
  if (pauseOverlay && !pauseOverlay.open) pauseOverlay.showModal();
}
export function hidePaused() {
  if (pauseOverlay && pauseOverlay.open) pauseOverlay.close();
}
// "Waiting for <Host> to resume the game"
export function pausedText(msg) {
  const host = msg.players[msg.host]?.name || 'the host';
  return `Waiting for ${host} to resume the game`;
}

// ── Winner / loser overlay ──
// The server holds the overlay for ROUND_WIN_DELAY (server/config.py) before
// advancing the round — mirror it here to drive the countdown.
const WIN_OVERLAY_MS = 3000;
let winTimer = null;

function startWinTimer() {
  const fill = document.getElementById('winner-timer-fill');
  const secs = document.getElementById('winner-timer-secs');
  const end = Date.now() + WIN_OVERLAY_MS;
  clearInterval(winTimer);
  const tick = () => {
    const remaining = Math.max(0, end - Date.now());
    if (fill) fill.style.width = `${(remaining / WIN_OVERLAY_MS) * 100}%`;
    if (secs) {
      const s = String(Math.ceil(remaining / 1000)).padStart(2, '0');
      secs.textContent = `Next round starts in: ${s}s`;
    }
    if (remaining <= 0) clearInterval(winTimer);
  };
  tick();
  winTimer = setInterval(tick, 50);
}

// `name` is shown under the dice (the winner's name to the winner; the viewer's
// own name to everyone else). `isLoser` flips the banner suffix + logo.
export function showWinner(name, target, round, isLoser = false) {
  const pill = document.getElementById('winner-round');
  if (pill) pill.textContent = round;
  const suffix = document.getElementById('winner-banner-suffix');
  if (suffix) suffix.textContent = isLoser ? 'Loser' : 'Winner';
  const logo = document.querySelector('.winner-logo');
  if (logo) logo.src = isLoser ? '/static/logo-loser.svg' : '/static/logo-winner.svg';
  const nameEl = document.getElementById('winner-name');
  if (nameEl) nameEl.textContent = name;
  startWinTimer();
  if (winner && !winner.open) winner.showModal();
}

export function hideWinner() {
  clearInterval(winTimer);
  if (winner && winner.open) winner.close();
}
