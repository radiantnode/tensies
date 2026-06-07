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
