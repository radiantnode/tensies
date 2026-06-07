// Native History-API router — every pre-game screen has a real, shareable URL.
// Game screens (lobby/board) are driven by live state and get their routes as
// those views are built.
import { showScreen, leaveLoading } from './transitions.js';
import { maybeReconnect } from './net.js';

const ROUTES = { '/': 'landing', '/join': 'join' };

export function navigate(path, { replace = false } = {}) {
  const id = ROUTES[path] || 'landing';
  history[replace ? 'replaceState' : 'pushState']({ id }, '', path);
  return showScreen(id);
}

// Carry the typed name across to the join screen, then focus the field the user
// still needs (code if a name's set, else the name). Focus runs after the DOM
// swap (updateCallbackDone) — focus() during the view-transition gets dropped.
// `handle` is the showScreen()/navigate() transition for the join swap.
function carryNameAndFocus(handle) {
  const name = document.getElementById('name-input').value.trim();
  document.getElementById('join-name-input').value = name;
  const focusId = name ? 'code-input' : 'join-name-input';
  handle.updateCallbackDone.then(() => document.getElementById(focusId).focus());
}

export function showJoin() {
  carryNameAndFocus(navigate('/join'));
}

export function showLanding() {
  return navigate('/');
}

window.addEventListener('popstate', () => {
  showScreen(ROUTES[location.pathname] || 'landing');
});

// First paint is the inline #loading screen; decide what to show next without a
// landing flash. Saved session → reconnect. /<CODE> or ?join= → join screen.
export function bootstrap() {
  if (localStorage.getItem('tensies_pid') && localStorage.getItem('tensies_code')) {
    maybeReconnect();
    return;
  }
  const pathCode = location.pathname.match(/^\/([A-Z]{5})$/i)?.[1];
  const join = pathCode || new URLSearchParams(location.search).get('join');
  if (join) {
    history.replaceState({ id: 'join' }, '', '/');
    document.getElementById('code-input').value = join.toUpperCase();
    leaveLoading(() => carryNameAndFocus(showScreen('join')));
  } else {
    leaveLoading(() => showScreen('landing'));
  }
}
