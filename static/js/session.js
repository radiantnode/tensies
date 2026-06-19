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

/** Forget the saved session (game ended, or reconnect window expired). */
export function clearSession() {
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(GAME_CODE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}
