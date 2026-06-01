// Native History-API router — every pre-game screen has a real, shareable URL.
// Game screens (lobby/board) are driven by live state and get their routes as
// those views are built.
import { showScreen, leaveLoading } from './transitions.js';

const ROUTES = { '/': 'landing', '/join': 'join' };

export function navigate(path, { replace = false } = {}) {
  const id = ROUTES[path] || 'landing';
  history[replace ? 'replaceState' : 'pushState']({ id }, '', path);
  return showScreen(id);
}

// Carry the typed name across to the join screen, then focus the field the user
// still needs (code if a name's set, else the name). Focus runs after the DOM
// swap (updateCallbackDone) — focus() during the view-transition gets dropped.
export function showJoin() {
  const name = document.getElementById('name-input').value.trim();
  document.getElementById('join-name-input').value = name;
  const focusId = name ? 'code-input' : 'join-name-input';
  navigate('/join').updateCallbackDone.then(() => document.getElementById(focusId).focus());
}

export function showLanding() {
  return navigate('/');
}

window.addEventListener('popstate', () => {
  showScreen(ROUTES[location.pathname] || 'landing');
});

// First paint is the inline #loading screen; decide what to show next without a
// landing flash. A ?join=CODE deep link goes straight to join with the code in.
export function bootstrap() {
  const join = new URLSearchParams(location.search).get('join');
  if (join) {
    history.replaceState({ id: 'join' }, '', '/');
    document.getElementById('code-input').value = join.toUpperCase();
    const name = document.getElementById('name-input').value.trim();
    document.getElementById('join-name-input').value = name;
    const focusId = name ? 'code-input' : 'join-name-input';
    leaveLoading(() =>
      showScreen('join').updateCallbackDone.then(() => document.getElementById(focusId).focus()));
  } else {
    leaveLoading(() => showScreen('landing'));
  }
}
