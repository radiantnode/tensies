// @ts-check

/**
 * Shared JSDoc type definitions for the WebSocket protocol.
 *
 * The shapes mirror the server's `state_msg()` in `server/game.py` — the
 * protocol is fixed; the client conforms to it, never the reverse.
 */

/**
 * @typedef {object} PlayerSnapshot
 * @property {string} name
 * @property {number[]} dice Die values 1–6. A die is matched/locked when its
 *   value equals the snapshot's `target`; there is no separate locked flag.
 * @property {number} wins
 * @property {boolean} has_rolled
 * @property {number} roll_count
 * @property {boolean} [disconnected]
 * @property {string | null} [photo] Account avatar URL; null/absent for
 *   anonymous players (the client falls back to the default avatar).
 */

/**
 * @typedef {object} GameSnapshot
 * @property {'state' | 'round_won'} type
 * @property {string} code
 * @property {number} target Cycles 1→2→3→4→5→6→1 between rounds.
 * @property {number} round_num
 * @property {boolean} started
 * @property {boolean} paused
 * @property {string} host Player id of the current host.
 * @property {Record<string, PlayerSnapshot>} players
 * @property {string} [winner_name] Present on `round_won` frames.
 * @property {number} [pause_remaining_ms] Present on paused frames sent to the host.
 */

/**
 * @typedef {object} WelcomeMessage
 * @property {'welcome'} type
 * @property {string} player_id
 */

/**
 * @typedef {object} AuthOkMessage
 * @property {'auth_ok'} type
 * @property {string} username
 * @property {string} user_id
 * @property {string} player_id The account UUID the server rebound the session to.
 */

/**
 * Player lifetime stats, as returned by /auth/register/verify and
 * /api/profile. All fields absent when the player has no games.
 * @typedef {object} PlayerStats
 * @property {number} [total_games]
 * @property {number} [total_wins]
 * @property {number} [total_rounds]
 * @property {number} [total_rolls]
 * @property {number} [fastest_win_ms]
 * @property {number} [total_time_played_ms]
 */

/**
 * @typedef {object} ReconnectTokenMessage
 * @property {'reconnect_token'} type
 * @property {string} token
 */

/**
 * @typedef {object} PingMessage
 * @property {'ping'} type
 * @property {number} t
 */

/**
 * @typedef {object} ErrorMessage
 * @property {'error'} type
 * @property {string} msg
 * @property {boolean} [fatal] Terminal — the game is gone; clear the session.
 */

/**
 * @typedef {object} GameEndedPlayer
 * @property {string} name
 * @property {number} wins
 */

/**
 * @typedef {object} GameEndedMessage
 * @property {'game_ended'} type
 * @property {string} ended_by Name of the host who ended the game.
 * @property {number} round_num The in-progress round number (completed = round_num - 1).
 * @property {Record<string, GameEndedPlayer>} players
 */

/**
 * @typedef {WelcomeMessage | AuthOkMessage | ReconnectTokenMessage | PingMessage | ErrorMessage | GameEndedMessage | GameSnapshot} ServerMessage
 */

export {};
