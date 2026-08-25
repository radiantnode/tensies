// @ts-check
import { pumpRoll, startShake } from './animations.js';
import { dispatch, state } from './state.js';

/**
 * roll() — declare intent to the server, run the shake, then reveal whatever
 * the server sent back. The server owns the RNG.
 *
 * The three separate guards this used to carry (`state.rolling`, an open
 * winner overlay read out of the DOM, and the paused flag) collapse into one
 * question: is the machine idle? `celebrating` has no ROLL_SENT edge, so a
 * roll tapped through the round-result overlay can no longer trap the
 * next-round broadcast — the sticky-overlay regression is unrepresentable
 * rather than guarded.
 */
export function roll() {
  if (state.phase.kind !== 'idle') return;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  if (state.currentState?.paused) return;

  const me = state.myId ? state.currentState?.players[state.myId] : undefined;
  if (!me || !state.currentState) return;

  // Matched dice as of *this* roll, so the reveal can tell which ones newly
  // locked. It rides in the phase rather than on the bag: a value that only
  // means anything between ROLL_SENT and REVEAL_DONE should not be readable
  // outside that window, and should not survive a reset.
  const matchedBefore = me.has_rolled
    ? me.dice.filter((d) => d === state.currentState?.target).length
    : 0;

  const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
  if (btn) btn.disabled = true;

  for (const timeout of state.pendingRollTimeouts) clearTimeout(timeout);
  state.pendingRollTimeouts = [];

  state.ws.send(JSON.stringify({ action: 'roll' }));

  const shakeEnd = startShake();
  dispatch({ t: 'ROLL_SENT', shakeEnd, matchedBefore });

  const shakeT = setTimeout(pumpRoll, Math.max(0, shakeEnd - Date.now()));
  state.pendingRollTimeouts.push(shakeT);
}
