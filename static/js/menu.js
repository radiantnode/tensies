import { state } from './state.js';

const btn  = document.getElementById('game-menu-btn');
const menu = document.getElementById('game-menu');
const pauseBtn = document.getElementById('menu-pause-btn');

function isOpen() { return btn.classList.contains('open'); }

export function openMenu() {
  btn.classList.add('open');
  menu.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-label', 'Close menu');
  menu.setAttribute('aria-hidden', 'false');
}

export function closeMenu() {
  btn.classList.remove('open');
  menu.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open menu');
  menu.setAttribute('aria-hidden', 'true');
}

btn.addEventListener('click', () => { isOpen() ? closeMenu() : openMenu(); });

// Pause Game toggle — server flips the flag and echoes it back; renderMenu()
// drives the switch's visual state from that broadcast, so we only send intent.
// Pausing keeps the menu open (so the host sees the countdown + player count);
// resuming closes it to hand the board back — but after a beat, so the toggle's
// slide-off (the .menu-switch 0.2s transition) is visible before the menu goes.
export const RESUME_CLOSE_DELAY_MS = 600;
pauseBtn.addEventListener('click', () => {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  const resuming = !!state.currentState?.paused;
  state.ws.send(JSON.stringify({ action: 'pause' }));
  if (resuming) setTimeout(closeMenu, RESUME_CLOSE_DELAY_MS);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isOpen()) closeMenu();
});
