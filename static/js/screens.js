import { state } from './state.js';
import { esc } from './util.js';
import { makeDie, makeTargetDie, myDiceKey, placeGrid } from './dice.js';
import { renderDisconnectOverlay } from './overlays.js';

function maxWins(snap) {
  return Math.max(0, ...Object.values(snap.players).map(p => p.wins));
}

export function renderLobby(snap) {
  state.gameCode = snap.code;
  document.getElementById('lobby-code').textContent = snap.code;
  const list = document.getElementById('lobby-players');
  list.innerHTML = '';
  Object.entries(snap.players).forEach(([pid, p]) => {
    const li = document.createElement('div');
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
    startBtn.style.display = 'block';
    waitMsg.textContent = Object.keys(snap.players).length < 2 ? 'Invite friends — or start solo!' : '';
  } else {
    startBtn.style.display = 'none';
    waitMsg.textContent = 'Waiting for the host to start…';
  }
  renderDisconnectOverlay(snap);
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

    if (!state.barCards[pid]) {
      // First appearance — build the card DOM once
      const card = document.createElement('div');
      card.className = 'player-mini';

      const topRow = document.createElement('div');
      topRow.className = 'player-mini-top';

      const name = document.createElement('div');
      name.className = 'player-mini-name';
      name.textContent = p.name;
      topRow.appendChild(name);

      if (isMe) {
        const you = document.createElement('span');
        you.className = 'player-mini-you';
        you.textContent = 'you';
        topRow.appendChild(you);
      }

      const wins = document.createElement('div');
      topRow.appendChild(wins);
      card.appendChild(topRow);

      const prog = document.createElement('div');
      prog.className = 'player-mini-progress';
      const fill = document.createElement('div');
      prog.appendChild(fill);
      card.appendChild(prog);

      const count = document.createElement('div');
      card.appendChild(count);

      state.barCards[pid] = { card, wins, fill, count };
    }

    // Update only the values that change — fill width animates via CSS transition
    const { card, wins, fill, count } = state.barCards[pid];
    card.className  = 'player-mini' + (p.disconnected ? ' disconnected' : '');
    wins.className  = 'player-mini-wins' + (p.wins > 0 && p.wins === top ? ' leading' : '');
    wins.textContent = `${p.wins}W`;
    fill.className   = 'player-mini-fill' + (isMe ? ' me' : hot ? ' hot' : '');
    fill.style.width = `${(matched / 10) * 100}%`;
    count.className  = 'player-mini-count' + (hot ? ' hot' : '');
    count.textContent = `${matched}/10`;

    // appendChild moves existing elements — keeps sorted order without extra DOM ops
    bar.appendChild(card);
  });

  // Remove cards for players who have left the game
  for (const pid of Object.keys(state.barCards)) {
    if (!snap.players[pid]) {
      state.barCards[pid].card.remove();
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
  roundHeader.appendChild(makeTargetDie(snap.target, 'round-target-die'));
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
  requestAnimationFrame(() => {
    const rect = unmatchedZone.getBoundingClientRect();
    const sz   = window.innerWidth <= 480 ? 50 : 56;
    const positions = placeGrid(rect, diceToPlace.length, sz);

    diceToPlace.forEach((v, i) => {
      const { x, y, rot } = positions[i] || { x: 8, y: 8, rot: 0 };
      const wrapper = document.createElement('div');
      wrapper.className = 'die-wrapper';
      wrapper.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      wrapper.appendChild(makeDie(v, effectiveTarget));
      unmatchedZone.appendChild(wrapper);
    });
  });
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
  btn.className = 'btn-roll';
  btn.id = 'roll-btn';
  btn.textContent = 'Roll';
  rollArea.appendChild(btn);
  area.appendChild(rollArea);
}

export function renderGame(snap) {
  state.currentState = snap;
  const key = myDiceKey(snap);

  if (key !== state.lastMyDiceKey) {
    // Real state change for me — round transition or game start
    state.lastMyDiceKey = key;
    state.rolling = false;
    renderPlayersBar(snap);
    renderMyArea(snap);
  } else {
    // Another player rolled — update bar only; my dice area is untouched
    renderPlayersBar(snap);
  }
  renderDisconnectOverlay(snap);
}
