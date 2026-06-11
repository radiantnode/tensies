// @ts-check

/**
 * Winner + pause dialog control. Minimal for now: the dialogs' markup and the
 * full open/close choreography land with the overlay views; until then these
 * guard on the dialogs' absence so the roll flow can ship first.
 */

/** Delay before the menu closes after a resume (the toggle's slide-off). */
export const RESUME_CLOSE_DELAY_MS = 350;

/** @returns {HTMLDialogElement | null} */
function winnerDialog() {
  return /** @type {HTMLDialogElement | null} */ (document.getElementById('winner-overlay'));
}

/**
 * Show the round result overlay.
 * @param {string} name winner's name
 * @param {number} target the round's target value
 * @param {number} round the round number that was won
 * @param {boolean} isLoser true when the viewer did not win
 */
export function showWinner(name, target, round, isLoser) {
  void name; void target; void round; void isLoser;
  // Implemented with the overlay view.
}

/** Close the winner overlay if it's open. */
export function hideWinner() {
  const dialog = winnerDialog();
  if (dialog?.open) dialog.close();
}
