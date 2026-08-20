// @ts-check
import { makeName } from './names.js';
import {
  IDLE, transition, legacyRolling, legacyAwaitingAck, legacyPendingRollState,
} from './roll-phase.js';

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */
/** @typedef {import('./roll-phase.js').Phase} Phase */
/** @typedef {import('./roll-phase.js').RollEvent} RollEvent */

/**
 * Single mutable state bag shared across modules.
 *
 * Kept deliberately flat: every field is readable in one hop from anywhere,
 * and the test suites assert on these exact names (see the localhost seam
 * below).
 */
export const state = {
  /** @type {WebSocket | null} */
  ws: null,
  /** @type {string | null} */
  myId: null,
  /** @type {string | null} */
  gameCode: null,
  /** @type {'landing' | 'join' | 'nearby' | null} Where a failed connect intent returns to. */
  pendingOrigin: null,
  /** @type {GameSnapshot | null} Last server snapshot. */
  currentState: null,
  /** @type {string | null} Invite QR as a base64 data URL, sent once with the
   *  reconnect_token (create/join/lobby-reconnect) so the lobby stamp shows it
   *  with no separate fetch. Null → the stamp falls back to /api/qr. */
  qr: null,
  reconnecting: false,
  /** True for one game-detail render right after a game_ended, so the detail
   *  screen can show its "Game ended" banner. Set in net.js, cleared on read. */
  gameJustEnded: false,
  /** @type {string | null} Authenticated account username (from JWT). */
  authUsername: null,
  /** @type {string | null} Authenticated account user ID (from JWT). */
  authUserId: null,
  // The "Zesty Pickle" name shared by both name-field placeholders. Seeded
  // here because state.js evaluates before any component module — this must
  // stay the FIRST Math.random consumer (the pixel harness pins the RNG).
  randomNamePlaceholder: makeName(),

  // ── Game board / roll choreography (driven by the game view) ──
  /** @type {string | null} Fingerprint to skip needless my-area re-renders. */
  lastMyDiceKey: null,
  /** @type {number | null} Round the my-area board was last (re)built for. Lets
   *  the reveal detect a stale board — a round-advance broadcast we never got —
   *  and hard-rebuild instead of animating new dice onto the old round. */
  boardRound: null,
  /**
   * The roll/reveal/celebrate lifecycle. One discriminated phase in place of
   * the nine flags this bag used to carry (rolling, awaitingAck,
   * pendingRollState, postRevealState, rollShakeEnd, prevMatchedCount and the
   * five pendingWin* fields). Only ever written through dispatch() below.
   * @type {Phase}
   */
  phase: IDLE,

  /** @type {ReturnType<typeof setTimeout>[]} Live roll-animation timers. */
  pendingRollTimeouts: [],

  // ── Read-only compatibility seam ──
  // The game-harness / test-game / test-telemetry suites poll these three by
  // name (`_state.rolling`, `_state.awaitingAck`, `_state.pendingRollState`).
  // Derived, so they cannot drift from the phase; get-only, so tsc rejects any
  // code that tries to end a roll by assigning a flag.
  /** @returns {boolean} */
  get rolling() { return legacyRolling(this.phase); },
  /** @returns {boolean} */
  get awaitingAck() { return legacyAwaitingAck(this.phase); },
  /** @returns {GameSnapshot | null} */
  get pendingRollState() { return legacyPendingRollState(this.phase); },
};

/**
 * The single write site for the roll machine. Every phase change in the app
 * goes through here.
 * @param {RollEvent} ev
 */
export function dispatch(ev) {
  state.phase = transition(state.phase, ev);
}

// Test seam: expose the bag as window._state for the game-harness / test-game
// suites' evaluate() snippets. Localhost only — present in local dev and the
// local prod smoketest, never on a public deploy.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  /** @type {any} */ (window)._state = state;
}

/**
 * Collapse the roll machine to idle and cancel its timers. Unlike the nine
 * assignments this replaces, it cannot leave a field behind: `rollShakeEnd`
 * and `prevMatchedCount` used to survive a reset because they were never in
 * the list, and now they live inside the phase that is being discarded.
 */
export function resetRollState() {
  for (const timeout of state.pendingRollTimeouts) clearTimeout(timeout);
  state.pendingRollTimeouts = [];
  dispatch({ t: 'RESET' });
}
