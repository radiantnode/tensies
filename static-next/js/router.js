// Native History-API router — every pre-game screen has a real, shareable URL.
// Game screens (lobby/board) are driven by live state and get their own routes
// as those views are built.
import { showScreen, leaveLoading } from './transitions.js';

const ROUTES = { '/': 'landing', '/join': 'join' };

export function navigate(path, { replace = false } = {}) {
  const id = ROUTES[path] || 'landing';
  history[replace ? 'replaceState' : 'pushState']({ id }, '', path);
  showScreen(id);
}

window.addEventListener('popstate', () => {
  showScreen(ROUTES[location.pathname] || 'landing');
});

// First paint is #loading (hard-coded active); decide what to show next without
// a landing flash. A ?join=CODE deep link goes straight to the join screen.
export function bootstrap() {
  const join = new URLSearchParams(location.search).get('join');
  if (join) {
    history.replaceState({ id: 'join' }, '', '/');
    const code = document.getElementById('code-input');
    if (code) code.value = join.toUpperCase();
    leaveLoading(() => showScreen('join'));
  } else {
    leaveLoading(() => showScreen('landing'));
  }
}
