import { nextTarget } from './util.js';

export function showWinner(name, target) {
  document.getElementById('winner-name').textContent = name;
  document.getElementById('winner-sub').textContent = `Next up: roll for ${nextTarget(target)}s`;
  document.getElementById('winner-overlay').classList.add('visible');
}

export function hideWinner() {
  document.getElementById('winner-overlay').classList.remove('visible');
}

export function showReconnectingModal() {
  document.getElementById('reconnecting-modal').classList.add('visible');
}

export function hideReconnectingModal() {
  document.getElementById('reconnecting-modal').classList.remove('visible');
}

export function renderDisconnectOverlay(snap) {
  const overlay = document.getElementById('disconnect-overlay');
  const msgEl = document.getElementById('disconnect-msg');
  const names = Object.values(snap.players).filter(p => p.disconnected).map(p => p.name);
  if (names.length === 0) {
    overlay.classList.remove('visible');
  } else {
    msgEl.textContent = names.length === 1
      ? `Waiting for ${names[0]} to reconnect…`
      : `Waiting for ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} to reconnect…`;
    overlay.classList.add('visible');
  }
}
