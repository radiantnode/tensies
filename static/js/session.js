// @ts-check

/**
 * Saved-session persistence. A player's identity (`pid` + game `code` +
 * private reconnect `token`) survives reloads in localStorage so a dropped
 * player can rejoin their held slot. Key names are part of the test-suite
 * contract (`game-harness` / `test-game` re-seed them directly).
 */

const PLAYER_ID_KEY = 'tensies_pid';
const GAME_CODE_KEY = 'tensies_code';
const TOKEN_KEY = 'tensies_token';

/** @param {string} playerId */
export function savePlayerId(playerId) {
  localStorage.setItem(PLAYER_ID_KEY, playerId);
}

/** @param {string} gameCode */
export function saveGameCode(gameCode) {
  localStorage.setItem(GAME_CODE_KEY, gameCode);
}

/** @param {string} token */
export function saveReconnectToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Read the saved session.
 * @returns {{ playerId: string | null, gameCode: string | null, token: string }}
 */
export function readSession() {
  return {
    playerId: localStorage.getItem(PLAYER_ID_KEY),
    gameCode: localStorage.getItem(GAME_CODE_KEY),
    token: localStorage.getItem(TOKEN_KEY) ?? '',
  };
}

/** Whether a resumable session (player id + game code) is saved. */
export function hasSession() {
  const { playerId, gameCode } = readSession();
  return Boolean(playerId && gameCode);
}

/**
 * Forget the current game but keep the durable anonymous identity
 * (`pid` + `token`). Called when a game ends / we leave / a reconnect window
 * lapses: there's no live slot to resume, but the pid must survive so the
 * player's *next* game shares one identity — and a later sign-up can collect
 * every game they played under the new account. Re-adoption of the pid on the
 * next create/join is authenticated by the token (see server `verify_claim`).
 */
export function clearGame() {
  localStorage.removeItem(GAME_CODE_KEY);
}

/** Forget everything, including the durable identity (e.g. sign-out). */
export function clearSession() {
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(GAME_CODE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}
