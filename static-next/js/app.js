// Entry point: wires the pre-game screens and bootstraps the router.
import './components/app-header.js';
import { makeName } from './names.js';
import { bootstrap, navigate } from './router.js';

// Random "Zesty Pickle"-style placeholder. Must be the first Math.random
// consumer so the seeded value is stable for visual tests.
function loadRandomName() {
  const name = makeName();
  document.getElementById('name-input').placeholder = name;
  const join = document.getElementById('join-name-input');
  if (join) join.placeholder = name;
}

// Nav menu toggle. The panel content is built in the nav-menu view; for now the
// toggle just reflects open state (landing/join capture with it closed).
document.addEventListener('menu-toggle', () => {
  const menu = document.getElementById('nav-menu');
  const open = !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  menu.hidden = !open;
  document.querySelectorAll('.game-menu-btn').forEach((b) => {
    b.classList.toggle('open', open);
    b.setAttribute('aria-expanded', String(open));
  });
});

document.getElementById('show-join-btn').addEventListener('click', () => navigate('/join'));
document.getElementById('back-btn')?.addEventListener('click', () => navigate('/'));

// Create / Join submit — the WebSocket flow is built with the lobby view.
document.getElementById('landing-form').addEventListener('submit', (e) => e.preventDefault());
document.getElementById('join-form')?.addEventListener('submit', (e) => e.preventDefault());

loadRandomName();
bootstrap();
