import { state } from './state.js';
import { esc } from './util.js';
import { makeDie, myDiceKey, placeGrid } from './dice.js';
import { loadDicePositions, saveDicePositions } from './dice-positions.js';
import './components/player-card.js';
import './components/round-target.js';

function maxWins(snap) {
  return Math.max(0, ...Object.values(snap.players).map(p => p.wins));
}

export function renderLobby(snap) {
  state.gameCode = snap.code;
  document.getElementById('lobby-code').textContent = snap.code;
  const list = document.getElementById('lobby-players');
  list.innerHTML = '';
  Object.entries(snap.players).forEach(([pid, p]) => {
    const li = document.createElement('li');
    li.className = 'player-list-item';
    li.innerHTML = `🎲 ${esc(p.name)}`;
    if (pid === snap.host) {
      const b = document.createElement('span'); b.className = 'host-badge'; b.textContent = 'HOST';
      li.appendChild(b);
    } else if (pid === state.myId) {
      const b = document.createElement('span'); b.className = 'you-badge'; b.textContent = 'you';
      li.appendChild(b);
    }
    list.appendChild(li);
  });
  const startBtn = document.getElementById('start-btn');
  const waitMsg  = document.getElementById('waiting-msg');
  if (snap.host === state.myId) {
    startBtn.hidden = false;
    waitMsg.textContent = Object.keys(snap.players).length < 2 ? 'Invite friends — or start solo!' : '';
  } else {
    startBtn.hidden = true;
    waitMsg.textContent = 'Waiting for the host to start…';
  }
}

function setAttr(el, name, present, value) {
  if (present) {
    if (value !== undefined && el.getAttribute(name) !== String(value)) el.setAttribute(name, value);
    else if (value === undefined && !el.hasAttribute(name)) el.setAttribute(name, '');
  } else if (el.hasAttribute(name)) {
    el.removeAttribute(name);
  }
}

export function renderPlayersBar(snap) {
  const top = maxWins(snap);
  const bar = document.getElementById('players-bar');

  const sorted = Object.entries(snap.players).sort(([aId], [bId]) => {
    if (aId === state.myId) return -1;
    if (bId === state.myId) return  1;
    return snap.players[bId].wins - snap.players[aId].wins;
  });

  sorted.forEach(([pid, p]) => {
    const isMe    = pid === state.myId;
    const matched = p.has_rolled ? p.dice.filter(d => d === snap.target).length : 0;
    const hot     = !isMe && matched >= 7;

    let card = state.barCards[pid];
    if (!card) {
      card = document.createElement('player-card');
      state.barCards[pid] = card;
    }
    card.setAttribute('name', p.name);
    card.setAttribute('wins', p.wins);
    card.setAttribute('matched', matched);
    setAttr(card, 'is-me', isMe);
    setAttr(card, 'leading', p.wins > 0 && p.wins === top);
    setAttr(card, 'hot', hot);
    setAttr(card, 'disconnected', !!p.disconnected);
    bar.appendChild(card); // appendChild moves to preserve sort order
  });

  for (const pid of Object.keys(state.barCards)) {
    if (!snap.players[pid]) {
      state.barCards[pid].remove();
      delete state.barCards[pid];
    }
  }
}

export function renderMyArea(snap) {
  const player = snap.players[state.myId];
  if (!player) return;

  const effectiveTarget = player.has_rolled ? snap.target : -1;
  const matched   = player.dice.filter(d => d === effectiveTarget);
  const unmatched = player.dice.filter(d => d !== effectiveTarget);

  const area = document.getElementById('my-area');
  area.innerHTML = '';

  // Round + target die header
  const roundHeader = document.createElement('div');
  roundHeader.className = 'round-header';
  const roundLbl = document.createElement('div');
  roundLbl.className = 'round-label';
  roundLbl.textContent = `Round ${snap.round_num}`;
  roundHeader.appendChild(roundLbl);
  const target = document.createElement('round-target');
  target.setAttribute('value', snap.target);
  roundHeader.appendChild(target);
  area.appendChild(roundHeader);

  // Locked-count header
  const header = document.createElement('div');
  header.className = 'my-header';
  const lockedEl = document.createElement('div');
  lockedEl.className = 'my-locked';
  lockedEl.innerHTML = matched.length > 0
    ? `<span class="locked-count">${matched.length}</span>/${player.dice.length} locked`
    : `0/${player.dice.length}`;
  header.appendChild(lockedEl);
  area.appendChild(header);

  // Dice zones
  const zones = document.createElement('div');
  zones.className = 'dice-zones';

  const unmatchedZone = document.createElement('div');
  unmatchedZone.className = 'zone-unmatched';

  const diceToPlace = [...unmatched];
  // Wait until the zone actually has dimensions before placing. When this
  // render is triggered by a startViewTransition swap (new game, reconnect),
  // the .active class hasn't yet been applied at the first rAF tick, so
  // getBoundingClientRect returns 0×0 and placeGrid produces an empty array
  // — every die would fall back to (8, 8) and pile up in the corner.
  const place = (attempts = 0) => {
    const rect = unmatchedZone.getBoundingClientRect();
    if ((rect.width <= 0 || rect.height <= 0) && attempts < 30) {
      requestAnimationFrame(() => place(attempts + 1));
      return;
    }
    const sz = window.innerWidth <= 480 ? 50 : 56;
    // Reuse last-known scatter (refresh / reconnect within the same round)
    // if the count still matches; otherwise compute a fresh grid.
    const stored = loadDicePositions(snap.code, snap.round_num);
    const positions = (stored && stored.length === diceToPlace.length)
      ? stored
      : placeGrid(rect, diceToPlace.length, sz);
    const used = [];
    diceToPlace.forEach((v, i) => {
      const { x, y, rot } = positions[i] || { x: 8, y: 8, rot: 0 };
      used.push({ x, y, rot });
      const wrapper = document.createElement('div');
      wrapper.className = 'die-wrapper';
      wrapper.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      wrapper.appendChild(makeDie(v, effectiveTarget));
      unmatchedZone.appendChild(wrapper);
    });
    saveDicePositions(snap.code, snap.round_num, used);
  };
  requestAnimationFrame(() => place());
  zones.appendChild(unmatchedZone);

  const matchedZone = document.createElement('div');
  matchedZone.className = 'zone-matched';
  matched.forEach(v => matchedZone.appendChild(makeDie(v, effectiveTarget)));
  zones.appendChild(matchedZone);

  area.appendChild(zones);

  // Roll button — click delegated from #my-area in main.js
  const rollArea = document.createElement('div');
  rollArea.className = 'roll-area';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-roll';
  btn.id = 'roll-btn';
  btn.textContent = 'Roll';
  rollArea.appendChild(btn);
  area.appendChild(rollArea);
}

// mm:ss for the pause countdown.
function fmtRemaining(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Local 1 Hz ticker for the pause countdown — server broadcasts are too sparse
// during a quiet pause to drive it, so we re-sync the deadline on each snapshot
// and count down locally between them.
let pauseTick = null;
function stopPauseTick() {
  if (pauseTick) { clearInterval(pauseTick); pauseTick = null; }
}

// Host-only menu controls. Kept separate from renderMyArea so a pause toggle
// (which doesn't change dice) refreshes the button without re-scattering dice.
export function renderMenu(snap) {
  const btn = document.getElementById('menu-pause-btn');
  if (!btn) return;
  const isHost = snap.host === state.myId;
  const paused = !!snap.paused;
  btn.hidden = !isHost;
  btn.classList.toggle('active', paused);
  btn.setAttribute('aria-pressed', String(paused));
  const label = btn.querySelector('.menu-item-label');
  if (label) label.textContent = paused ? 'Resume Game' : 'Pause Game';

  const status = document.getElementById('menu-pause-status');
  if (!status) return;
  if (!(isHost && paused)) {
    status.hidden = true;
    stopPauseTick();
    return;
  }
  status.hidden = false;

  const players = Object.values(snap.players);
  const downNames = players.filter(p => p.disconnected).map(p => p.name);
  const playersEl = document.getElementById('pause-players');
  if (playersEl) {
    if (downNames.length === 0) {
      playersEl.textContent = "Everyone is here! Let's go!";
    } else if (downNames.length === 1) {
      playersEl.textContent = `Waiting on ${downNames[0]}…`;
    } else if (downNames.length === 2) {
      playersEl.textContent = `Waiting on ${downNames[0]} and ${downNames[1]}…`;
    } else {
      playersEl.textContent = `Waiting on ${downNames.slice(0, -1).join(', ')}, and ${downNames.at(-1)}…`;
    }
  }

  // Countdown to the abandonment cap. Re-anchor the deadline to this snapshot,
  // then tick locally every second.
  const remEl = document.getElementById('pause-remaining');
  if (remEl && typeof snap.pause_remaining_ms === 'number') {
    const deadline = Date.now() + snap.pause_remaining_ms;
    const tick = () => { remEl.textContent = fmtRemaining(deadline - Date.now()); };
    tick();
    stopPauseTick();
    pauseTick = setInterval(tick, 1000);
  }
}

// Reflect the paused flag on the roll button for every player. A pause toggle
// leaves myDiceKey unchanged, so renderMyArea won't run — sync here instead.
function syncPaused(snap) {
  const btn = document.getElementById('roll-btn');
  if (!btn) return;
  if (snap.paused) {
    btn.disabled = true;
    btn.textContent = 'Paused';
  } else if (!state.rolling && !state.awaitingAck) {
    btn.disabled = false;
    btn.textContent = 'Roll';
  }
}

export function renderGame(snap) {
  state.currentState = snap;
  const key = myDiceKey(snap);

  if (key !== state.lastMyDiceKey) {
    state.lastMyDiceKey = key;
    state.rolling = false;
    renderPlayersBar(snap);
    renderMyArea(snap);
  } else {
    renderPlayersBar(snap);
  }
  renderMenu(snap);
  syncPaused(snap);
}
