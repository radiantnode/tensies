// @ts-check
import { hideToast, quip, recordRoll, toast } from './attitude.js';
import { FACE_ROTATIONS, makeDie, myDiceKey, placeGrid } from './dice.js';
import { saveDicePositions } from './dice-positions.js';
import { renderMyArea, renderPlayersBar } from './game-render.js';
import { hideWinner, showWinner } from './overlays.js';
import { showFor } from './router.js';
import { state } from './state.js';

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

/**
 * Roll choreography: gather → 3-D tumble → reveal faces → scatter, with newly
 * matched dice lifting off into the matched zone. Timings are part of the
 * delayed-broadcast contract (the server waits on our roll_done ack), so the
 * sequence is preserved exactly.
 */

/** Begin the gather + tumble phase of a roll (skipped under reduced motion). */
export function startShake() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.rollShakeEnd = Date.now();
    return;
  }
  const gatherMs = 200;
  const shakeMs = 300 + Math.random() * 400;
  state.rollShakeEnd = Date.now() + gatherMs + shakeMs;

  const wrappers = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.zone-unmatched .die-wrapper')]);
  const zone = document.querySelector('.zone-unmatched');
  const sz = window.innerWidth <= 480 ? 50 : 56;

  if (zone && wrappers.length) {
    const rect = zone.getBoundingClientRect();
    const cx = (rect.width - sz) / 2;
    const cy = (rect.height - sz) / 2;
    for (const wrapper of wrappers) {
      const ox = (Math.random() - 0.5) * 44;
      const oy = (Math.random() - 0.5) * 44;
      const rot = (Math.random() - 0.5) * 30;
      wrapper.style.transition = `transform ${gatherMs}ms ease-in`;
      wrapper.style.transform = `translate(${cx + ox}px, ${cy + oy}px) rotate(${rot}deg)`;
    }
  }

  const gatherT = setTimeout(() => {
    const anims = ['tumbling-a', 'tumbling-b', 'tumbling-c'];
    for (const wrapper of wrappers) {
      wrapper.style.transition = '';
      const cube = /** @type {HTMLElement | null} */ (wrapper.querySelector('.die-3d'));
      if (cube) {
        cube.classList.add(anims[Math.floor(Math.random() * 3)]);
        cube.style.animationDelay = `-${Math.floor(Math.random() * 500)}ms`;
      }
    }
  }, gatherMs);
  state.pendingRollTimeouts.push(gatherT);
}

/**
 * Animate my dice from tumbling to the new snapshot: scatter to fresh
 * positions, reveal faces, lift newly matched dice into the locked zone.
 * @param {GameSnapshot} snap
 * @param {() => void} [onComplete]
 * @param {boolean} [winForMe] skip the move-to-locked choreography — the
 *   winner overlay takes over as the dice land.
 */
export function updateDiceInPlace(snap, onComplete, winForMe = false) {
  for (const timeout of state.pendingRollTimeouts) clearTimeout(timeout);
  state.pendingRollTimeouts = [];
  document.querySelectorAll('.zone-unmatched .die-wrapper.lifting').forEach((w) => w.remove());

  const player = state.myId ? snap.players[state.myId] : undefined;
  const wrappers = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.zone-unmatched .die-wrapper')]);

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
  /** @type {import('./dice.js').DiePosition[]} */
  const finalPositions = [];

  // The winner still scatters and reveals their dice on the target — only the
  // subsequent move into the locked zone is skipped (see winForMe below).
  if (zone) {
    const rect = zone.getBoundingClientRect();
    for (const p of placeGrid(rect, wrappers.length, sz)) finalPositions.push(p);
    wrappers.forEach((wrapper, i) => {
      const p = finalPositions[i];
      wrapper.style.transition = `transform ${scatterMs}ms ease-out`;
      wrapper.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
    });
  }

  saveDicePositions(snap.code, snap.round_num, finalPositions.slice(0, newUnmatched.length));

  /**
   * Settle a cube out of its tumble onto a final face.
   * @param {HTMLElement} cube
   * @param {number} value
   * @param {boolean} matched
   */
  const settleCube = (cube, value, matched) => {
    const liveTransform = getComputedStyle(cube).transform;
    cube.style.transform = liveTransform;
    void cube.getBoundingClientRect();
    cube.classList.remove('tumbling-a', 'tumbling-b', 'tumbling-c');
    cube.style.animationDelay = '';
    cube.className = matched ? 'die-3d match' : 'die-3d';
    cube.style.transition = 'transform 0.3s ease-out';
    cube.style.transform = FACE_ROTATIONS[value] ?? 'rotateY(0deg)';
    cube.addEventListener('transitionend', () => { cube.style.transition = ''; }, { once: true });
  };

  const revealT = setTimeout(() => {
    for (const wrapper of wrappers) wrapper.style.transition = '';

    newUnmatched.forEach((value, i) => {
      const cube = /** @type {HTMLElement | null} */ (wrappers[i]?.querySelector('.die-3d'));
      if (cube) settleCube(cube, value, false);
    });

    for (let i = 0; i < newlyMatchedCount; i++) {
      const wrapper = wrappers[newUnmatched.length + i];
      if (!wrapper) continue;
      const cube = /** @type {HTMLElement | null} */ (wrapper.querySelector('.die-3d'));
      const value = newMatched[state.prevMatchedCount + i];
      if (cube) settleCube(cube, value, true);
      // The winner doesn't watch their final dice fly into the locked zone —
      // the overlay takes over. Everyone else's progress lifts as usual.
      if (winForMe) continue;
      const liftT = setTimeout(() => {
        wrapper.classList.add('lifting');
        const removeT = setTimeout(() => wrapper.remove(), 280);
        state.pendingRollTimeouts.push(removeT);
      }, 400);
      state.pendingRollTimeouts.push(liftT);
    }

    // Winning roll: the scatter above has revealed the winning dice on the
    // target. Show the win state immediately — no lift/pop into the locked
    // zone, no post-landing dwell.
    if (winForMe) {
      renderPlayersBar(snap);
      if (onComplete) onComplete();
      return;
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

/** Wait for the server's roll response, then animate the reveal. */
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
  // The completing roll is mine: skip the move-to-locked choreography and pop
  // the winner overlay as the dice land — you don't watch your own win migrate.
  const winForMe = Boolean(state.pendingWinName) && !state.pendingWinIsLoser;
  updateDiceInPlace(snap, () => {
    state.rolling = false;
    const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
    if (btn) btn.disabled = false;
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ action: 'roll_done' }));
    }
    if (state.pendingWinName) {
      const name = state.pendingWinName;
      const target = state.pendingWinTarget ?? 0;
      const round = state.pendingWinRound ?? 0;
      const isLoser = state.pendingWinIsLoser;
      state.pendingWinName = null;
      state.pendingWinTarget = null;
      state.pendingWinRound = null;
      state.pendingWinIsLoser = false;
      // Drop any mid-reveal broadcast stashed in postRevealState — it's a
      // same-round snapshot that would call hideWinner() and close the
      // overlay. The authoritative next-round state arrives after
      // ROUND_WIN_DELAY. (The 2026-06-07 winner-flash fix.)
      state.postRevealState = null;
      showWinner(name, target, round, isLoser);
    } else {
      // Roll settled without a round result: let the attitude react to the
      // outcome (bust streaks, a big roll, one die left). No-op at level off.
      const me = state.myId ? snap.players[state.myId] : undefined;
      if (me) {
        const matchedNow = me.dice.filter((d) => d === snap.target).length;
        const gained = matchedNow - state.prevMatchedCount;
        const scenario = recordRoll(gained, matchedNow);
        if (scenario) toast(quip(scenario, '', { target: snap.target, count: gained }));
        else hideToast(); // an unremarkable roll supersedes the last line
      }
      hideWinner();
      if (state.postRevealState) {
        const stashed = state.postRevealState;
        state.postRevealState = null;
        showFor(stashed);
      }
    }
  }, winForMe);
}
