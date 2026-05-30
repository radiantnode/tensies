import { state } from './state.js';
import { startShake, tryReveal } from './animations.js';

export function roll() {
  if (state.rolling || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  // Game is paused by the host — no rolling for anyone (Space shortcut included).
  if (state.currentState?.paused) return;
  // Block rolls while the winner overlay is up — the server has round_over=True
  // and will silently drop the roll, but the client would have already flipped
  // awaitingAck=true, which then traps the next state message in
  // pendingRollState and leaves the winner dialog stuck.
  const winner = document.getElementById('winner-overlay');
  if (winner?.open) return;
  state.rolling = true;
  state.awaitingAck = true;
  state.pendingRollState = null;
  state.pendingWinName = null;
  state.pendingWinTarget = null;

  const p = state.currentState?.players[state.myId];
  if (!p) { state.rolling = false; state.awaitingAck = false; return; }

  // Snapshot matched count so we know which are "new" this roll
  state.prevMatchedCount = p.has_rolled
    ? p.dice.filter(d => d === state.currentState.target).length
    : 0;

  const btn = document.getElementById('roll-btn');
  if (btn) btn.disabled = true;

  state.pendingRollTimeouts.forEach(clearTimeout);
  state.pendingRollTimeouts = [];

  // Server owns the RNG — we just declare intent
  state.ws.send(JSON.stringify({ action: 'roll' }));
  startShake();

  // After shake ends, run the reveal with whatever the server sent back
  const remaining = Math.max(0, state.rollShakeEnd - Date.now());
  const shakeT = setTimeout(tryReveal, remaining);
  state.pendingRollTimeouts.push(shakeT);
}
