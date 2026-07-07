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

// "Allow Nearby" consent — a per-device preference, deliberately independent of
// the game session above (not cleared by clearSession): once the host has both
// confirmed the explainer and granted geolocation, re-toggling Nearby skips the
// dialog. A revoked geolocation permission clears it so the explainer returns.
const NEARBY_CONSENT_KEY = 'tensies_nearby_ok';

/** Record that the host confirmed the "Allow Nearby" explainer AND granted
 *  geolocation at least once, so the dialog can be skipped next time. */
export function saveNearbyConsent() {
  localStorage.setItem(NEARBY_CONSENT_KEY, '1');
}

/** Whether the host previously consented to broadcasting their location. */
export function hasNearbyConsent() {
  return localStorage.getItem(NEARBY_CONSENT_KEY) === '1';
}

/** Forget the nearby consent (e.g. geolocation was revoked) so the explainer
 *  shows again next time. */
export function clearNearbyConsent() {
  localStorage.removeItem(NEARBY_CONSENT_KEY);
}
