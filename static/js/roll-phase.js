// @ts-check

/**
 * The roll → reveal → celebrate lifecycle, as one explicit machine.
 *
 * Replaces nine independent fields on the state bag (rolling, awaitingAck,
 * pendingRollState, postRevealState, rollShakeEnd, prevMatchedCount and the
 * five pendingWin* fields) with a single discriminated `phase`.
 *
 * Two rules earn their keep:
 *
 *   1. Transaction-scoped data lives INSIDE the phase that owns it, so it
 *      cannot be read from a phase where it is meaningless. `rollShakeEnd`
 *      only exists while a shake is running; the round result only exists once
 *      the server has named a winner. tsc enforces both at author time.
 *   2. Every write goes through `dispatch()` (state.js). No render function,
 *      no DOM query and no timeout callback mutates the machine directly —
 *      which is how `renderGame` used to end a roll as a side effect.
 *
 * The phases map onto what the old flags already encoded:
 *
 *   idle           !rolling && !awaitingAck
 *   shaking        rolling && awaitingAck && !pendingRollState, pre-shakeEnd
 *   awaitingServer  ...the same bit pattern, past shakeEnd — told apart only by
 *                   a Date.now() comparison buried inside tryReveal
 *   settling       rolling && awaitingAck && pendingRollState
 *   revealing      rolling && !awaitingAck
 *   celebrating    document.getElementById('winner-overlay').open  ← was in the DOM
 */

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

/**
 * The round result — previously five parallel pendingWin* fields that were
 * always set and cleared together.
 * @typedef {{
 *   name: string,
 *   photo: string | null,
 *   round: number,
 *   target: number,
 *   iWon: boolean,
 * }} RoundResult
 */

/**
 * @typedef {| { kind: 'idle' }
 *           | { kind: 'shaking',        shakeEnd: number, matchedBefore: number }
 *           | { kind: 'awaitingServer', deadline: number, matchedBefore: number }
 *           | { kind: 'settling',       shakeEnd: number, matchedBefore: number, snap: GameSnapshot, result: RoundResult | null, stashed: GameSnapshot | null }
 *           | { kind: 'revealing',      matchedBefore: number, snap: GameSnapshot, result: RoundResult | null, stashed: GameSnapshot | null }
 *           | { kind: 'celebrating',    result: RoundResult }
 *          } Phase
 */

/**
 * @typedef {| { t: 'ROLL_SENT',     shakeEnd: number, matchedBefore: number }
 *           | { t: 'SERVER_ROLL',   snap: GameSnapshot, result: RoundResult | null }
 *           | { t: 'SHAKE_DONE',    deadline: number }
 *           | { t: 'BROADCAST',     snap: GameSnapshot }
 *           | { t: 'REVEAL_DONE' }
 *           | { t: 'SHOW_RESULT',   result: RoundResult }
 *           | { t: 'ROUND_ADVANCE' }
 *           | { t: 'GIVE_UP' }
 *           | { t: 'RESET' }
 *          } RollEvent
 */

/** @type {Phase} */
export const IDLE = { kind: 'idle' };

/**
 * The complete legal-transition table. Anything not listed is a no-op — which
 * is the point: an illegal event in an illegal phase does nothing, instead of
 * half-updating three fields and stranding the board.
 *
 * @param {Phase} phase
 * @param {RollEvent} ev
 * @returns {Phase}
 */
export function transition(phase, ev) {
  // Leaving the game, a fatal error, an end_game, a reconnect, or a round we
  // have fallen behind — all collapse to idle from anywhere. This is the old
  // resetRollState(), as one named edge rather than nine assignments.
  if (ev.t === 'RESET') return IDLE;

  // A round_won that did NOT arrive mid-roll (we were idle, or already
  // revealing someone else's win): straight to the celebration.
  if (ev.t === 'SHOW_RESULT') return { kind: 'celebrating', result: ev.result };

  switch (phase.kind) {
    case 'idle':
      if (ev.t === 'ROLL_SENT') {
        return { kind: 'shaking', shakeEnd: ev.shakeEnd, matchedBefore: ev.matchedBefore };
      }
      return phase;

    case 'shaking':
      // The server answered before the shake finished — the common case.
      if (ev.t === 'SERVER_ROLL') {
        return {
          kind: 'settling',
          shakeEnd: phase.shakeEnd,
          matchedBefore: phase.matchedBefore,
          snap: ev.snap,
          result: ev.result,
          stashed: null,
        };
      }
      // The shake finished first: start the bounded wait. REVEAL_WAIT_MS lives
      // here, in the one phase where "the server owes us a frame" is true.
      if (ev.t === 'SHAKE_DONE') {
        return { kind: 'awaitingServer', deadline: ev.deadline, matchedBefore: phase.matchedBefore };
      }
      return phase;

    case 'awaitingServer':
      if (ev.t === 'SERVER_ROLL') {
        return {
          kind: 'revealing',
          matchedBefore: phase.matchedBefore,
          snap: ev.snap,
          result: ev.result,
          stashed: null,
        };
      }
      // The bounded exit, and the ONLY way out besides a frame. Previously an
      // inline Date.now() check inside tryReveal that had to hand-clear two
      // flags and re-enable the button (the roll-ack hang, client side).
      if (ev.t === 'GIVE_UP') return IDLE;
      return phase;

    case 'settling':
      if (ev.t === 'SHAKE_DONE') {
        return {
          kind: 'revealing',
          matchedBefore: phase.matchedBefore,
          snap: phase.snap,
          result: phase.result,
          stashed: phase.stashed,
        };
      }
      // A round_won landing on top of the roll frame we are already holding:
      // the win supersedes it, and brings the result with it.
      if (ev.t === 'SERVER_ROLL') return { ...phase, snap: ev.snap, result: ev.result };
      // A newer broadcast while we hold an unrevealed roll. Last writer wins,
      // and it can only be set here — the reveal consumes it on completion.
      if (ev.t === 'BROADCAST') return { ...phase, stashed: ev.snap };
      return phase;

    case 'revealing':
      if (ev.t === 'REVEAL_DONE') {
        // A win closes the reveal into the celebration and DISCARDS the stash
        // deliberately: a same-round frame would otherwise route through
        // showFor() → hideWinner() and cut the overlay short (the 2026-06-07
        // winner-flash fix, now structural rather than a guarded branch).
        if (phase.result) return { kind: 'celebrating', result: phase.result };
        return IDLE;
      }
      return phase;

    case 'celebrating':
      // Note what is absent: there is no ROLL_SENT edge here. The "spurious
      // roll queued during the overlay" regression is unrepresentable, rather
      // than guarded by reading winner-overlay.open out of the DOM.
      if (ev.t === 'ROUND_ADVANCE') return IDLE;
      return phase;

    default:
      return phase;
  }
}

// ── Derived predicates ────────────────────────────────────────────────────
// The questions the rest of the app actually asks. Each was previously an
// ad-hoc boolean expression or a DOM read, duplicated across roll.js, net.js
// and game-render.js.

/**
 * A `state` frame that is my own roll response, still owed to me.
 * @param {Phase} p
 */
export const awaitsRollFrame = (p) => p.kind === 'shaking' || p.kind === 'awaitingServer';

/**
 * The roll frame is in hand but unrevealed — newer broadcasts stash behind it.
 * @param {Phase} p
 */
export const holdsRollFrame = (p) => p.kind === 'settling';

/**
 * Nothing is in flight: the roll button may re-enable. Celebrating counts as
 * settled — the overlay covers the board, and the old
 * `!rolling && !awaitingAck` test read true there too.
 * @param {Phase} p
 */
export const settled = (p) => p.kind === 'idle' || p.kind === 'celebrating';

/**
 * Whether a `state` frame is a same-round opponent-roll echo arriving while
 * the win celebration is on screen. Such frames carry nothing the viewer can
 * see (the board is under the overlay scrim) but would route through
 * showFor() → hideWinner() and cut the celebration short (observed at 1153ms
 * and 759ms instead of the full ~3s).
 *
 * Pause and disconnect transitions are NOT echoes — interrupting the
 * celebration is correct for those — and the next-round frame keeps closing
 * the overlay as before.
 *
 * The round now comes from `p.result.round`, fixed when the win was declared,
 * rather than from `state.currentState.round_num`, which absorbed echoes
 * could drift.
 *
 * @param {Phase} p
 * @param {GameSnapshot} snap
 */
export const isCelebrationEcho = (p, snap) =>
  p.kind === 'celebrating'
  && snap.started
  && !snap.paused
  && snap.round_num === p.result.round
  && !Object.values(snap.players).some((player) => player.disconnected);

// ── Back-compat seam for the test suites ──────────────────────────────────
// game-harness, test-game and test-telemetry all poll `_state.rolling` and
// `_state.awaitingAck` as their "has it settled yet" predicate (the rollUntil
// driver), and two test-game steps read `_state.pendingRollState`. state.js
// exposes all three as GETTERS over these, so ~30 existing test snippets keep
// working — and, unlike two hand-maintained booleans, they cannot drift out of
// sync with the machine.

/** @param {Phase} p */
export const legacyRolling = (p) => p.kind === 'shaking' || p.kind === 'awaitingServer'
  || p.kind === 'settling' || p.kind === 'revealing';

/** @param {Phase} p */
export const legacyAwaitingAck = (p) => p.kind === 'shaking' || p.kind === 'awaitingServer'
  || p.kind === 'settling';

/** @param {Phase} p @returns {GameSnapshot | null} */
export const legacyPendingRollState = (p) => (p.kind === 'settling' ? p.snap : null);
