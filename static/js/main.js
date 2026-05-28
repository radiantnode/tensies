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

// ── Form submits drive create/join (Enter key works for free) ──
document.getElementById('landing-form').addEventListener('submit', e => { e.preventDefault(); createGame(); });
document.getElementById('join-form').addEventListener('submit', e => { e.preventDefault(); joinGame(); });

// ── Secondary buttons ──
document.getElementById('show-join-btn').addEventListener('click', showJoin);
document.getElementById('back-btn').addEventListener('click', showLanding);
document.getElementById('lobby-code').addEventListener('click', copyCode);
document.getElementById('sms-btn').addEventListener('click', smsTap);
document.getElementById('start-btn').addEventListener('click', startGame);

// Roll button is recreated on every renderMyArea — use delegation
document.getElementById('my-area').addEventListener('click', e => {
  if (e.target.id === 'roll-btn' && !e.target.disabled) roll();
});

// ── Keyboard niceties ──
document.getElementById('join-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('code-input').focus(); }
});
document.getElementById('code-input').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

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

if (deepLinkCode) {
  history.replaceState(null, '', '/');
  document.getElementById('code-input').value = deepLinkCode.toUpperCase();
  showJoin();
} else {
  maybeReconnect();
}
