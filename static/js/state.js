// Single mutable bag shared across modules. Module-scope `let` exports are
// read-only on the importing side, so a shared object is the simplest way for
// every module to read and write the same client-side state.
export const state = {
  ws: null,
  myId: null,
  gameCode: null,
  currentState: null,

  // Roll animation sequencing
  rolling: false,
  awaitingAck: false,
  pendingRollState: null,    // server's response, held until shake animation ends
  pendingWinName: null,      // winner overlay info, held until reveal completes
  pendingWinTarget: null,
  pendingRollTimeouts: [],
  rollShakeEnd: 0,
  prevMatchedCount: 0,
  lastMyDiceKey: null,

  // Players-bar cards persisted across rounds for in-place updates
  barCards: {},

  // Reconnection
  reconnecting: false,

  // Random-name placeholder (loaded from /random-name)
  randomNamePlaceholder: 'Player',
};

// Exposed for the test-game skill (page.evaluate can't reach module locals).
if (typeof window !== 'undefined') window._state = state;
