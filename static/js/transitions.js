// Screen swaps via the View Transitions API + the loading-screen min-duration.
// Single source of truth for "show this screen"; every navigation goes through
// here so the loading↔landing morph and cross-fades stay consistent.
const MIN_LOADING_MS = 600;
let loadingShownAt = Date.now();

export function showScreen(id) {
  const target = document.getElementById(id);
  // Already active — skip the document-wide transition (it would stomp on
  // in-flight animations). Return a resolved handle so callers can still await.
  if (target.classList.contains('active')) {
    const done = Promise.resolve();
    return { finished: done, updateCallbackDone: done, ready: done };
  }
  const swap = () => {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    target.classList.add('active');
  };
  if (document.startViewTransition) return document.startViewTransition(swap);
  swap();
  const done = Promise.resolve();
  return { finished: done, updateCallbackDone: done, ready: done };
}

export function showLoading(text = 'Loading…') {
  document.getElementById('loading-msg').textContent = text;
  loadingShownAt = Date.now();
  showScreen('loading');
}

// Run `action` after #loading has shown for at least MIN_LOADING_MS (from the
// last showLoading, or module load = initial paint). Stops the bar flashing.
export function leaveLoading(action) {
  const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - loadingShownAt));
  if (remaining === 0) requestAnimationFrame(action);
  else setTimeout(action, remaining);
}
