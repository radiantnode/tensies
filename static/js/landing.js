import { state } from './state.js';
import { setJoinError, showScreen } from './util.js';
import { connectWS } from './ws.js';
import { makeName } from './names.js';
import { showLoading } from './overlays.js';

export function loadRandomName() {
  const name = makeName();
  state.randomNamePlaceholder = name;
  document.getElementById('name-input').placeholder = name;
  document.getElementById('join-name-input').placeholder = name;
}

export function showJoin() {
  const name = document.getElementById('name-input').value.trim();
  document.getElementById('join-name-input').value = name;
  const focusId = name ? 'code-input' : 'join-name-input';
  // updateCallbackDone fires right after the DOM swap; focus() during the
  // view-transition animation (which `finished` would await) is dropped.
  showScreen('join').updateCallbackDone.then(() => document.getElementById(focusId).focus());
}

export function showLanding() {
  showScreen('landing');
}

export function getName() {
  const active = document.querySelector('.screen.active');
  const val = active && active.id === 'join'
    ? document.getElementById('join-name-input').value.trim()
    : document.getElementById('name-input').value.trim();
  return val || state.randomNamePlaceholder;
}

export function createGame() {
  showLoading('Loading…');
  connectWS(() => state.ws.send(JSON.stringify({ action: 'create', name: getName() })));
}

export function joinGame() {
  const code = document.getElementById('code-input').value.trim();
  if (!code) { setJoinError('Enter a game code'); return; }
  showLoading('Loading…');
  connectWS(() => state.ws.send(JSON.stringify({ action: 'join', name: getName(), code })));
}

function joinLink() {
  return `${location.origin}/?join=${state.gameCode}`;
}

export function copyCode() {
  if (!state.gameCode) return;
  navigator.clipboard.writeText(joinLink()).then(() => {
    const hint = document.getElementById('copy-hint');
    hint.textContent = 'link copied!';
    hint.classList.add('copied');
    setTimeout(() => { hint.textContent = 'click to copy link'; hint.classList.remove('copied'); }, 2000);
  });
}

export function smsTap() {
  if (!state.gameCode) return false;
  const body = encodeURIComponent(`🎲 Come play Tensies! ${joinLink()}`);
  // & works on iOS; ? works on Android — the combined form is broadly supported
  location.href = `sms:?&body=${body}`;
  return false;
}

export function startGame() {
  state.ws.send(JSON.stringify({ action: 'start' }));
}
