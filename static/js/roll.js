// @ts-check
import { startShake, tryReveal } from './animations.js';
import { state } from './state.js';

/**
 * roll() — declare intent to the server, run the shake, then reveal whatever
 * the server sent back. The server owns the RNG; the guards here (rolling,
 * paused, open winner overlay) keep a spammed button from sending frames the
 * server would reject or, worse, trapping the next-round broadcast (the
 * sticky-overlay regression).
 */
export function roll() {
  if (state.rolling || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  if (state.currentState?.paused) return;
  const winner = /** @type {HTMLDialogElement | null} */ (document.getElementById('winner-overlay'));
  if (winner?.open) return;

  state.rolling = true;
  state.awaitingAck = true;
  state.pendingRollState = null;
  state.pendingWinName = null;
  state.pendingWinTarget = null;

  const me = state.myId ? state.currentState?.players[state.myId] : undefined;
  if (!me || !state.currentState) {
    state.rolling = false;
    state.awaitingAck = false;
    return;
  }

  state.prevMatchedCount = me.has_rolled
    ? me.dice.filter((d) => d === state.currentState?.target).length
    : 0;

  const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
  if (btn) btn.disabled = true;

  for (const timeout of state.pendingRollTimeouts) clearTimeout(timeout);
  state.pendingRollTimeouts = [];

  state.ws.send(JSON.stringify({ action: 'roll' }));
  startShake();

  const remaining = Math.max(0, state.rollShakeEnd - Date.now());
  const shakeT = setTimeout(tryReveal, remaining);
  state.pendingRollTimeouts.push(shakeT);
}
