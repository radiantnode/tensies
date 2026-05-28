import './touch.js';
import { state } from './state.js';
import {
  copyCode,
  createGame,
  joinGame,
  loadRandomName,
  showJoin,
  showLanding,
  smsTap,
  startGame,
} from './landing.js';
import { maybeReconnect } from './ws.js';
import { roll } from './roll.js';

// ── Button wiring (replaces inline onclick= attributes) ──
document.getElementById('create-btn').addEventListener('click', createGame);
document.getElementById('show-join-btn').addEventListener('click', showJoin);
document.querySelector('.join-back').addEventListener('click', showLanding);
document.getElementById('join-btn').addEventListener('click', joinGame);
document.getElementById('lobby-code').addEventListener('click', copyCode);
document.getElementById('sms-btn').addEventListener('click', e => { e.preventDefault(); smsTap(); });
document.getElementById('start-btn').addEventListener('click', startGame);

// Roll button is recreated on every renderMyArea — use delegation
document.getElementById('my-area').addEventListener('click', e => {
  if (e.target.id === 'roll-btn' && !e.target.disabled) roll();
});

// ── Keyboard ──
document.getElementById('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') createGame(); });
document.getElementById('join-name-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('code-input').focus(); });
document.getElementById('code-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinGame(); });
document.getElementById('code-input').addEventListener('input',   e => { e.target.value = e.target.value.toUpperCase(); });

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && state.currentState?.started && !state.rolling) {
    e.preventDefault();
    const btn = document.getElementById('roll-btn');
    if (btn && !btn.disabled) roll();
  }
});

// ── Init ──
loadRandomName();

// Capture deep-link param before replaceState wipes it
const deepLinkCode = new URLSearchParams(location.search).get('join');

// Deep-link: /?join=ABCDE → go straight to join screen with code pre-filled
if (deepLinkCode) {
  history.replaceState(null, '', '/');
  document.getElementById('code-input').value = deepLinkCode.toUpperCase();
  showJoin();
} else {
  // Auto-reconnect on page load if a prior session was saved
  maybeReconnect();
}
