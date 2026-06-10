// @ts-check
import { byId } from './dom.js';
import { showFor } from './router.js';
import {
  savePlayerId, saveGameCode, saveReconnectToken, readSession, hasSession, clearSession,
} from './session.js';
import { state, resetRollState } from './state.js';
import { showScreen, showLoading, leaveLoading } from './transitions.js';

/** @typedef {import('./types.js').ServerMessage} ServerMessage */
/** @typedef {import('./types.js').ErrorMessage} ErrorMessage */

/**
 * WebSocket client: connection lifecycle, the create/join/start intents,
 * the reconnect loop, and inbound message dispatch. Inbound snapshots route
 * to router.showFor; screen-specific rendering lives with the screens.
 * (Scaffold scope: the roll choreography branches are added with the game view.)
 */

const RECONNECT_WINDOW_MS = 60_000;
/** While paused nobody is dropped, so a much longer window applies (~1 h). */
const PAUSED_RECONNECT_WINDOW_MS = 61 * 60 * 1000;
const RETRY_DELAY_MS = 2000;

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

/**
 * Send an action frame on the open socket.
 * @param {string} action
 * @param {Record<string, unknown>} [extra]
 */
function send(action, extra = {}) {
  state.ws?.send(JSON.stringify({ action, ...extra }));
}

/** The saved session is unusable — forget it and land on landing with the reason. */
function expireSession() {
  state.reconnecting = false;
  clearSession();
  state.currentState = null;
  leaveLoading(() => {
    showScreen('landing');
    landingScreen().showError('Connection failed');
  });
}

/** On unexpected close, try to resume if we still hold a session. */
function handleWsClose() {
  if (state.reconnecting) return;
  if (hasSession()) maybeReconnect();
}

/**
 * Resume a saved session: show the reconnecting screen and retry until the
 * window (normal or paused-length) elapses.
 */
export function maybeReconnect() {
  if (state.reconnecting) return;
  const { playerId, gameCode } = readSession();
  if (!playerId || !gameCode) return;
  state.myId = playerId;
  state.reconnecting = true;
  showLoading('Reconnecting…');
  const windowMs = state.currentState?.paused ? PAUSED_RECONNECT_WINDOW_MS : RECONNECT_WINDOW_MS;
  attemptReconnect(playerId, gameCode, Date.now() + windowMs);
}

/**
 * One reconnect attempt; reschedules itself until `deadline`.
 * @param {string} playerId
 * @param {string} gameCode
 * @param {number} deadline Epoch ms after which the session expires.
 */
function attemptReconnect(playerId, gameCode, deadline) {
  if (Date.now() > deadline) {
    expireSession();
    return;
  }
  const { token } = readSession();
  const ws = new WebSocket(wsUrl());
  state.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({
    action: 'reconnect', player_id: playerId, game_code: gameCode, token,
  }));
  ws.onerror = () => {};
  ws.onmessage = (event) => {
    const msg = /** @type {ServerMessage} */ (JSON.parse(event.data));
    if (msg.type === 'welcome') return;
    if (msg.type === 'error') {
      ws.close();
      expireSession();
      return;
    }
    // First real frame: the session is live again — hand over to normal dispatch.
    state.reconnecting = false;
    resetRollState();
    ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
    ws.onclose = handleWsClose;
    handleMessage(msg);
  };
  ws.onclose = () => {
    if (state.reconnecting) {
      setTimeout(() => attemptReconnect(playerId, gameCode, deadline), RETRY_DELAY_MS);
    }
  };
}

/**
 * Open a fresh socket and run `afterConnect` once it's up.
 * @param {() => void} afterConnect
 */
function connectWs(afterConnect) {
  const ws = new WebSocket(wsUrl());
  state.ws = ws;
  ws.onopen = afterConnect;
  ws.onmessage = (event) => handleMessage(JSON.parse(event.data));
  ws.onclose = handleWsClose;
}

/** The landing screen component (typed accessor for its error surface). */
function landingScreen() {
  return /** @type {import('./components/landing-screen.js').LandingScreen} */ (byId('landing'));
}

/** The join screen component (typed accessor for its error surface). */
function joinScreen() {
  return /** @type {import('./components/join-screen.js').JoinScreen} */ (byId('join'));
}

/**
 * Player name for an intent: the active screen's field, falling back to the
 * seeded placeholder. Captured before showLoading swaps the active screen.
 */
function currentName() {
  const active = document.querySelector('.screen.active');
  const input = /** @type {HTMLInputElement} */ (
    byId(active?.id === 'join' ? 'join-name-input' : 'name-input')
  );
  return input.value.trim() || state.randomNamePlaceholder;
}

/** Create a new game as `currentName()`. */
export function createGame() {
  const name = currentName();
  state.pendingOrigin = 'landing';
  showLoading();
  connectWs(() => send('create', { name }));
}

/** Join the game whose code is in the join form. */
export function joinGame() {
  const code = /** @type {HTMLInputElement} */ (byId('code-input')).value.trim();
  if (!code) {
    joinScreen().showError('Enter a game code');
    return;
  }
  const name = currentName();
  state.pendingOrigin = 'join';
  showLoading();
  connectWs(() => send('join', { name, code }));
}

/** Host-only: start the game. */
export function startGame() {
  send('start');
}

/**
 * Inbound dispatch.
 * @param {ServerMessage} msg
 */
function handleMessage(msg) {
  switch (msg.type) {
    case 'ping':
      send('pong', { t: msg.t });
      return;
    case 'welcome':
      state.myId = msg.player_id;
      savePlayerId(msg.player_id);
      return;
    case 'reconnect_token':
      saveReconnectToken(msg.token);
      return;
    case 'state':
      showFor(msg);
      return;
    case 'round_won':
      // Scaffold scope: routed like a state frame; the winner overlay and the
      // mid-roll choreography arrive with the game/overlay views.
      showFor(msg);
      return;
    case 'error':
      handleError(msg);
      return;
  }
}

/**
 * Error frames. Fatal ⇒ the game is gone: clear the session and land on
 * landing with the reason. Pre-game failures return to the intent's origin
 * screen instead of stranding on loading.
 * @param {ErrorMessage} msg
 */
function handleError(msg) {
  if (msg.fatal) {
    clearSession();
    state.currentState = null;
    state.reconnecting = false;
    leaveLoading(() => {
      showScreen('landing');
      landingScreen().showError(msg.msg);
    });
    return;
  }
  if (state.pendingOrigin === 'join') {
    state.pendingOrigin = null;
    leaveLoading(() => {
      showScreen('join');
      joinScreen().showError(msg.msg);
    });
  } else if (state.pendingOrigin === 'landing') {
    state.pendingOrigin = null;
    leaveLoading(() => {
      showScreen('landing');
      landingScreen().showError(msg.msg);
    });
  }
  // (In-game errors are handled once the game view exists.)
}
