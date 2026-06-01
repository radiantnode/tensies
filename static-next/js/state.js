// Single mutable state bag shared across modules (mirrors the old state.js).
// Grows as later views need it (dice animation flags, bar cards, etc.).
export const state = {
  ws: null,
  myId: null,
  gameCode: null,
  pendingOrigin: null,        // 'landing' | 'join' — where a failed connect returns to
  currentState: null,         // last server state snapshot
  reconnecting: false,
  randomNamePlaceholder: '',  // the seeded "Zesty Pickle" name
};
