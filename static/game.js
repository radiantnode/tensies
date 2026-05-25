const DOTS = {
  0: [],
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Cube rotation (applied to .die-3d) to bring each face value to the front
const FACE_ROTATIONS = {
  1: 'rotateY(0deg)',
  2: 'rotateY(-90deg)',
  3: 'rotateX(90deg)',
  4: 'rotateX(-90deg)',
  5: 'rotateY(90deg)',
  6: 'rotateY(180deg)',
};

function makeDie(value, target) {
  const scene = document.createElement("div");
  scene.className = "die-scene";

  const cube = document.createElement("div");
  cube.className = "die-3d" + (value === target && value !== 0 ? " match" : "");
  cube.style.transform = FACE_ROTATIONS[value] || 'rotateY(0deg)';

  for (let fv = 1; fv <= 6; fv++) {
    const face = document.createElement("div");
    face.className = "face face-" + fv;
    for (let i = 0; i < 9; i++) {
      const dot = document.createElement("span");
      dot.className = "dot" + (DOTS[fv].includes(i) ? " active" : "");
      face.appendChild(dot);
    }
    cube.appendChild(face);
  }

  scene.appendChild(cube);
  return scene;
}

function esc(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Prevent double-tap zoom on iOS Safari ──
// We intercept touchstart in capture phase (earliest possible point) so iOS
// never gets a chance to recognise two quick taps as a zoom gesture.
// - Multi-touch (pinch): always prevented (maximum-scale=1 covers this too).
// - Double-tap: prevented only for the 2nd tap within 300 ms — the roll button
//   is disabled by then anyway, so the blocked click is always a no-op.
// - First tap / slow taps: default is never prevented, clicks fire normally.
;(function () {
  let lastTouchStart = 0;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) {
      e.preventDefault();
      return;
    }
    const now = Date.now();
    if (now - lastTouchStart <= 300) {
      e.preventDefault();
      // Even though we're blocking the zoom gesture, if this tap was aimed at
      // the roll button and the button is ready, treat it as a click. This way
      // rapid tapping keeps rolling without ever triggering zoom.
      const btn = document.getElementById('roll-btn');
      if (btn && !btn.disabled && e.target.closest && e.target.closest('#roll-btn')) {
        btn.click();
      }
    }
    lastTouchStart = now;
  }, { passive: false, capture: true });
})();

// ── State ──
let ws = null;
let myId = null;
let gameCode = null;
let rolling = false;
let awaitingAck = false;
let currentState = null;
let lastMyDiceKey = null;
let rollShakeEnd = 0;
let prevMyDiceKey = null;
let prevMatchedCount = 0;
let pendingRollTimeouts = [];
// pid → { card, wins, fill, count } — persists across rounds for in-place updates
const barCards = {};

function myDiceKey(state) {
  const p = state.players[myId];
  if (!p) return null;
  return JSON.stringify({ dice: p.dice, has_rolled: p.has_rolled, target: state.target, round_num: state.round_num });
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── Landing ──
function toggleJoin() {
  const f = document.getElementById("join-form");
  f.classList.toggle("visible");
  if (f.classList.contains("visible")) document.getElementById("code-input").focus();
}

function getName() {
  return document.getElementById("name-input").value.trim() || "Player";
}

function setError(msg) {
  document.getElementById("landing-error").textContent = msg;
}

function connectWS(afterConnect) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => afterConnect();
  ws.onmessage = evt => handleMessage(JSON.parse(evt.data));
  ws.onclose = () => { if (currentState) alert("Connection lost. Refresh to reconnect."); };
}

function createGame() {
  connectWS(() => ws.send(JSON.stringify({ action: "create", name: getName() })));
}

function joinGame() {
  const code = document.getElementById("code-input").value.trim();
  if (!code) { setError("Enter a game code"); return; }
  connectWS(() => ws.send(JSON.stringify({ action: "join", name: getName(), code })));
}

// ── Lobby ──
function copyCode() {
  if (!gameCode) return;
  navigator.clipboard.writeText(gameCode).then(() => {
    const hint = document.getElementById("copy-hint");
    hint.textContent = "copied!";
    hint.classList.add("copied");
    setTimeout(() => { hint.textContent = "click to copy"; hint.classList.remove("copied"); }, 2000);
  });
}

function startGame() {
  ws.send(JSON.stringify({ action: "start" }));
}

function renderLobby(state) {
  gameCode = state.code;
  document.getElementById("lobby-code").textContent = state.code;
  const list = document.getElementById("lobby-players");
  list.innerHTML = "";
  Object.entries(state.players).forEach(([pid, p]) => {
    const li = document.createElement("div");
    li.className = "player-list-item";
    li.innerHTML = `🎲 ${esc(p.name)}`;
    if (pid === state.host) {
      const b = document.createElement("span"); b.className = "host-badge"; b.textContent = "HOST";
      li.appendChild(b);
    } else if (pid === myId) {
      const b = document.createElement("span"); b.className = "you-badge"; b.textContent = "you";
      li.appendChild(b);
    }
    list.appendChild(li);
  });
  const startBtn = document.getElementById("start-btn");
  const waitMsg  = document.getElementById("waiting-msg");
  if (state.host === myId) {
    startBtn.style.display = "block";
    waitMsg.textContent = Object.keys(state.players).length < 2 ? "Invite friends — or start solo!" : "";
  } else {
    startBtn.style.display = "none";
    waitMsg.textContent = "Waiting for the host to start…";
  }
}

// ── Game ──
function maxWins(state) {
  return Math.max(0, ...Object.values(state.players).map(p => p.wins));
}

function makeTargetDie(target, className) {
  const el = document.createElement("div");
  el.className = className;
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement("span");
    dot.className = "dot" + (DOTS[target].includes(i) ? " active" : "");
    el.appendChild(dot);
  }
  return el;
}

function renderPlayersBar(state) {
  const top = maxWins(state);
  const bar = document.getElementById("players-bar");

  const sorted = Object.entries(state.players).sort(([aId], [bId]) => {
    if (aId === myId) return -1;
    if (bId === myId) return  1;
    return state.players[bId].wins - state.players[aId].wins;
  });

  sorted.forEach(([pid, p]) => {
    const isMe    = pid === myId;
    const matched = p.has_rolled ? p.dice.filter(d => d === state.target).length : 0;
    const hot     = !isMe && matched >= 7;

    if (!barCards[pid]) {
      // First appearance — build the card DOM once
      const card   = document.createElement("div");
      card.className = "player-mini";

      const topRow = document.createElement("div");
      topRow.className = "player-mini-top";

      const name = document.createElement("div");
      name.className = "player-mini-name";
      name.textContent = p.name;
      topRow.appendChild(name);

      if (isMe) {
        const you = document.createElement("span");
        you.className = "player-mini-you";
        you.textContent = "you";
        topRow.appendChild(you);
      }

      const wins = document.createElement("div");
      topRow.appendChild(wins);
      card.appendChild(topRow);

      const prog = document.createElement("div");
      prog.className = "player-mini-progress";
      const fill = document.createElement("div");
      prog.appendChild(fill);
      card.appendChild(prog);

      const count = document.createElement("div");
      card.appendChild(count);

      barCards[pid] = { card, wins, fill, count };
    }

    // Update only the values that change — fill width animates via CSS transition
    const { card, wins, fill, count } = barCards[pid];
    wins.className  = "player-mini-wins" + (p.wins > 0 && p.wins === top ? " leading" : "");
    wins.textContent = `${p.wins}W`;
    fill.className  = "player-mini-fill" + (isMe ? " me" : hot ? " hot" : "");
    fill.style.width = `${(matched / 10) * 100}%`;
    count.className  = "player-mini-count" + (hot ? " hot" : "");
    count.textContent = `${matched}/10`;

    // appendChild moves existing elements — keeps sorted order without extra DOM ops
    bar.appendChild(card);
  });

  // Remove cards for players who have left the game
  for (const pid of Object.keys(barCards)) {
    if (!state.players[pid]) {
      barCards[pid].card.remove();
      delete barCards[pid];
    }
  }
}

function renderMyArea(state) {
  const player  = state.players[myId];
  if (!player) return;

  const effectiveTarget = player.has_rolled ? state.target : -1;
  const matched   = player.dice.filter(d => d === effectiveTarget);
  const unmatched = player.dice.filter(d => d !== effectiveTarget);

  const area = document.getElementById("my-area");
  area.innerHTML = "";

  // Round + target die header
  const roundHeader = document.createElement("div");
  roundHeader.className = "round-header";
  const roundLbl = document.createElement("div");
  roundLbl.className = "round-label";
  roundLbl.textContent = `Round ${state.round_num}`;
  roundHeader.appendChild(roundLbl);
  roundHeader.appendChild(makeTargetDie(state.target, "round-target-die"));
  area.appendChild(roundHeader);

  // Dice header
  const header = document.createElement("div");
  header.className = "my-header";
  const lockedEl = document.createElement("div");
  lockedEl.className = "my-locked";
  lockedEl.innerHTML = matched.length > 0
    ? `<span class="locked-count">${matched.length}</span>/${player.dice.length} locked`
    : `0/${player.dice.length}`;
  header.appendChild(lockedEl);
  area.appendChild(header);

  // Dice zones
  const zones = document.createElement("div");
  zones.className = "dice-zones";

  const unmatchedZone = document.createElement("div");
  unmatchedZone.className = "zone-unmatched";

  const diceToPlace = [...unmatched];
  requestAnimationFrame(() => {
    const rect = unmatchedZone.getBoundingClientRect();
    const sz   = window.innerWidth <= 480 ? 50 : 56;
    const positions = placeGrid(rect, diceToPlace.length, sz);

    diceToPlace.forEach((v, i) => {
      const { x, y, rot } = positions[i] || { x: 8, y: 8, rot: 0 };
      const wrapper = document.createElement("div");
      wrapper.className = "die-wrapper";
      wrapper.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      wrapper.appendChild(makeDie(v, effectiveTarget));
      unmatchedZone.appendChild(wrapper);
    });
  });
  zones.appendChild(unmatchedZone);

  const matchedZone = document.createElement("div");
  matchedZone.className = "zone-matched";
  matched.forEach(v => matchedZone.appendChild(makeDie(v, effectiveTarget)));
  zones.appendChild(matchedZone);

  area.appendChild(zones);

  // Roll button
  const rollArea = document.createElement("div");
  rollArea.className = "roll-area";
  const btn = document.createElement("button");
  btn.className = "btn-roll";
  btn.id = "roll-btn";
  btn.textContent = "Roll";
  btn.onclick = roll;
  rollArea.appendChild(btn);
  area.appendChild(rollArea);
}

// ── Dice rolling ──
function computeNewDice(currentDice, target, hasRolled) {
  if (!hasRolled) {
    // First roll of the round — all 10 fresh
    return Array.from({ length: 10 }, () => Math.floor(Math.random() * 6) + 1);
  }
  // Re-roll: keep locked (matching target), re-roll others
  return currentDice.map(d => d === target ? d : Math.floor(Math.random() * 6) + 1);
}

function startShake() {
  const gatherMs = 200;
  const shakeMs  = 300 + Math.random() * 400; // 300–700 ms in-hand
  rollShakeEnd   = Date.now() + gatherMs + shakeMs;

  const wrappers = [...document.querySelectorAll('.zone-unmatched .die-wrapper')];
  const zone     = document.querySelector('.zone-unmatched');
  const sz       = window.innerWidth <= 480 ? 50 : 56;

  if (zone && wrappers.length) {
    const rect = zone.getBoundingClientRect();
    const cx   = (rect.width  - sz) / 2;
    const cy   = (rect.height - sz) / 2;
    wrappers.forEach(wrapper => {
      const ox  = (Math.random() - 0.5) * 44;
      const oy  = (Math.random() - 0.5) * 44;
      const rot = (Math.random() - 0.5) * 30;
      wrapper.style.transition = `transform ${gatherMs}ms ease-in`;
      wrapper.style.transform  = `translate(${cx + ox}px, ${cy + oy}px) rotate(${rot}deg)`;
    });
  }

  // After gather, start 3-D tumble
  const gatherT = setTimeout(() => {
    const anims = ['tumbling-a', 'tumbling-b', 'tumbling-c'];
    wrappers.forEach(wrapper => {
      wrapper.style.transition = '';
      const cube = wrapper.querySelector('.die-3d');
      if (cube) {
        cube.classList.add(anims[Math.floor(Math.random() * 3)]);
        cube.style.animationDelay = `-${Math.floor(Math.random() * 500)}ms`;
      }
    });
  }, gatherMs);
  pendingRollTimeouts.push(gatherT);
}

// Divide the zone into a grid sized for `count` dice, add jitter within each
// cell, then shuffle — guaranteed no overlap, still looks scattered.
function placeGrid(zoneRect, count, sz) {
  if (count === 0) return [];
  const pad = 8;
  const w = zoneRect.width  - pad * 2;
  const h = zoneRect.height - pad * 2;
  const cols = Math.max(2, Math.round(Math.sqrt(count * w / h)));
  const rows = Math.ceil(count / cols);
  const cellW = w / cols;
  const cellH = h / rows;
  const jx = Math.max(0, (cellW - sz) / 2 * 0.6);
  const jy = Math.max(0, (cellH - sz) / 2 * 0.6);

  const positions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = pad + c * cellW + cellW / 2 - sz / 2;
      const by = pad + r * cellH + cellH / 2 - sz / 2;
      positions.push({
        x:   Math.max(pad, Math.min(pad + w - sz, bx + (Math.random() - 0.5) * jx * 2)),
        y:   Math.max(pad, Math.min(pad + h - sz, by + (Math.random() - 0.5) * jy * 2)),
        rot: (Math.random() - 0.5) * 24,
      });
    }
  }
  // Fisher-Yates shuffle so dice get random grid slots
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, count);
}

// onComplete is called when the place animation finishes (matched dice land in zone)
function updateDiceInPlace(state, onComplete) {
  pendingRollTimeouts.forEach(clearTimeout);
  pendingRollTimeouts = [];
  document.querySelectorAll('.zone-unmatched .die-wrapper.lifting').forEach(w => w.remove());

  const player   = state.players[myId];
  const wrappers = [...document.querySelectorAll('.zone-unmatched .die-wrapper')];

  if (!player || wrappers.length === 0) {
    renderMyArea(state);
    renderPlayersBar(state);
    if (onComplete) onComplete();
    return;
  }

  const effectiveTarget   = player.has_rolled ? state.target : -1;
  const newMatched        = player.dice.filter(d => d === effectiveTarget);
  const newUnmatched      = player.dice.filter(d => d !== effectiveTarget);
  const newlyMatchedCount = Math.max(0, newMatched.length - prevMatchedCount);

  // ── Phase 1: scatter ──
  const zone      = document.querySelector('.zone-unmatched');
  const sz        = window.innerWidth <= 480 ? 50 : 56;
  const scatterMs = 320;
  const finalPositions = [];

  if (zone) {
    const rect = zone.getBoundingClientRect();
    const grid = placeGrid(rect, wrappers.length, sz);
    grid.forEach(p => finalPositions.push(p));

    wrappers.forEach((wrapper, i) => {
      const p = finalPositions[i];
      wrapper.style.transition = `transform ${scatterMs}ms ease-out`;
      wrapper.style.transform  = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
    });
  }

  // ── Phase 2: reveal faces ──
  const revealT = setTimeout(() => {
    wrappers.forEach(wrapper => {
      wrapper.style.transition = '';
      // transform already has final translate + rotate from scatter — nothing to set
    });

    // Update locked-count label
    const lockedEl = document.querySelector('.my-locked');
    if (lockedEl) {
      lockedEl.innerHTML = newMatched.length > 0
        ? `<span class="locked-count">${newMatched.length}</span>/${player.dice.length} locked`
        : `0/${player.dice.length}`;
    }

    // Unmatched dice: ease from mid-tumble into face value (no snap, no bounce)
    newUnmatched.forEach((v, i) => {
      const wrapper = wrappers[i];
      if (!wrapper) return;
      const cube = wrapper.querySelector('.die-3d');
      if (!cube) return;
      // Capture live animated position so we can transition FROM it, not snap from it
      const liveTransform = getComputedStyle(cube).transform;
      cube.classList.remove('tumbling-a', 'tumbling-b', 'tumbling-c');
      cube.style.animationDelay = '';
      cube.className = 'die-3d';
      cube.style.transform = liveTransform;                        // hold mid-tumble
      cube.style.transition = 'transform 0.3s ease-out';
      cube.style.transform  = FACE_ROTATIONS[v] || 'rotateY(0deg)'; // ease to face
      cube.addEventListener('transitionend', () => { cube.style.transition = ''; }, { once: true });
    });

    // Newly-matched: ease into face value, then lift off to matched zone
    for (let i = 0; i < newlyMatchedCount; i++) {
      const wrapper = wrappers[newUnmatched.length + i];
      if (!wrapper) continue;
      const cube = wrapper.querySelector('.die-3d');
      const v    = newMatched[prevMatchedCount + i];
      if (cube) {
        const liveTransform = getComputedStyle(cube).transform;
        cube.classList.remove('tumbling-a', 'tumbling-b', 'tumbling-c');
        cube.style.animationDelay = '';
        cube.className = 'die-3d match';
        cube.style.transform = liveTransform;
        cube.style.transition = 'transform 0.3s ease-out';
        cube.style.transform  = FACE_ROTATIONS[v] || 'rotateY(0deg)';
        cube.addEventListener('transitionend', () => { cube.style.transition = ''; }, { once: true });
      }
      const liftT = setTimeout(() => {
        wrapper.classList.add('lifting');
        const removeT = setTimeout(() => wrapper.remove(), 280);
        pendingRollTimeouts.push(removeT);
      }, 400);
      pendingRollTimeouts.push(liftT);
    }

    // Pop matched dice into side zone, then signal complete
    const matchedZone = document.querySelector('.zone-matched');
    if (newlyMatchedCount > 0) {
      const popT = setTimeout(() => {
        if (matchedZone) {
          for (let i = prevMatchedCount; i < newMatched.length; i++) {
            const scene = makeDie(newMatched[i], effectiveTarget);
            scene.classList.add('popping');
            matchedZone.appendChild(scene);
          }
        }
        renderPlayersBar(state);
        if (onComplete) onComplete();
      }, 500);
      pendingRollTimeouts.push(popT);
    } else {
      renderPlayersBar(state);
      if (onComplete) onComplete();
    }
  }, scatterMs);

  pendingRollTimeouts.push(revealT);
}

function renderGame(state) {
  currentState = state;
  const key = myDiceKey(state);

  if (awaitingAck && key === lastMyDiceKey) {
    // Server confirmed my roll — re-enable and update bar
    awaitingAck = false;
    rolling = false;
    const btn = document.getElementById('roll-btn');
    if (btn) btn.disabled = false;
    renderPlayersBar(state);
  } else if (key !== lastMyDiceKey) {
    if (rolling && key === prevMyDiceKey) {
      // Another player's broadcast arrived while we're mid-roll — our dice
      // look "changed" because the server still has our pre-roll state.
      // Just update the bar; don't touch our animation.
      renderPlayersBar(state);
    } else {
      // Real state change — round transition or game start
      lastMyDiceKey = key;
      renderPlayersBar(state);
      rolling = false;
      renderMyArea(state);
    }
  } else {
    // Another player rolled — update immediately (broadcast arrives after their animation)
    renderPlayersBar(state);
  }
}

function roll() {
  if (rolling) return;
  rolling = true;

  const p = currentState?.players[myId];
  if (!p) { rolling = false; return; }

  // Snapshot matched count so we know which are "new" this roll
  prevMatchedCount = p.has_rolled ? p.dice.filter(d => d === currentState.target).length : 0;

  // Compute dice locally
  const newDice = computeNewDice(p.dice, currentState.target, p.has_rolled);

  // Build synthetic state for animation — server will validate & confirm
  const syntheticState = {
    ...currentState,
    players: {
      ...currentState.players,
      [myId]: { ...p, dice: newDice, has_rolled: true },
    },
  };
  prevMyDiceKey = lastMyDiceKey;
  lastMyDiceKey = myDiceKey(syntheticState);

  const btn = document.getElementById("roll-btn");
  if (btn) btn.disabled = true;

  pendingRollTimeouts.forEach(clearTimeout);
  pendingRollTimeouts = [];

  startShake();

  // After shake ends, animate with known dice then send to server
  const remaining = Math.max(0, rollShakeEnd - Date.now());
  const shakeT = setTimeout(() => {
    updateDiceInPlace(syntheticState, () => {
      awaitingAck = true;
      ws.send(JSON.stringify({ action: "roll", dice: newDice }));
    });
  }, remaining);
  pendingRollTimeouts.push(shakeT);
}

// ── Winner overlay ──
function showWinner(name, target) {
  document.getElementById("winner-name").textContent = name;
  document.getElementById("winner-sub").textContent = `Next up: roll for ${nextTarget(target)}s`;
  document.getElementById("winner-overlay").classList.add("visible");
}

function hideWinner() {
  document.getElementById("winner-overlay").classList.remove("visible");
}

function nextTarget(t) { return ((t - 2 + 6) % 6) + 1; }

// ── Message handler ──
function handleMessage(msg) {
  switch (msg.type) {
    case "welcome":
      myId = msg.player_id;
      break;
    case "state":
      hideWinner();
      if (!msg.started) { showScreen("lobby"); renderLobby(msg); }
      else              { showScreen("game");  renderGame(msg);  }
      break;
    case "round_won":
      // Broadcast arrives after the winner's animation — show immediately for everyone
      pendingRollTimeouts.forEach(clearTimeout);
      pendingRollTimeouts = [];
      awaitingAck = false;
      rolling = false;
      currentState = msg;
      lastMyDiceKey = myDiceKey(msg);
      showScreen("game");
      renderPlayersBar(msg);
      renderMyArea(msg);
      showWinner(msg.winner_name, msg.target);
      break;
    case "error":
      setError(msg.msg);
      break;
  }
}

// ── Keyboard ──
document.getElementById("name-input").addEventListener("keydown", e => { if (e.key === "Enter") createGame(); });
document.getElementById("code-input").addEventListener("keydown", e => { if (e.key === "Enter") joinGame(); });
document.getElementById("code-input").addEventListener("input",   e => { e.target.value = e.target.value.toUpperCase(); });

document.addEventListener("keydown", e => {
  if (e.code === "Space" && currentState?.started && !rolling) {
    e.preventDefault();
    const btn = document.getElementById("roll-btn");
    if (btn && !btn.disabled) roll();
  }
});
