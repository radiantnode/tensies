// WebSocket client: connection, the create/join intents, and inbound dispatch.
// This is the foundation the lobby and game views build on; for now it fully
// handles the connection handshake and the error paths (join "Game not found",
// fatal end), and routes successful snapshots to showFor() — which gains its
// lobby/game rendering as those views are built.
import { state } from './state.js';
import { setError, setJoinError } from './util.js';
import { showScreen, showLoading, leaveLoading } from './transitions.js';
import { myDiceKey } from './dice.js';
import { showPaused, hidePaused, pausedText, hideWinner, RESUME_CLOSE_DELAY_MS } from './overlays.js';

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function clearSession() {
  localStorage.removeItem('tensies_pid');
  localStorage.removeItem('tensies_code');
  localStorage.removeItem('tensies_token');
}

export function connectWS(afterConnect) {
  state.ws = new WebSocket(wsUrl());
  state.ws.onopen = () => afterConnect();
  state.ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  state.ws.onclose = () => {}; // reconnect handling lands with the reconnect view
}

function send(action, extra = {}) {
  state.ws.send(JSON.stringify({ action, ...extra }));
}

// Name from the active screen's field, falling back to the seeded placeholder.
function currentName() {
  const active = document.querySelector('.screen.active');
  const val = active && active.id === 'join'
    ? document.getElementById('join-name-input').value.trim()
    : document.getElementById('name-input').value.trim();
  return val || state.randomNamePlaceholder;
}

export function createGame() {
  const name = currentName(); // capture before showLoading swaps the active screen
  state.pendingOrigin = 'landing';
  showLoading('Loading…');
  connectWS(() => send('create', { name }));
}

export function joinGame() {
  const code = document.getElementById('code-input').value.trim();
  if (!code) { setJoinError('Enter a game code'); return; }
  const name = currentName();
  state.pendingOrigin = 'join';
  showLoading('Loading…');
  connectWS(() => send('join', { name, code }));
}

export function startGame() {
  send('start');
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'ping':
      send('pong', { t: msg.t });
      return;
    case 'welcome':
      state.myId = msg.player_id;
      localStorage.setItem('tensies_pid', state.myId);
      return;
    case 'reconnect_token':
      localStorage.setItem('tensies_token', msg.token);
      return;
    case 'state':
      if (msg.code) localStorage.setItem('tensies_code', msg.code);
      // My own roll response (private, pre-broadcast): hold it for tryReveal so
      // the shake/reveal animation drives the change instead of a hard re-render.
      if (state.awaitingAck && msg.started && myDiceKey(msg) !== state.lastMyDiceKey && !state.pendingRollState) {
        state.pendingRollState = msg;
      } else if (state.awaitingAck && state.pendingRollState) {
        // A newer broadcast landed mid-reveal — hold it, apply after the reveal.
        state.postRevealState = msg;
      } else {
        showFor(msg);
      }
      return;
    case 'round_won':
      // Winner overlay + the mid-roll win choreography land with the winner
      // view; for now route the final board.
      showFor(msg);
      return;
    case 'error':
      handleError(msg);
      return;
  }
}

function handleError(msg) {
  if (msg.fatal) {
    clearSession();
    state.currentState = null;
    state.reconnecting = false;
    leaveLoading(() => { showScreen('landing'); setError(msg.msg); });
    return;
  }
  // Pre-game failure (bad code, game already started) — return to the origin
  // screen and surface the reason there rather than stranding on loading.
  if (state.pendingOrigin === 'join') {
    state.pendingOrigin = null;
    leaveLoading(() => { showScreen('join'); setJoinError(msg.msg); });
  } else if (state.pendingOrigin === 'landing') {
    state.pendingOrigin = null;
    leaveLoading(() => { showScreen('landing'); setError(msg.msg); });
  }
  // (In-game errors are handled once the game view exists.)
}

export function showFor(msg) {
  state.currentState = msg;
  state.pendingOrigin = null;
  if (msg.code) {
    state.gameCode = msg.code;
    localStorage.setItem('tensies_code', msg.code);
  }
  if (!msg.started) {
    leaveLoading(() => {
      hidePaused();
      showScreen('lobby');
      document.getElementById('lobby').render(msg);
    });
    return;
  }

  // Paused. Non-host: keep the board under a wait dialog so dice stay in place.
  // Host: stay on the board with the menu open (countdown + resume toggle).
  if (msg.paused) {
    const game = document.getElementById('game');
    if (msg.host !== state.myId) {
      hideWinner();
      leaveLoading(() => { showScreen('game'); game.render(msg); showPaused(pausedText(msg)); });
      return;
    }
    // A host returning from reconnect lands on #loading — pop the menu open on
    // the swap so the resume toggle is right there.
    const fromLoading = document.getElementById('loading').classList.contains('active');
    leaveLoading(() => {
      hideWinner();
      hidePaused();
      showScreen('game');
      game.render(msg);
      if (fromLoading) game.openMenu();
    });
    return;
  }

  // (disconnect-waiting branch lands with the reconnect view)
  leaveLoading(() => {
    const game = document.getElementById('game');
    hideWinner();
    showScreen('game');
    game.render(msg);
    // Just resumed: drop the pause overlay after the toggle's slide-off.
    const overlay = document.getElementById('pause-overlay');
    if (overlay?.open) setTimeout(hidePaused, RESUME_CLOSE_DELAY_MS);
    else hidePaused();
  });
}
