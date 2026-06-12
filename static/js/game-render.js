// @ts-check
import './components/player-card.js';
import './components/round-target.js';
import { markActivity, quipSticky } from './attitude.js';
import { makeDie, myDiceKey, placeGrid } from './dice.js';
import { loadDicePositions, saveDicePositions } from './dice-positions.js';
import { byId } from './dom.js';
import { state } from './state.js';

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */
/** @typedef {import('./components/player-card.js').PlayerCard} PlayerCard */

/**
 * Game-board rendering: players bar, my dice area, the pause-menu controls,
 * and the roll-button paused state. Updates IN PLACE — the players bar reuses
 * keyed <player-card> elements and myDiceKey() gates the my-area re-render —
 * so a WS frame doesn't re-parse markup or re-scatter dice.
 */

/** Keyed <player-card> registry (pid → card), reused across renders. */
const barCards = new Map();

/** @param {GameSnapshot} snap */
function maxWins(snap) {
  return Math.max(0, ...Object.values(snap.players).map((p) => p.wins));
}

/**
 * Add or remove a boolean attribute without churning the DOM.
 * @param {Element} el
 * @param {string} name
 * @param {boolean} present
 */
function setAttr(el, name, present) {
  if (present) {
    if (!el.hasAttribute(name)) el.setAttribute(name, '');
  } else if (el.hasAttribute(name)) {
    el.removeAttribute(name);
  }
}

/**
 * Patch the players bar in place: me first, then by wins descending.
 * @param {GameSnapshot} snap
 */
export function renderPlayersBar(snap) {
  const top = maxWins(snap);
  const bar = byId('players-bar');

  const sorted = Object.entries(snap.players).sort(([aId], [bId]) => {
    if (aId === state.myId) return -1;
    if (bId === state.myId) return 1;
    return snap.players[bId].wins - snap.players[aId].wins;
  });

  for (const [pid, player] of sorted) {
    const isMe = pid === state.myId;
    const matched = player.has_rolled
      ? player.dice.filter((d) => d === snap.target).length
      : 0;
    const hot = !isMe && matched >= 7;

    let card = barCards.get(pid);
    if (!card) {
      card = /** @type {PlayerCard} */ (document.createElement('player-card'));
      barCards.set(pid, card);
    }
    card.setAttribute('name', player.name);
    card.setAttribute('wins', String(player.wins));
    card.setAttribute('matched', String(matched));
    setAttr(card, 'is-me', isMe);
    setAttr(card, 'leading', player.wins > 0 && player.wins === top);
    setAttr(card, 'hot', hot);
    setAttr(card, 'disconnected', Boolean(player.disconnected));
    bar.appendChild(card); // appendChild moves to preserve sort order
  }

  for (const [pid, card] of barCards) {
    if (!snap.players[pid]) {
      card.remove();
      barCards.delete(pid);
    }
  }
}

/**
 * Rebuild my dice area (round status, dice zones, roll button) for a snapshot.
 * @param {GameSnapshot} snap
 */
export function renderMyArea(snap) {
  const player = state.myId ? snap.players[state.myId] : undefined;
  if (!player) return;

  const effectiveTarget = player.has_rolled ? snap.target : -1;
  const matched = player.dice.filter((d) => d === effectiveTarget);
  const unmatched = player.dice.filter((d) => d !== effectiveTarget);

  const area = byId('my-area');
  area.innerHTML = '';

  const status = document.createElement('div');
  status.className = 'round-status';
  const roundLabel = document.createElement('div');
  roundLabel.className = 'round-label';
  roundLabel.textContent = `Round ${snap.round_num}`;
  status.appendChild(roundLabel);
  const target = document.createElement('round-target');
  target.setAttribute('value', String(snap.target));
  status.appendChild(target);
  area.appendChild(status);

  const zones = document.createElement('div');
  zones.className = 'dice-zones';

  const unmatchedZone = document.createElement('div');
  unmatchedZone.className = 'zone-unmatched';
  const diceToPlace = [...unmatched];
  // Scatter needs the zone's pixel rect. When this render rides showScreen's
  // onSwap the screen is already displayed, so the first synchronous attempt
  // succeeds and the dice are in the DOM before the view transition's first
  // animated frame. If the zone still measures 0×0 (screen not displayed
  // yet), poll until it is — stopping only when a newer render has replaced
  // this zone, never by giving up (a silent give-up left boards without
  // their scattered dice).
  const place = () => {
    if (!unmatchedZone.isConnected) return;
    const rect = unmatchedZone.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      requestAnimationFrame(place);
      return;
    }
    const sz = window.innerWidth <= 480 ? 50 : 56;
    const stored = loadDicePositions(snap.code, snap.round_num);
    const positions = stored && stored.length === diceToPlace.length
      ? stored
      : placeGrid(rect, diceToPlace.length, sz);
    /** @type {import('./dice.js').DiePosition[]} */
    const used = [];
    diceToPlace.forEach((value, i) => {
      const { x, y, rot } = positions[i] ?? { x: 8, y: 8, rot: 0 };
      used.push({ x, y, rot });
      const wrapper = document.createElement('div');
      wrapper.className = 'die-wrapper';
      wrapper.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      wrapper.appendChild(makeDie(value, effectiveTarget));
      unmatchedZone.appendChild(wrapper);
    });
    saveDicePositions(snap.code, snap.round_num, used);
  };
  zones.appendChild(unmatchedZone);

  const matchedZone = document.createElement('div');
  matchedZone.className = 'zone-matched';
  matched.forEach((value) => matchedZone.appendChild(makeDie(value, effectiveTarget)));
  zones.appendChild(matchedZone);
  area.appendChild(zones);

  const rollArea = document.createElement('div');
  rollArea.className = 'roll-area';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-roll';
  btn.id = 'roll-btn';
  btn.textContent = 'Roll';
  rollArea.appendChild(btn);
  area.appendChild(rollArea);

  // Last: the zone must be measured in its FINAL layout (the roll area above
  // takes flex height from the zones). The isConnected guard inside place()
  // is the kill switch if a newer render replaces this one.
  place();
}

/**
 * mm:ss for the pause countdown.
 * @param {number} ms
 */
function fmtRemaining(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** @type {ReturnType<typeof setInterval> | null} */
let pauseTick = null;

function stopPauseTick() {
  if (pauseTick) {
    clearInterval(pauseTick);
    pauseTick = null;
  }
}

/**
 * Host-only pause controls (Pause/Resume toggle + countdown). Kept separate
 * from renderMyArea so a pause toggle refreshes the button without
 * re-scattering dice.
 * @param {GameSnapshot} snap
 */
export function renderMenu(snap) {
  const btn = document.getElementById('menu-pause-btn');
  if (!btn) return;
  const isHost = snap.host === state.myId;
  const paused = Boolean(snap.paused);
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

  const downNames = Object.values(snap.players)
    .filter((p) => p.disconnected)
    .map((p) => p.name);
  const playersEl = document.getElementById('pause-players');
  if (playersEl) {
    if (downNames.length === 0) {
      playersEl.textContent = quipSticky('pause.everyone_here', "Everyone is here! Let's go!");
    } else {
      const list = downNames.length === 1
        ? downNames[0]
        : downNames.length === 2
          ? `${downNames[0]} and ${downNames[1]}`
          : `${downNames.slice(0, -1).join(', ')}, and ${downNames.at(-1)}`;
      playersEl.textContent = quipSticky('pause.waiting_on', `Waiting on ${list}…`, { names: list });
    }
  }

  const remainingEl = document.getElementById('pause-remaining');
  if (remainingEl && typeof snap.pause_remaining_ms === 'number') {
    const deadline = Date.now() + snap.pause_remaining_ms;
    const tick = () => {
      remainingEl.textContent = fmtRemaining(deadline - Date.now());
    };
    tick();
    stopPauseTick();
    pauseTick = setInterval(tick, 1000);
  }
}

/**
 * Reflect the paused flag on the roll button for every player.
 * @param {GameSnapshot} snap
 */
export function syncPaused(snap) {
  const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
  if (!btn) return;
  if (snap.paused) {
    btn.disabled = true;
    btn.textContent = quipSticky('roll_button_paused', 'Paused');
  } else if (!state.rolling && !state.awaitingAck) {
    btn.disabled = false;
    btn.textContent = 'Roll';
  }
}

/**
 * Full board render for a snapshot, gated by the dice fingerprint so frames
 * that don't change my dice never re-scatter them.
 * @param {GameSnapshot} snap
 */
export function renderGame(snap) {
  state.currentState = snap;
  const key = myDiceKey(snap);
  if (key !== state.lastMyDiceKey) {
    state.lastMyDiceKey = key;
    state.rolling = false;
    markActivity(); // my board changed — reset the idle-nag clock
    renderPlayersBar(snap);
    renderMyArea(snap);
  } else {
    renderPlayersBar(snap);
  }
  renderMenu(snap);
  syncPaused(snap);
}
