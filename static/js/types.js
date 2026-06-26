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
 * @property {string} [commentary] TAS commentary line for the roller's own roll.
 */

/**
 * @typedef {object} WelcomeMessage
 * @property {'welcome'} type
 * @property {string} player_id
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
 * @typedef {WelcomeMessage | ReconnectTokenMessage | PingMessage | ErrorMessage | GameEndedMessage | GameSnapshot} ServerMessage
 */

export {};
