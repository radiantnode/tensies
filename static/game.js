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

  // Build all 6 faces with their dot patterns
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

// ── State ──
let ws = null;
let myId = null;
let gameCode = null;
let rolling = false;
let currentState = null;
let lastMyDiceKey = null;
let myRollPending = false;
let rollShakeEnd = 0;
let rollPendingState = null;
let shakeCycleInterval = null;
let prevMatchedCount = 0;
let pendingRollTimeouts = [];

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
  bar.innerHTML = "";

  // Sort: me first, then others by wins desc
  const sorted = Object.entries(state.players).sort(([aId, a], [bId, b]) => {
    if (aId === myId) return -1;
    if (bId === myId) return  1;
    return b.wins - a.wins;
  });

  sorted.forEach(([pid, p]) => {
    const isMe    = pid === myId;
    const matched = p.has_rolled ? p.dice.filter(d => d === state.target).length : 0;
    const hot     = !isMe && matched >= 7;

    const card = document.createElement("div");
    card.className = "player-mini";

    // Top row: name + YOU tag + wins badge
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
    wins.className = "player-mini-wins" + (p.wins > 0 && p.wins === top ? " leading" : "");
    wins.textContent = `${p.wins}W`;
    topRow.appendChild(wins);

    card.appendChild(topRow);

    // Progress bar
    const prog = document.createElement("div");
    prog.className = "player-mini-progress";
    const fill = document.createElement("div");
    fill.className = "player-mini-fill" + (isMe ? " me" : hot ? " hot" : "");
    fill.style.width = `${(matched / 10) * 100}%`;
    prog.appendChild(fill);
    card.appendChild(prog);

    // Count
    const count = document.createElement("div");
    count.className = "player-mini-count" + (hot ? " hot" : "");
    count.textContent = `${matched}/10`;
    card.appendChild(count);

    bar.appendChild(card);
  });
}

function renderMyArea(state, isRollResult = false) {
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

  // Place dice after layout so we can measure the zone's real dimensions
  const diceToPlace = [...unmatched];
  requestAnimationFrame(() => {
    const rect    = unmatchedZone.getBoundingClientRect();
    const sz      = window.innerWidth <= 480 ? 50 : 56;
    const pad     = 8;
    const gap     = sz + 6; // min centre-to-centre distance
    const placed  = [];

    diceToPlace.forEach(v => {
      let x, y, tries = 0;
      do {
        x = pad + Math.random() * (rect.width  - sz - pad * 2);
        y = pad + Math.random() * (rect.height - sz - pad * 2);
        tries++;
      } while (tries < 200 && placed.some(p =>
        Math.abs(p.x - x) < gap && Math.abs(p.y - y) < gap
      ));

      placed.push({ x, y });
      const rot     = (Math.random() - 0.5) * 24; // ±12°
      const wrapper = document.createElement("div");
      wrapper.className = isRollResult ? "die-wrapper landing" : "die-wrapper";
      wrapper.style.left      = x + "px";
      wrapper.style.top       = y + "px";
      wrapper.style.transform = `rotate(${rot}deg)`;
      wrapper.appendChild(makeDie(v, effectiveTarget));
      unmatchedZone.appendChild(wrapper);
    });
  });
  zones.appendChild(unmatchedZone);

  const matchedZone = document.createElement("div");
  matchedZone.className = "zone-matched";
  if (isRollResult) {
    // Previously-matched dice appear immediately (they were already set aside)
    matched.slice(0, prevMatchedCount).forEach(v => matchedZone.appendChild(makeDie(v, effectiveTarget)));
    // Newly-matched dice pop in after the landing bounce settles (~380ms)
    if (matched.length > prevMatchedCount) {
      setTimeout(() => {
        matched.slice(prevMatchedCount).forEach(v => {
          const scene = makeDie(v, effectiveTarget);
          scene.classList.add("popping");
          matchedZone.appendChild(scene);
        });
      }, 380);
    }
  } else {
    matched.forEach(v => matchedZone.appendChild(makeDie(v, effectiveTarget)));
  }
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
    // Gather all dice to a tight bunch at the centre (like cupped in hand)
    wrappers.forEach(wrapper => {
      const ox  = (Math.random() - 0.5) * 44;
      const oy  = (Math.random() - 0.5) * 44;
      const rot = (Math.random() - 0.5) * 30;
      wrapper.style.transition = `left ${gatherMs}ms ease-in, top ${gatherMs}ms ease-in`;
      wrapper.style.left      = (cx + ox) + 'px';
      wrapper.style.top       = (cy + oy) + 'px';
      wrapper.style.transform = `rotate(${rot}deg)`;
    });
  }

  // After gather completes, start 3-D tumble in place
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

function stopShake() {
  // Wrappers are kept in place; face/animation updates handled by updateDiceInPlace
}

function applyRollResult(state) {
  stopShake();
  rollPendingState = null;
  updateDiceInPlace(state);
}

function updateDiceInPlace(state) {
  // Cancel any pending animations from a previous roll
  pendingRollTimeouts.forEach(clearTimeout);
  pendingRollTimeouts = [];
  document.querySelectorAll('.zone-unmatched .die-wrapper.lifting').forEach(w => w.remove());

  const player   = state.players[myId];
  const wrappers = [...document.querySelectorAll('.zone-unmatched .die-wrapper')];
  if (!player || wrappers.length === 0) {
    rolling = false;
    renderMyArea(state, false);
    const btn = document.getElementById('roll-btn');
    if (btn) btn.disabled = false;
    return;
  }

  const effectiveTarget  = player.has_rolled ? state.target : -1;
  const newMatched       = player.dice.filter(d => d === effectiveTarget);
  const newUnmatched     = player.dice.filter(d => d !== effectiveTarget);
  const newlyMatchedCount = Math.max(0, newMatched.length - prevMatchedCount);

  // ── Phase 1: scatter dice from the bunch to final resting positions ──
  const zone    = document.querySelector('.zone-unmatched');
  const sz      = window.innerWidth <= 480 ? 50 : 56;
  const pad     = 8;
  const gap     = sz + 6;
  const scatterMs = 320;
  const finalPositions = [];

  if (zone) {
    const rect   = zone.getBoundingClientRect();
    const placed = [];
    wrappers.forEach(() => {
      let x, y, tries = 0;
      do {
        x = pad + Math.random() * (rect.width  - sz - pad * 2);
        y = pad + Math.random() * (rect.height - sz - pad * 2);
        tries++;
      } while (tries < 200 && placed.some(p =>
        Math.abs(p.x - x) < gap && Math.abs(p.y - y) < gap
      ));
      placed.push({ x, y });
      finalPositions.push({ x, y, rot: (Math.random() - 0.5) * 24 });
    });

    // Dice keep tumbling while they travel — remove transition block on cube
    wrappers.forEach((wrapper, i) => {
      const p = finalPositions[i];
      wrapper.style.transition = `left ${scatterMs}ms ease-out, top ${scatterMs}ms ease-out`;
      wrapper.style.left       = p.x + 'px';
      wrapper.style.top        = p.y + 'px';
      // Don't override transform here so the 3-D rotation keeps playing
    });
  }

  // ── Phase 2: after scatter, stop tumbling and reveal face values ──
  const revealT = setTimeout(() => {
    // Clear transitions so landing bounce isn't throttled
    wrappers.forEach((wrapper, i) => {
      wrapper.style.transition = '';
      if (finalPositions[i]) {
        wrapper.style.transform = `rotate(${finalPositions[i].rot}deg)`;
      }
    });

    // Update locked-count label
    const lockedEl = document.querySelector('.my-locked');
    if (lockedEl) {
      lockedEl.innerHTML = newMatched.length > 0
        ? `<span class="locked-count">${newMatched.length}</span>/${player.dice.length} locked`
        : `0/${player.dice.length}`;
    }

    // Unmatched dice: reveal face + landing bounce in place
    newUnmatched.forEach((v, i) => {
      const wrapper = wrappers[i];
      if (!wrapper) return;
      const cube = wrapper.querySelector('.die-3d');
      if (!cube) return;
      cube.classList.remove('tumbling-a', 'tumbling-b', 'tumbling-c');
      cube.style.animationDelay = '';
      cube.className = 'die-3d';
      cube.style.transform = FACE_ROTATIONS[v] || 'rotateY(0deg)';
      wrapper.classList.remove('landing');
      void wrapper.offsetWidth;
      wrapper.classList.add('landing');
    });

    // Newly-matched dice: reveal as matched, bounce, then lift off
    for (let i = 0; i < newlyMatchedCount; i++) {
      const wrapper = wrappers[newUnmatched.length + i];
      if (!wrapper) continue;
      const cube = wrapper.querySelector('.die-3d');
      const v    = newMatched[prevMatchedCount + i];
      if (cube) {
        cube.classList.remove('tumbling-a', 'tumbling-b', 'tumbling-c');
        cube.style.animationDelay = '';
        cube.className = 'die-3d match';
        cube.style.transform = FACE_ROTATIONS[v] || 'rotateY(0deg)';
        wrapper.classList.remove('landing');
        void wrapper.offsetWidth;
        wrapper.classList.add('landing');
      }
      const liftT = setTimeout(() => {
        wrapper.classList.remove('landing');
        wrapper.classList.add('lifting');
        const removeT = setTimeout(() => wrapper.remove(), 280);
        pendingRollTimeouts.push(removeT);
      }, 400);
      pendingRollTimeouts.push(liftT);
    }

    // Pop newly matched dice into the side zone
    const matchedZone = document.querySelector('.zone-matched');
    if (matchedZone && newlyMatchedCount > 0) {
      const popT = setTimeout(() => {
        for (let i = prevMatchedCount; i < newMatched.length; i++) {
          const scene = makeDie(newMatched[i], effectiveTarget);
          scene.classList.add('popping');
          matchedZone.appendChild(scene);
        }
      }, 500);
      pendingRollTimeouts.push(popT);
    }

    rolling = false;
    const btn = document.getElementById('roll-btn');
    if (newlyMatchedCount > 0) {
      const reenableT = setTimeout(() => { if (btn) btn.disabled = false; }, 680);
      pendingRollTimeouts.push(reenableT);
    } else {
      if (btn) btn.disabled = false;
    }
  }, scatterMs);

  pendingRollTimeouts.push(revealT);
}

function renderGame(state) {
  currentState = state;
  renderPlayersBar(state);
  const key = myDiceKey(state);
  if (myRollPending || key !== lastMyDiceKey) {
    lastMyDiceKey = key;
    if (myRollPending) {
      myRollPending = false;
      const remaining = rollShakeEnd - Date.now();
      if (remaining > 50) {
        rollPendingState = state;
        setTimeout(() => applyRollResult(rollPendingState || state), remaining);
      } else {
        applyRollResult(state);
      }
    } else {
      // Round transition or other player event — no landing animation
      rolling = false;
      renderMyArea(state, false);
    }
  }
}

function roll() {
  if (rolling) return;
  rolling = true;
  myRollPending = true;
  pendingRollTimeouts.forEach(clearTimeout);
  pendingRollTimeouts = [];
  // Snapshot matched count so we know which are "new" when the result lands
  const p = currentState?.players[myId];
  prevMatchedCount = (p && p.has_rolled)
    ? p.dice.filter(d => d === currentState.target).length
    : 0;
  const btn = document.getElementById("roll-btn");
  if (btn) btn.disabled = true;
  startShake();
  ws.send(JSON.stringify({ action: "roll" }));
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
      if (!currentState?.started) showScreen("game");
      lastMyDiceKey = null; // force re-render after round transition
      {
        const shakeRemaining = Math.max(0, rollShakeEnd - Date.now());
        renderGame(msg);
        // Show winner overlay after shake + landing animation completes
        setTimeout(() => showWinner(msg.winner_name, msg.target), shakeRemaining + 420);
      }
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
