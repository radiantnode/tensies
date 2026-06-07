// Small shared helpers.

// Toggles can-scroll-up / can-scroll-down on a scrollable element so CSS can
// show edge-fade affordances when there's hidden content above or below.
export function updateScrollFades(el) {
  const { scrollTop, scrollHeight, clientHeight } = el;
  el.classList.toggle('can-scroll-up', scrollTop > 1);
  el.classList.toggle('can-scroll-down', scrollTop + clientHeight < scrollHeight - 1);
}

export function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Mirrors the server's next_target (verbatim from the original; re-confirm
// against live behaviour when the game view is built).
export function nextTarget(t) { return ((t - 2 + 6) % 6) + 1; }

export const setError = (msg) => { document.getElementById('landing-error').textContent = msg; };
export const setJoinError = (msg) => { document.getElementById('join-error').textContent = msg; };
