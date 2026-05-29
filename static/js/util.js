export function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function showScreen(id) {
  const target = document.getElementById(id);
  // Already on this screen — skip the page-wide View Transition entirely.
  // Server `state` broadcasts (e.g. another player rolling) re-enter here on
  // every frame; running startViewTransition each time snapshots and
  // cross-fades the whole document, which stomps on in-flight dice
  // animations. When the screen isn't actually changing there's nothing to
  // transition, so return a resolved handle and let the caller's render patch
  // the DOM in place.
  if (target.classList.contains('active')) {
    const done = Promise.resolve();
    return { finished: done, updateCallbackDone: done, ready: done };
  }
  const swap = () => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    target.classList.add('active');
  };
  // Progressive enhancement: native cross-fade on Chromium-based browsers,
  // synchronous swap everywhere else. Returns a handle with a `finished`
  // promise so callers can defer focus / post-swap work — calling .focus()
  // mid-transition gets eaten by Chromium.
  if (document.startViewTransition) {
    return document.startViewTransition(swap);
  }
  swap();
  const done = Promise.resolve();
  return { finished: done, updateCallbackDone: done, ready: done };
}

// Match server's next_target: cycles 6 → 5 → 4 → 3 → 2 → 1 → 6 → …
export function nextTarget(t) { return ((t - 2 + 6) % 6) + 1; }

export function setError(msg) {
  document.getElementById('landing-error').textContent = msg;
}

export function setJoinError(msg) {
  document.getElementById('join-error').textContent = msg;
}
