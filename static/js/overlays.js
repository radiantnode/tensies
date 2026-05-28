import { nextTarget } from './util.js';

// Block ESC from closing dialogs — winner auto-advances; disconnect /
// reconnecting are driven by server state, not user dismissal.
function blockEscape(dialog) {
  dialog.addEventListener('cancel', e => e.preventDefault());
}
['winner-overlay', 'disconnect-overlay', 'reconnecting-modal'].forEach(id => {
  const d = document.getElementById(id);
  if (d) blockEscape(d);
});

function open(id) {
  const d = document.getElementById(id);
  if (d && !d.open) d.showModal();
}

function close(id) {
  const d = document.getElementById(id);
  if (d && d.open) d.close();
}

export function showWinner(name, target) {
  document.getElementById('winner-name').textContent = name;
  document.getElementById('winner-sub').textContent = `Next up: roll for ${nextTarget(target)}s`;
  open('winner-overlay');
}

export function hideWinner() {
  close('winner-overlay');
}

export function showReconnectingModal() {
  open('reconnecting-modal');
}

export function hideReconnectingModal() {
  close('reconnecting-modal');
}

export function renderDisconnectOverlay(snap) {
  const msgEl = document.getElementById('disconnect-msg');
  const names = Object.values(snap.players).filter(p => p.disconnected).map(p => p.name);
  if (names.length === 0) {
    close('disconnect-overlay');
  } else {
    msgEl.textContent = names.length === 1
      ? `Waiting for ${names[0]} to reconnect…`
      : `Waiting for ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} to reconnect…`;
    open('disconnect-overlay');
  }
}
