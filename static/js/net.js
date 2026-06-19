// @ts-check
import { myDiceKey } from './dice.js';
import { byId } from './dom.js';
import { renderMyArea, renderPlayersBar } from './game-render.js';
import { showWinner } from './overlays.js';
import { showFor, showGameDetail } from './router.js';
import { getAuthToken, isSignedIn, getAuthUser } from './auth.js';
import {
  savePlayerId, saveReconnectToken, readSession, hasSession, clearSession,
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
  ws.onopen = () => {
    // Authenticate before the intent so the server knows the account UUID
    // before create/join writes it into the game state.
    if (isSignedIn()) send('auth', { token: getAuthToken() });
    afterConnect();
  };
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
  // Signed-in users use their account username as the player name.
  const authUser = getAuthUser();
  if (authUser) return authUser.username;
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
 * Whether a `state` frame is a same-round opponent-roll echo arriving while
 * the win celebration is on screen. Such frames carry nothing the viewer can
 * see (the board is under the overlay scrim) but would route through
 * showFor() → hideWinner() and cut the celebration short (observed at 1153ms
 * and 759ms instead of the full ~3s). Pause and disconnect transitions are
 * NOT echoes — interrupting the celebration is correct for them — and the
 * next-round frame (round_num + 1) must keep closing the overlay as before.
 * @param {import('./types.js').GameSnapshot} snap
 */
function isCelebrationEcho(snap) {
  const overlay = /** @type {HTMLDialogElement | null} */ (document.getElementById('winner-overlay'));
  return Boolean(overlay?.open)
    && snap.started
    && !snap.paused
    && snap.round_num === state.currentState?.round_num
    && !Object.values(snap.players).some((p) => p.disconnected);
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
    case 'auth_ok':
      state.authUsername = msg.username;
      state.authUserId = msg.user_id;
      // Server swapped the PID to the account UUID — update the client to match.
      if (msg.player_id) {
        state.myId = msg.player_id;
        savePlayerId(msg.player_id);
      }
      return;
    case 'reconnect_token':
      saveReconnectToken(msg.token);
      return;
    case 'state':
      // My own roll response (private, pre-broadcast): hold it for tryReveal
      // so the shake/reveal animation drives the change instead of a hard
      // re-render. A newer broadcast landing mid-reveal is stashed separately
      // and applied after the reveal completes.
      if (state.awaitingAck && msg.started && myDiceKey(msg) !== state.lastMyDiceKey && !state.pendingRollState) {
        state.pendingRollState = msg;
      } else if (state.awaitingAck && state.pendingRollState) {
        state.postRevealState = msg;
      } else if (isCelebrationEcho(msg)) {
        // Absorb the data (state bag + players bar stay fresh) but skip the
        // screen routing so the overlay holds its full window. My own dice
        // can't differ in an opponent echo, so no my-area render is needed.
        state.currentState = msg;
        renderPlayersBar(msg);
      } else {
        showFor(msg);
      }
      return;
    case 'round_won': {
      const me = state.myId ? msg.players[state.myId] : undefined;
      const myName = me ? me.name : (msg.winner_name ?? '?');
      const iWon = Boolean(me) && Boolean(me?.dice.every((d) => d === msg.target));
      if (state.awaitingAck && myDiceKey(msg) !== state.lastMyDiceKey) {
        // Mid-roll win: animate my reveal first; tryReveal shows the overlay.
        state.pendingRollState = msg;
        state.pendingWinName = myName;
        state.pendingWinTarget = msg.target;
        state.pendingWinRound = msg.round_num;
        state.pendingWinIsLoser = !iWon;
      } else {
        for (const timeout of state.pendingRollTimeouts) clearTimeout(timeout);
        state.pendingRollTimeouts = [];
        state.awaitingAck = false;
        state.rolling = false;
        state.pendingRollState = null;
        state.currentState = msg;
        state.lastMyDiceKey = myDiceKey(msg);
        // The renders ride onSwap so the dice scatter sees a displayed,
        // measurable board (usually the screen is already active and this
        // runs synchronously).
        showScreen('game', {
          onSwap: () => {
            renderPlayersBar(msg);
            renderMyArea(msg);
          },
        });
        showWinner(myName, msg.target, msg.round_num, !iWon);
      }
      return;
    }
    case 'game_ended': {
      resetRollState();
      const code = state.gameCode;
      clearSession();
      state.currentState = null;
      // Brief delay so the telemetry writer can flush to Postgres before
      // the game-detail screen fetches the API.
      if (code) setTimeout(() => showGameDetail(code), 1000);
      return;
    }
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
      // Forced: a fatal landing swap must win even against an in-flight view
      // transition (the showScreen early-return race — see transitions.js).
      // The only sanctioned behavior change of the rewrite.
      showScreen('landing', { force: true });
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
