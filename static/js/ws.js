import { state } from './state.js';
import { setError, setJoinError, showScreen } from './util.js';
import { myDiceKey } from './dice.js';
import { resetRollState } from './animations.js';
import { renderGame, renderLobby, renderMyArea, renderPlayersBar } from './screens.js';
import { hidePaused, hideWinner, leaveLoading, pausedText, showLoading, showPaused, showWinner, waitingText } from './overlays.js';
import { openMenu, RESUME_CLOSE_DELAY_MS } from './menu.js';

const RECONNECT_WINDOW_MS = 60000;
// While the game is paused the server holds it open for up to an hour, so keep
// trying to reconnect that long — covers the host backgrounding their phone.
const PAUSED_RECONNECT_WINDOW_MS = 61 * 60 * 1000;
const RETRY_DELAY_MS = 2000;

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function clearSession() {
  localStorage.removeItem('tensies_pid');
  localStorage.removeItem('tensies_code');
  localStorage.removeItem('tensies_token');
}

function expireSession() {
  state.reconnecting = false;
  clearSession();
  state.currentState = null;
  leaveLoading(() => {
    setError('Connection failed');
    showScreen('landing');
  });
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
  const window = state.currentState?.paused ? PAUSED_RECONNECT_WINDOW_MS : RECONNECT_WINDOW_MS;
  attemptReconnect(pid, code, Date.now() + window);
}

export function attemptReconnect(pid, code, deadline) {
  if (Date.now() > deadline) {
    expireSession();
    return;
  }
  const token = localStorage.getItem('tensies_token') || '';
  state.ws = new WebSocket(wsUrl());
  state.ws.onopen = () => state.ws.send(JSON.stringify({ action: 'reconnect', player_id: pid, game_code: code, token }));
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
export function showFor(msg) {
  // Track the latest server-side state on every branch — without this, the
  // disconnect/loading branch leaves state.currentState frozen at the last
  // game-screen render, which then misreports who's disconnected.
  state.currentState = msg;
  // A successful response clears any pending pre-game origin so a later
  // mid-game error doesn't get bounced to the landing/join screen.
  state.pendingOrigin = null;
  if (!msg.started) {
    leaveLoading(() => { hideWinner(); hidePaused(); showScreen('lobby'); renderLobby(msg); });
    return;
  }
  // Paused: non-hosts see a dialog overlay on top of the game board so their
  // dice stay visible in place. The host stays on the board with the menu open
  // (countdown + player count + resume toggle). This branch must precede the
  // disconnect check below, or a paused host with offline players would be
  // sent to loading too.
  if (msg.paused) {
    if (msg.host !== state.myId) {
      hideWinner();
      leaveLoading(() => {
        showScreen('game');
        renderGame(msg);
        showPaused(pausedText(msg));
      });
      return;
    }
    // Host returning from a reconnect lands on #loading — pop the menu open
    // when we swap to the board so the resume toggle is right in front of them.
    const fromLoading = document.getElementById('loading').classList.contains('active');
    leaveLoading(() => {
      hideWinner();
      hidePaused();
      showScreen('game');
      renderGame(msg);
      if (fromLoading) openMenu();
    });
    return;
  }
  const downNames = Object.values(msg.players).filter(p => p.disconnected).map(p => p.name);
  if (downNames.length > 0) {
    // Entering loading — no min-duration gate, just show it.
    hideWinner();
    hidePaused();
    showLoading(waitingText(downNames));
    return;
  }
  leaveLoading(() => {
    hideWinner();
    showScreen('game');
    renderGame(msg);
    const overlay = document.getElementById('pause-overlay');
    if (overlay?.open) setTimeout(hidePaused, RESUME_CLOSE_DELAY_MS);
    else hidePaused();
  });
}

export function handleMessage(msg) {
  switch (msg.type) {
    case 'ping':
      state.ws.send(JSON.stringify({ action: 'pong', t: msg.t }));
      return;

    case 'welcome':
      state.myId = msg.player_id;
      localStorage.setItem('tensies_pid', state.myId);
      break;

    case 'reconnect_token':
      // Private per-player credential — only this client ever receives it.
      // Required (alongside pid + code) to reclaim the slot after a drop.
      localStorage.setItem('tensies_token', msg.token);
      break;

    case 'state':
      if (msg.code) localStorage.setItem('tensies_code', msg.code);
      if (state.awaitingAck && msg.started && myDiceKey(msg) !== state.lastMyDiceKey && !state.pendingRollState) {
        // Response to my in-flight roll — let tryReveal drive the animation
        state.pendingRollState = msg;
      } else if (state.awaitingAck && state.pendingRollState) {
        // A newer broadcast (e.g. the host paused) landed while I'm mid-reveal.
        // Don't lose it or let it clobber the roll response — hold it and let
        // tryReveal re-route through showFor once the reveal finishes.
        state.postRevealState = msg;
      } else {
        showFor(msg);
      }
      break;

    case 'round_won': {
      // The winner is the player whose dice are all on the target. The overlay
      // shows the winner's name + "Winner" only to the winner; everyone else
      // sees their own name + "Loser".
      const me = msg.players[state.myId];
      const myName = me ? me.name : (msg.winner_name || '?');
      const iWon = !!me && me.dice.every(d => d === msg.target);
      if (state.awaitingAck && myDiceKey(msg) !== state.lastMyDiceKey) {
        // I was mid-roll — animate the reveal first, then show the overlay
        state.pendingRollState = msg;
        state.pendingWinName = myName;
        state.pendingWinTarget = msg.target;
        state.pendingWinRound = msg.round_num;
        state.pendingWinIsLoser = !iWon;
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
        showWinner(myName, msg.target, msg.round_num, !iWon);
      }
      break;
    }

    case 'error':
      if (msg.fatal) {
        // Terminal — the game no longer exists (e.g. paused past the cap).
        // Drop our session and return to the landing screen with the reason.
        clearSession();
        state.currentState = null;
        state.reconnecting = false;
        hideWinner();
        hidePaused();
        showScreen('landing');
        setError(msg.msg);
        return;
      }
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
      } else if (state.pendingOrigin === 'join') {
        // Pre-game join attempt failed — swap back to the join screen and
        // surface the error there. Without this the user is stuck on the
        // Loading… screen with no visible feedback.
        state.pendingOrigin = null;
        leaveLoading(() => { showScreen('join'); setJoinError(msg.msg); });
      } else if (state.pendingOrigin === 'landing') {
        state.pendingOrigin = null;
        leaveLoading(() => { showScreen('landing'); setError(msg.msg); });
      } else if (document.getElementById('join').classList.contains('active')) {
        setJoinError(msg.msg);
      } else {
        setError(msg.msg);
      }
      break;
  }
}
