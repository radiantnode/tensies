// @ts-check
import { myDiceKey } from './dice.js';
import { byId } from './dom.js';
import { renderMyArea, renderPlayersBar, stopPauseTick, syncPaused } from './game-render.js';
import { showWinner } from './overlays.js';
import { landing, showFor, showGameDetail, showLanding } from './router.js';
import { getAuthToken, isSignedIn, getAuthUser } from './auth.js';
import {
  savePlayerId, saveReconnectToken, readSession, hasSession, clearGame,
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
  clearGame();
  state.currentState = null;
  leaveLoading(() => {
    showScreen('landing');
    landing().showError('Connection failed');
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

/** The nearby screen component (typed accessor for its error surface). */
function nearbyScreen() {
  return /** @type {import('./components/nearby-screen.js').NearbyScreen} */ (byId('nearby'));
}

/**
 * Player name for an intent: the active screen's field, falling back to the
 * seeded placeholder. Captured before showLoading swaps the active screen.
 */
function currentName() {
  // Signed-in users use their account username as the player name.
  const authUser = getAuthUser();
  if (authUser) return authUser.username;
  // The join sheet lives on the landing screen; read its name field while open.
  const joinOpen = /** @type {HTMLDialogElement | null} */ (document.getElementById('join-sheet'))?.open;
  const input = /** @type {HTMLInputElement} */ (byId(joinOpen ? 'join-name-input' : 'name-input'));
  return input.value.trim() || state.randomNamePlaceholder;
}

/**
 * Anonymous identity-continuity payload for create/join: our durable pid + its
 * private token, so the server re-adopts the same pid (see `verify_claim`) and
 * every game we play collects under one identity. Empty for a signed-in session
 * (the account UUID is the identity) or a brand-new client with nothing saved.
 */
function identityClaim() {
  if (isSignedIn()) return {};
  const { playerId, token } = readSession();
  return playerId && token ? { player_id: playerId, token } : {};
}

/** Create a new game as `currentName()`. */
export function createGame() {
  const name = currentName();
  state.pendingOrigin = 'landing';
  showLoading('Creating game…');
  connectWs(() => send('create', { name, ...identityClaim() }));
}

/**
 * Join a game by code as `currentName()`. Shared by the join form and the
 * nearby radar; `origin` records where a failed attempt returns to.
 * @param {string} code
 * @param {'join' | 'nearby'} [origin]
 */
export function joinWithCode(code, origin = 'join') {
  const name = currentName();
  state.pendingOrigin = origin;
  showLoading('Joining game…');
  connectWs(() => send('join', { name, code, ...identityClaim() }));
}

/** Join the game whose code is in the join form. */
export function joinGame() {
  const code = /** @type {HTMLInputElement} */ (byId('code-input')).value.trim();
  if (!code) {
    landing().showJoinError('Enter a game code');
    return;
  }
  joinWithCode(code, 'join');
}

/**
 * Host-only: stop advertising this game to nearby players. Also the check-out
 * path — clearing the broadcast clears the checked-in place, so the game leaves
 * the radar entirely.
 */
export function stopBroadcast() {
  send('stop_broadcast');
}

/**
 * Host-only: check the game in to a nearby place — the only way onto the radar.
 * Only the place_id is sent; the server resolves the authoritative name +
 * coordinates and turns on discovery at the venue.
 * @param {string} placeId
 */
export function checkIn(placeId) {
  send('checkin', { place_id: placeId });
}

/** Host-only: start the game. */
export function startGame() {
  send('start');
}

/**
 * Leave the lobby without playing and return to landing. We send an explicit
 * `leave` frame *before* closing so the server drops us with no grace hold and
 * the roster updates for everyone immediately (a plain close would leave us in
 * the list for the full reconnect grace). Order matters: clearGame() runs
 * before the close so handleWsClose() doesn't read it as a dropped connection
 * and reconnect us straight back in. (The durable pid/token survive — only the
 * game pointer is forgotten.)
 */
export function leaveGame() {
  send('leave'); // ask the server to drop us now, while the socket is still open
  clearGame();
  state.reconnecting = false;
  state.currentState = null;
  state.gameCode = null;
  state.qr = null; // next game sends its own; don't carry this one's QR over
  resetRollState();
  const ws = state.ws;
  state.ws = null;
  if (ws) {
    ws.onclose = null; // deliberate leave — suppress the reconnect path
    ws.close();
  }
  showLanding();
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
    case 'welcome': {
      // Keep our durable anonymous identity if we hold one — we present it on
      // create/join for the server to re-adopt (so all our games share one
      // pid). Only a brand-new client takes the server-assigned pid. The
      // authoritative pid is confirmed back on `reconnect_token`.
      const saved = readSession();
      if (saved.playerId && saved.token) {
        state.myId = saved.playerId;
      } else {
        state.myId = msg.player_id;
        savePlayerId(msg.player_id);
      }
      return;
    }
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
      // The server echoes the authoritative pid it bound this game to — it may
      // have re-adopted our durable pid, or (token expired) kept a fresh one.
      // Sync to it so client and server never disagree on who "me" is.
      if (msg.player_id) {
        state.myId = msg.player_id;
        savePlayerId(msg.player_id);
      }
      saveReconnectToken(msg.token);
      if (msg.qr) state.qr = msg.qr; // inline invite QR — cache for the stamp
      return;
    case 'state':
      if (msg.qr) state.qr = msg.qr; // re-sent on a lobby reconnect
      // Authoritative catch-up: a frame for a round AHEAD of the one we're
      // showing means we missed the round-advance broadcast (dropped on a flaky
      // link). A newer round supersedes any in-flight roll, so apply it now
      // rather than stashing it behind a reveal that might never run — otherwise
      // a client that also stops rolling stays parked on the old round while the
      // server and everyone else move on.
      if (msg.started && state.currentState
          && typeof msg.round_num === 'number'
          && msg.round_num > (state.currentState.round_num ?? 0)) {
        resetRollState();
        showFor(msg);
        return;
      }
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
      stopPauseTick();
      // The game screen is a persistent shell element, so its in-game menu
      // (open when you tapped "End Game") would otherwise stay open and show
      // up on the next game's board. Reset it as the game tears down.
      /** @type {import('./components/game-screen.js').GameScreen} */ (byId('game')).closeMenu();
      const code = state.gameCode;
      clearGame();
      state.currentState = null;
      // Brief delay so the telemetry writer can flush to Postgres before
      // the game-detail screen fetches the API.
      state.gameJustEnded = true;
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
    // The in-game menu is a persistent shell element. A fatal frame (the pause
    // cap) can arrive with it open — the host pauses with the menu open by
    // design — so close it here too, or it leaks into the next game's board.
    // Mirrors the game_ended path above.
    /** @type {import('./components/game-screen.js').GameScreen} */ (byId('game')).closeMenu();
    stopPauseTick();
    clearGame();
    state.currentState = null;
    state.reconnecting = false;
    leaveLoading(() => {
      // Forced: a fatal landing swap must win even against an in-flight view
      // transition (the showScreen early-return race — see transitions.js).
      // The only sanctioned behavior change of the rewrite.
      showScreen('landing', { force: true });
      landing().showError(msg.msg);
    });
    return;
  }
  if (state.pendingOrigin === 'nearby') {
    state.pendingOrigin = null;
    leaveLoading(() => {
      showScreen('nearby');
      nearbyScreen().showError(msg.msg);
    });
  } else if (state.pendingOrigin === 'join') {
    state.pendingOrigin = null;
    leaveLoading(() => {
      const t = showScreen('landing');
      t.updateCallbackDone.then(() => landing().openJoinSheet({ error: msg.msg }));
    });
  } else if (state.pendingOrigin === 'landing') {
    state.pendingOrigin = null;
    leaveLoading(() => {
      showScreen('landing');
      landing().showError(msg.msg);
    });
  } else if (state.currentState) {
    // In-game, non-fatal error (e.g. a rejected roll: "Slow down", "Game is
    // paused"). Previously dropped silently, which — paired with the reveal
    // wait in tryReveal — left the roll button spinning. Unstick the roll
    // machine and re-render so the button re-enables.
    resetRollState();
    renderMyArea(state.currentState);
    renderPlayersBar(state.currentState);
    // renderMyArea rebuilds the roll button in its default (enabled) state, so
    // re-apply the paused flag — otherwise an error that lands while paused
    // leaves the button reading "Roll" (harmless, roll() guards on paused, but
    // visually wrong).
    syncPaused(state.currentState);
  }
}
