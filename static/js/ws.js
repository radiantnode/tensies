import { state } from './state.js';
import { setError, setJoinError, showScreen } from './util.js';
import { myDiceKey } from './dice.js';
import { resetRollState } from './animations.js';
import { renderGame, renderLobby, renderMyArea, renderPlayersBar } from './screens.js';
import { hideWinner, showLoading, showWinner, waitingText } from './overlays.js';

const RECONNECT_WINDOW_MS = 30000;
const RETRY_DELAY_MS = 2000;

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function clearSession() {
  localStorage.removeItem('tensies_pid');
  localStorage.removeItem('tensies_code');
}

function expireSession() {
  state.reconnecting = false;
  clearSession();
  state.currentState = null;
  setError('Connection failed');
  showScreen('landing');
}

function handleWsClose() {
  if (state.reconnecting) return;
  if (localStorage.getItem('tensies_pid') && localStorage.getItem('tensies_code')) {
    maybeReconnect();
  } else if (state.currentState) {
    alert('Connection lost. Refresh to reconnect.');
  }
}

export function connectWS(afterConnect) {
  state.ws = new WebSocket(wsUrl());
  state.ws.onopen = () => afterConnect();
  state.ws.onmessage = evt => handleMessage(JSON.parse(evt.data));
  state.ws.onclose = handleWsClose;
}

export function maybeReconnect() {
  if (state.reconnecting) return;
  const pid = localStorage.getItem('tensies_pid');
  const code = localStorage.getItem('tensies_code');
  if (!pid || !code) return;
  state.myId = pid;
  state.reconnecting = true;
  showLoading('Reconnecting…');
  attemptReconnect(pid, code, Date.now() + RECONNECT_WINDOW_MS);
}

export function attemptReconnect(pid, code, deadline) {
  if (Date.now() > deadline) {
    expireSession();
    return;
  }
  state.ws = new WebSocket(wsUrl());
  state.ws.onopen = () => state.ws.send(JSON.stringify({ action: 'reconnect', player_id: pid, game_code: code }));
  state.ws.onerror = () => {};
  state.ws.onmessage = evt => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'welcome') return;
    if (msg.type === 'error') {
      state.ws.close();
      expireSession();
      return;
    }
    state.reconnecting = false;
    resetRollState();
    state.ws.onmessage = evt2 => handleMessage(JSON.parse(evt2.data));
    state.ws.onclose = handleWsClose;
    handleMessage(msg);
  };
  state.ws.onclose = () => {
    if (state.reconnecting) setTimeout(() => attemptReconnect(pid, code, deadline), RETRY_DELAY_MS);
  };
}

// Single screen-decision for every server state message: lobby / loading /
// game, depending on whether the game has started and whether any player
// is currently disconnected.
function showFor(msg) {
  if (!msg.started) {
    hideWinner();
    showScreen('lobby');
    renderLobby(msg);
    return;
  }
  const downNames = Object.values(msg.players).filter(p => p.disconnected).map(p => p.name);
  if (downNames.length > 0) {
    hideWinner();
    showLoading(waitingText(downNames));
    return;
  }
  hideWinner();
  showScreen('game');
  renderGame(msg);
}

export function handleMessage(msg) {
  switch (msg.type) {
    case 'welcome':
      state.myId = msg.player_id;
      localStorage.setItem('tensies_pid', state.myId);
      break;

    case 'state':
      if (msg.code) localStorage.setItem('tensies_code', msg.code);
      if (state.awaitingAck && msg.started && myDiceKey(msg) !== state.lastMyDiceKey) {
        // Response to my in-flight roll — let tryReveal drive the animation
        state.pendingRollState = msg;
      } else {
        showFor(msg);
      }
      break;

    case 'round_won':
      if (state.awaitingAck && myDiceKey(msg) !== state.lastMyDiceKey) {
        // I just won — animate the reveal first, then show the overlay
        state.pendingRollState = msg;
        state.pendingWinName = msg.winner_name;
        state.pendingWinTarget = msg.target;
      } else {
        state.pendingRollTimeouts.forEach(clearTimeout);
        state.pendingRollTimeouts = [];
        state.awaitingAck = false;
        state.rolling = false;
        state.pendingRollState = null;
        state.currentState = msg;
        state.lastMyDiceKey = myDiceKey(msg);
        showScreen('game');
        renderPlayersBar(msg);
        renderMyArea(msg);
        showWinner(msg.winner_name, msg.target);
      }
      break;

    case 'error':
      if (state.currentState && state.currentState.started) {
        // In-game error (e.g. rate limit) — clear roll state so the button comes back
        state.pendingRollTimeouts.forEach(clearTimeout);
        state.pendingRollTimeouts = [];
        state.awaitingAck = false;
        state.rolling = false;
        state.pendingRollState = null;
        const btn = document.getElementById('roll-btn');
        if (btn) btn.disabled = false;
        renderMyArea(state.currentState);
      } else if (document.getElementById('join').classList.contains('active')) {
        setJoinError(msg.msg);
      } else {
        setError(msg.msg);
      }
      break;
  }
}
