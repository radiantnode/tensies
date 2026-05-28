export function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Match server's next_target: cycles 6 → 5 → 4 → 3 → 2 → 1 → 6 → …
export function nextTarget(t) { return ((t - 2 + 6) % 6) + 1; }

export function setError(msg) {
  document.getElementById('landing-error').textContent = msg;
}

export function setJoinError(msg) {
  document.getElementById('join-error').textContent = msg;
}
