// @ts-check
import { FACE_ROTATIONS, makeDie, myDiceKey, placeGrid } from './dice.js';
import { saveDicePositions } from './dice-positions.js';
import { renderMyArea, renderPlayersBar } from './game-render.js';
import { hideWinner, showWinner } from './overlays.js';
import { showFor } from './router.js';
import { dispatch, state } from './state.js';

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

/**
 * Roll choreography: gather → 3-D tumble → reveal faces → scatter, with newly
 * matched dice lifting off into the matched zone. Timings are part of the
 * delayed-broadcast contract (the server waits on our roll_done ack), so the
 * sequence is preserved exactly.
 */

/**
 * Begin the gather + tumble phase of a roll (skipped under reduced motion).
 * @returns {number} epoch ms at which the shake ends — the caller puts it in
 *   the phase, so it exists only while a shake is actually running.
 */
export function startShake() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // No motion, same pace. Skipping the wait entirely made reduced motion a
    // ~40%-faster roll cadence — roughly a 70% round-win rate against a
    // default-animation opponent. 700ms is the midpoint of the normal
    // gather+shake window (500–900ms), so the cadence matches; it also keeps
    // the cycle above the server's MIN_ROLL_INTERVAL floor.
    return Date.now() + 700;
  }
  const gatherMs = 200;
  const shakeMs = 300 + Math.random() * 400;
  const shakeEnd = Date.now() + gatherMs + shakeMs;

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
  return shakeEnd;
}

/**
 * Animate my dice from tumbling to the new snapshot: scatter to fresh
 * positions, reveal faces, lift newly matched dice into the locked zone.
 * @param {GameSnapshot} snap
 * @param {number} matchedBefore matched dice as of the roll being revealed —
 *   supplied by the phase rather than read off the shared bag, so it cannot be
 *   stale from an earlier roll.
 * @param {() => void} [onComplete]
 * @param {boolean} [winForMe] skip the move-to-locked choreography — the
 *   winner overlay takes over as the dice land.
 */
export function updateDiceInPlace(snap, matchedBefore, onComplete, winForMe = false) {
  for (const timeout of state.pendingRollTimeouts) clearTimeout(timeout);
  state.pendingRollTimeouts = [];
  document.querySelectorAll('.zone-unmatched .die-wrapper.lifting').forEach((w) => w.remove());

  const player = state.myId ? snap.players[state.myId] : undefined;
  const wrappers = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.zone-unmatched .die-wrapper')]);

  // If the board on screen was built for a different round, we fell behind the
  // server — a round-advance broadcast was lost (flaky link) — and are only now
  // catching up through this roll response. Animating in place would paint the
  // new round's dice onto the stale board: old locks kept, new target stacking
  // on top (the dropped-broadcast frankenboard). Hard-rebuild to the round the
  // snapshot actually describes.
  const staleBoard = state.boardRound != null && snap.round_num !== state.boardRound;
  if (!player || wrappers.length === 0 || staleBoard) {
    renderMyArea(snap);
    renderPlayersBar(snap);
    if (onComplete) onComplete();
    return;
  }

  const effectiveTarget = player.has_rolled ? snap.target : -1;
  const newMatched = player.dice.filter((d) => d === effectiveTarget);
  const newUnmatched = player.dice.filter((d) => d !== effectiveTarget);
  const newlyMatchedCount = Math.max(0, newMatched.length - matchedBefore);

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
      const value = newMatched[matchedBefore + i];
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

    if (newlyMatchedCount > 0) {
      const popT = setTimeout(() => {
        // A pop the round has moved past must not drop its now-stale matched
        // dice into the next round's fresh zone, so bail once a later snapshot
        // (a round advance) has replaced ours.
        if (state.currentState && state.currentState.round_num !== snap.round_num) {
          if (onComplete) onComplete();
          return;
        }
        // Reconcile the locked zone to exactly this snapshot's matched dice
        // instead of blindly appending matchedBefore→length. Under a
        // reveal/rebuild race the live zone can already hold a different count
        // than matchedBefore assumed, and a blind append then stacks it past
        // 10 (the "locked dice keep stacking beyond 10" bug). Re-query the live
        // zone, trim any excess, then pop in only the genuinely-missing dice so
        // the animation still plays.
        const matchedZone = document.querySelector('.zone-matched');
        if (matchedZone) {
          while (matchedZone.children.length > newMatched.length) {
            matchedZone.lastElementChild?.remove();
          }
          for (let i = matchedZone.children.length; i < newMatched.length; i++) {
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

// Give up waiting for the roll response this long after the shake ends. The
// server replies to the roller immediately (the private roll frame), so a wait
// past this means the response was dropped or the roll was rejected — without a
// cap the button stays disabled forever (the roll-ack hang, client side).
const REVEAL_WAIT_MS = 2500;

/** Re-enable the roll button and repaint the board from the last known state. */
function unstick() {
  const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
  if (btn) btn.disabled = false;
  if (state.currentState) {
    renderMyArea(state.currentState);
    renderPlayersBar(state.currentState);
  }
}

/**
 * Drive the machine forward from wherever it is. Called when the shake timer
 * fires and then on its own 50ms tick while the server still owes us a frame.
 *
 * This replaces tryReveal's poll-and-branch. The difference that matters: the
 * give-up deadline belongs to `awaitingServer` and to nothing else, so "the
 * server owes me a roll frame" and "I am mid-reveal" can no longer be the same
 * bit pattern told apart by a Date.now() comparison.
 */
export function pumpRoll() {
  const phase = state.phase;

  // The shake finished before the server answered: enter the bounded wait.
  if (phase.kind === 'shaking') {
    dispatch({ t: 'SHAKE_DONE', deadline: phase.shakeEnd + REVEAL_WAIT_MS });
    pumpRoll();
    return;
  }

  // The frame is in hand and the shake has just ended: reveal it.
  if (phase.kind === 'settling') {
    dispatch({ t: 'SHAKE_DONE', deadline: 0 });
    pumpRoll();
    return;
  }

  if (phase.kind === 'awaitingServer') {
    if (Date.now() > phase.deadline) {
      // A rejected roll (e.g. "Slow down") also lands here — handleError
      // surfaces the reason; this just clears the spinner.
      dispatch({ t: 'GIVE_UP' });
      unstick();
      return;
    }
    const t = setTimeout(pumpRoll, 50);
    state.pendingRollTimeouts.push(t);
    return;
  }

  if (phase.kind === 'revealing') runReveal(phase);
}

/**
 * Animate the held roll frame, then hand off to the celebration or back to
 * idle. Everything it needs rides in the phase.
 * @param {Extract<import('./roll-phase.js').Phase, {kind: 'revealing'}>} phase
 */
function runReveal(phase) {
  const snap = phase.snap;
  state.currentState = snap;
  state.lastMyDiceKey = myDiceKey(snap);
  // The completing roll is mine: skip the move-to-locked choreography and pop
  // the result overlay as the dice land — you don't watch your own win migrate.
  const winForMe = Boolean(phase.result?.iWon);

  updateDiceInPlace(snap, phase.matchedBefore, () => {
    // Re-read: a BROADCAST may have stashed a newer frame while we animated.
    const current = state.phase;
    const result = current.kind === 'revealing' ? current.result : null;
    const stashed = current.kind === 'revealing' ? current.stashed : null;

    dispatch({ t: 'REVEAL_DONE' });

    const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
    if (btn) btn.disabled = false;
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ action: 'roll_done' }));
    }

    if (result) {
      // The stash is dropped, not routed: it is a same-round snapshot that
      // would call hideWinner() and close the overlay we are about to open.
      // The authoritative next-round state arrives after ROUND_WIN_DELAY.
      // (The 2026-06-07 winner-flash fix — now a property of the transition
      // itself, see roll-phase.js.)
      showWinner(result.name, result.photo, result.round, result.iWon);
    } else {
      hideWinner();
      if (stashed) showFor(stashed);
    }
  }, winForMe);
}
