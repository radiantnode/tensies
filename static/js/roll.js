// roll() — declare intent to the server, run the shake, then reveal whatever the
// server sent back. Server owns the RNG. Ported verbatim from the original.
import { state } from './state.js';
import { startShake, tryReveal } from './animations.js';

export function roll() {
  if (state.rolling || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  if (state.currentState?.paused) return;
  const winner = document.getElementById('winner-overlay');
  if (winner?.open) return;

  state.rolling = true;
  state.awaitingAck = true;
  state.pendingRollState = null;
  state.pendingWinName = null;
  state.pendingWinTarget = null;

  const p = state.currentState?.players[state.myId];
  if (!p) { state.rolling = false; state.awaitingAck = false; return; }

  state.prevMatchedCount = p.has_rolled
    ? p.dice.filter((d) => d === state.currentState.target).length
    : 0;

  const btn = document.getElementById('roll-btn');
  if (btn) btn.disabled = true;

  state.pendingRollTimeouts.forEach(clearTimeout);
  state.pendingRollTimeouts = [];

  state.ws.send(JSON.stringify({ action: 'roll' }));
  startShake();

  const remaining = Math.max(0, state.rollShakeEnd - Date.now());
  const shakeT = setTimeout(tryReveal, remaining);
  state.pendingRollTimeouts.push(shakeT);
}
