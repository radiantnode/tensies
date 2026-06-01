// Small shared helpers.
export function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Mirrors the server's next_target (verbatim from the original; re-confirm
// against live behaviour when the game view is built).
export function nextTarget(t) { return ((t - 2 + 6) % 6) + 1; }

export const setError = (msg) => { document.getElementById('landing-error').textContent = msg; };
export const setJoinError = (msg) => { document.getElementById('join-error').textContent = msg; };
