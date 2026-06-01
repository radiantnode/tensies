// Overlays. hideWinner is real; showWinner stays stubbed until the winner view.
// The pause overlay (non-host wait screen) is a body-level <dialog>.
const pauseOverlay = document.getElementById('pause-overlay');

// On resume, hold the pause overlay / menu a beat so the toggle's slide-off is
// visible before things close.
export const RESUME_CLOSE_DELAY_MS = 600;

export function hideWinner() {
  const w = document.getElementById('winner-overlay');
  if (w && w.open) w.close();
}

export function showWinner(/* name, target, round, isLoser */) {
  // Built in the winner view.
}

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
