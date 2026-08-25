// @ts-check

/**
 * The error ladder (alarm.json): most of what this codebase calls an error is
 * not an alarm. A CORRECTION (cream, the default) is "you mistyped — the
 * barman shakes his head". A REFUSAL (amber) is the house not serving you
 * right now — capacity, rate limits, a full or paused table, and the terminal
 * "table sat paused for an hour" frame, which LOOKS like an alarm and isn't:
 * nothing went wrong, the house closed the tab. Vermilion never appears here —
 * it has exactly one use in the app (a Roll Trust failure).
 */

/** The house's refusals, matched against the server's error copy. */
const REFUSALS = [
  /at capacity/i,
  /slow down/i,
  /too many/i,
  /game is full/i,
  /game is paused/i,
  /message too large/i,
  /paused too long/i,
];

/**
 * Write an error message into an .error-msg element with its register.
 * @param {HTMLElement | null} el
 * @param {string} message
 */
export function setError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('is-refusal', REFUSALS.some((re) => re.test(message)));
}
