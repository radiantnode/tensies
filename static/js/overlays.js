import { nextTarget, showScreen } from './util.js';

// Winner is the only true dialog overlay — it sits on top of the still-relevant
// game board. Loading is a screen (see #loading in index.html), not a dialog,
// and is driven via showLoading().

const winner = document.getElementById('winner-overlay');
if (winner) winner.addEventListener('cancel', e => e.preventDefault());

export function showWinner(name, target) {
  document.getElementById('winner-name').textContent = name;
  document.getElementById('winner-sub').textContent = `Next up: roll for ${nextTarget(target)}s`;
  if (winner && !winner.open) winner.showModal();
}

export function hideWinner() {
  if (winner && winner.open) winner.close();
}

export function showLoading(text = 'Loading…') {
  document.getElementById('loading-msg').textContent = text;
  showScreen('loading');
}

// Build the "Waiting for A and B to reconnect…" text from a name list.
export function waitingText(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `Waiting for ${names[0]} to reconnect…`;
  return `Waiting for ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} to reconnect…`;
}
