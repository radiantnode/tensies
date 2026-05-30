import { nextTarget, showScreen } from './util.js';

// Winner and pause are dialog overlays — they sit on top of the still-visible
// game board. Loading is a screen (see #loading in index.html), not a dialog,
// and is driven via showLoading().

const winner = document.getElementById('winner-overlay');
if (winner) winner.addEventListener('cancel', e => e.preventDefault());

const pauseOverlay = document.getElementById('pause-overlay');
if (pauseOverlay) pauseOverlay.addEventListener('cancel', e => e.preventDefault());

export function showPaused(text) {
  document.getElementById('pause-overlay-msg').textContent = text;
  if (pauseOverlay && !pauseOverlay.open) pauseOverlay.showModal();
}

export function hidePaused() {
  if (pauseOverlay && pauseOverlay.open) pauseOverlay.close();
}

export function showWinner(name, target) {
  document.getElementById('winner-name').textContent = name;
  document.getElementById('winner-sub').textContent = `Next up: roll for ${nextTarget(target)}s`;
  if (winner && !winner.open) winner.showModal();
}

export function hideWinner() {
  if (winner && winner.open) winner.close();
}

// Minimum time #loading stays on screen before the next swap. Stops the bar
// from flashing in and out on fast connections (especially local dev).
const MIN_LOADING_MS = 600;
// Start counting from module load — covers the initial HTML paint, which
// happens before any showLoading() call.
let loadingShownAt = Date.now();

export function showLoading(text = 'Loading…') {
  document.getElementById('loading-msg').textContent = text;
  loadingShownAt = Date.now();
  showScreen('loading');
}

// Run `action` after #loading has been visible for at least MIN_LOADING_MS,
// measured from the most recent showLoading() (or module load, which is
// effectively the initial HTML paint of #loading). If enough time has
// already passed, just runs on the next animation frame.
export function leaveLoading(action) {
  const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - loadingShownAt));
  if (remaining === 0) requestAnimationFrame(action);
  else setTimeout(action, remaining);
}

// Non-host waiting screen while the game is paused.
export function pausedText(msg) {
  const host = msg.players[msg.host]?.name || 'the host';
  return `Waiting for ${host} to resume the game`;
}

// Build the "Waiting for A and B to reconnect…" text from a name list.
export function waitingText(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `Waiting for ${names[0]} to reconnect…`;
  return `Waiting for ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} to reconnect…`;
}
