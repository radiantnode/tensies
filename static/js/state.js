// @ts-check
import { makeName } from './names.js';

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

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
  /** @type {'landing' | 'join' | null} Where a failed connect intent returns to. */
  pendingOrigin: null,
  /** @type {GameSnapshot | null} Last server snapshot. */
  currentState: null,
  reconnecting: false,
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
  /** True while the shake animation is running. */
  rolling: false,
  /** True while waiting on the server's roll response. */
  awaitingAck: false,
  /** @type {GameSnapshot | null} Roll response held until the shake finishes. */
  pendingRollState: null,
  /** @type {GameSnapshot | null} Newer broadcast that arrived mid-reveal. */
  postRevealState: null,
  /** @type {ReturnType<typeof setTimeout>[]} */
  pendingRollTimeouts: [],
  /** Matched dice before the in-flight roll (to find the newly locked ones). */
  prevMatchedCount: 0,
  rollShakeEnd: 0,
  /** @type {string | null} Winner overlay payload, held until the reveal completes. */
  pendingWinName: null,
  /** @type {number | null} */
  pendingWinTarget: null,
  /** @type {number | null} */
  pendingWinRound: null,
  pendingWinIsLoser: false,
};

// Test seam: expose the bag as window._state for the game-harness / test-game
// suites' evaluate() snippets. Localhost only — present in local dev and the
// local prod smoketest, never on a public deploy.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  /** @type {any} */ (window)._state = state;
}

/** Clear every in-flight roll/overlay field and cancel pending roll timers. */
export function resetRollState() {
  for (const timeout of state.pendingRollTimeouts) clearTimeout(timeout);
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
