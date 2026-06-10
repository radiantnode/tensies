// Single mutable state bag shared across modules (mirrors the old state.js).
export const state = {
  ws: null,
  myId: null,
  gameCode: null,
  pendingOrigin: null,        // 'landing' | 'join' — where a failed connect returns to
  currentState: null,         // last server state snapshot
  reconnecting: false,
  randomNamePlaceholder: '',  // the seeded "Zesty Pickle" name

  // ── Game board / roll choreography ──
  barCards: {},               // pid -> <player-card>, reused across renders
  lastMyDiceKey: null,        // fingerprint to skip needless my-area re-renders
  rolling: false,             // shake animation running
  awaitingAck: false,         // waiting on the server's roll response
  pendingRollState: null,     // held roll response until the shake finishes
  postRevealState: null,      // a newer broadcast that arrived mid-reveal
  pendingRollTimeouts: [],
  prevMatchedCount: 0,        // matched dice before this roll (to find the new ones)
  rollShakeEnd: 0,
  pendingWinName: null,       // winner overlay, held until the reveal completes (view 6)
  pendingWinTarget: null,
  pendingWinRound: null,
  pendingWinIsLoser: false,
};

// Expose the shared state bag for the test-game skill's evaluate() snippets.
// Gated to localhost so it's available in local dev and the local prod
// smoketest, but never on a public deploy. See .claude/skills/test-game/skill.md.
if (typeof window !== 'undefined' &&
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window._state = state;
}

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
