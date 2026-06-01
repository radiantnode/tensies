// Roll choreography: gather → 3-D tumble → reveal faces → scatter, with newly
// matched dice lifting off into the matched zone. Ported from the original; the
// only changes are import paths (game-render / overlays / net).
import { state } from './state.js';
import { FACE_ROTATIONS, makeDie, myDiceKey, placeGrid } from './dice.js';
import { saveDicePositions } from './dice-positions.js';
import { renderMyArea, renderPlayersBar } from './game-render.js';
import { hideWinner, showWinner } from './overlays.js';
import { showFor } from './net.js';

export function resetRollState() {
  state.pendingRollTimeouts.forEach(clearTimeout);
  state.pendingRollTimeouts = [];
  state.rolling = false;
  state.awaitingAck = false;
  state.pendingRollState = null;
  state.postRevealState = null;
  state.pendingWinName = null;
  state.pendingWinTarget = null;
  state.pendingWinRound = null;
  state.pendingWinIsLoser = false;
}

export function startShake() {
  const gatherMs = 200;
  const shakeMs = 300 + Math.random() * 400;
  state.rollShakeEnd = Date.now() + gatherMs + shakeMs;

  const wrappers = [...document.querySelectorAll('.zone-unmatched .die-wrapper')];
  const zone = document.querySelector('.zone-unmatched');
  const sz = window.innerWidth <= 480 ? 50 : 56;

  if (zone && wrappers.length) {
    const rect = zone.getBoundingClientRect();
    const cx = (rect.width - sz) / 2;
    const cy = (rect.height - sz) / 2;
    wrappers.forEach((wrapper) => {
      const ox = (Math.random() - 0.5) * 44;
      const oy = (Math.random() - 0.5) * 44;
      const rot = (Math.random() - 0.5) * 30;
      wrapper.style.transition = `transform ${gatherMs}ms ease-in`;
      wrapper.style.transform = `translate(${cx + ox}px, ${cy + oy}px) rotate(${rot}deg)`;
    });
  }

  const gatherT = setTimeout(() => {
    const anims = ['tumbling-a', 'tumbling-b', 'tumbling-c'];
    wrappers.forEach((wrapper) => {
      wrapper.style.transition = '';
      const cube = wrapper.querySelector('.die-3d');
      if (cube) {
        cube.classList.add(anims[Math.floor(Math.random() * 3)]);
        cube.style.animationDelay = `-${Math.floor(Math.random() * 500)}ms`;
      }
    });
  }, gatherMs);
  state.pendingRollTimeouts.push(gatherT);
}

export function updateDiceInPlace(snap, onComplete) {
  state.pendingRollTimeouts.forEach(clearTimeout);
  state.pendingRollTimeouts = [];
  document.querySelectorAll('.zone-unmatched .die-wrapper.lifting').forEach((w) => w.remove());

  const player = snap.players[state.myId];
  const wrappers = [...document.querySelectorAll('.zone-unmatched .die-wrapper')];

  if (!player || wrappers.length === 0) {
    renderMyArea(snap);
    renderPlayersBar(snap);
    if (onComplete) onComplete();
    return;
  }

  const effectiveTarget = player.has_rolled ? snap.target : -1;
  const newMatched = player.dice.filter((d) => d === effectiveTarget);
  const newUnmatched = player.dice.filter((d) => d !== effectiveTarget);
  const newlyMatchedCount = Math.max(0, newMatched.length - state.prevMatchedCount);

  const zone = document.querySelector('.zone-unmatched');
  const sz = window.innerWidth <= 480 ? 50 : 56;
  const scatterMs = 320;
  const finalPositions = [];

  if (zone) {
    const rect = zone.getBoundingClientRect();
    const grid = placeGrid(rect, wrappers.length, sz);
    grid.forEach((p) => finalPositions.push(p));
    wrappers.forEach((wrapper, i) => {
      const p = finalPositions[i];
      wrapper.style.transition = `transform ${scatterMs}ms ease-out`;
      wrapper.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
    });
  }

  saveDicePositions(snap.code, snap.round_num, finalPositions.slice(0, newUnmatched.length));

  const revealT = setTimeout(() => {
    wrappers.forEach((wrapper) => { wrapper.style.transition = ''; });

    newUnmatched.forEach((v, i) => {
      const wrapper = wrappers[i];
      if (!wrapper) return;
      const cube = wrapper.querySelector('.die-3d');
      if (!cube) return;
      const liveTransform = getComputedStyle(cube).transform;
      cube.style.transform = liveTransform;
      void cube.getBoundingClientRect();
      cube.classList.remove('tumbling-a', 'tumbling-b', 'tumbling-c');
      cube.style.animationDelay = '';
      cube.className = 'die-3d';
      cube.style.transition = 'transform 0.3s ease-out';
      cube.style.transform = FACE_ROTATIONS[v] || 'rotateY(0deg)';
      cube.addEventListener('transitionend', () => { cube.style.transition = ''; }, { once: true });
    });

    for (let i = 0; i < newlyMatchedCount; i++) {
      const wrapper = wrappers[newUnmatched.length + i];
      if (!wrapper) continue;
      const cube = wrapper.querySelector('.die-3d');
      const v = newMatched[state.prevMatchedCount + i];
      if (cube) {
        const liveTransform = getComputedStyle(cube).transform;
        cube.style.transform = liveTransform;
        void cube.getBoundingClientRect();
        cube.classList.remove('tumbling-a', 'tumbling-b', 'tumbling-c');
        cube.style.animationDelay = '';
        cube.className = 'die-3d match';
        cube.style.transition = 'transform 0.3s ease-out';
        cube.style.transform = FACE_ROTATIONS[v] || 'rotateY(0deg)';
        cube.addEventListener('transitionend', () => { cube.style.transition = ''; }, { once: true });
      }
      const liftT = setTimeout(() => {
        wrapper.classList.add('lifting');
        const removeT = setTimeout(() => wrapper.remove(), 280);
        state.pendingRollTimeouts.push(removeT);
      }, 400);
      state.pendingRollTimeouts.push(liftT);
    }

    const matchedZone = document.querySelector('.zone-matched');
    if (newlyMatchedCount > 0) {
      const popT = setTimeout(() => {
        if (matchedZone) {
          for (let i = state.prevMatchedCount; i < newMatched.length; i++) {
            const scene = makeDie(newMatched[i], effectiveTarget);
            scene.classList.add('popping');
            matchedZone.appendChild(scene);
          }
        }
        renderPlayersBar(snap);
        if (onComplete) onComplete();
      }, 500);
      state.pendingRollTimeouts.push(popT);
    } else {
      renderPlayersBar(snap);
      if (onComplete) onComplete();
    }
  }, scatterMs);

  state.pendingRollTimeouts.push(revealT);
}

// Wait for the server's roll response, then animate the reveal.
export function tryReveal() {
  if (!state.pendingRollState) {
    const t = setTimeout(tryReveal, 50);
    state.pendingRollTimeouts.push(t);
    return;
  }
  const snap = state.pendingRollState;
  state.pendingRollState = null;
  state.awaitingAck = false;
  state.currentState = snap;
  state.lastMyDiceKey = myDiceKey(snap);
  updateDiceInPlace(snap, () => {
    state.rolling = false;
    const btn = document.getElementById('roll-btn');
    if (btn) btn.disabled = false;
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ action: 'roll_done' }));
    }
    if (state.pendingWinName) {
      const name = state.pendingWinName, target = state.pendingWinTarget,
        round = state.pendingWinRound, isLoser = state.pendingWinIsLoser;
      state.pendingWinName = null;
      state.pendingWinTarget = null;
      state.pendingWinRound = null;
      state.pendingWinIsLoser = false;
      showWinner(name, target, round, isLoser);
    } else {
      hideWinner();
    }
    if (state.postRevealState) {
      const m = state.postRevealState;
      state.postRevealState = null;
      showFor(m);
    }
  });
}
