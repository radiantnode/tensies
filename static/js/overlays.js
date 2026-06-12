// @ts-check

/**
 * Dialog overlays — the winner/loser celebration and the non-host pause wait
 * screen. Both sit on top of the still-visible game board. (Loading is a
 * screen, not a dialog.) Module scripts run after parsing, so the dialogs in
 * index.html exist by the time these lookups run.
 */

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

import { quip, wasNearMiss } from './attitude.js';
import { state } from './state.js';

const winner = /** @type {HTMLDialogElement | null} */ (document.getElementById('winner-overlay'));
const pauseOverlay = /** @type {HTMLDialogElement | null} */ (document.getElementById('pause-overlay'));

// Neither dialog may be Escape-dismissed — only game state closes them.
winner?.addEventListener('cancel', (event) => event.preventDefault());
pauseOverlay?.addEventListener('cancel', (event) => event.preventDefault());

/**
 * On resume, hold the pause overlay / menu a beat so the toggle's slide-off
 * is visible before things close.
 */
export const RESUME_CLOSE_DELAY_MS = 600;

// ── Pause overlay (non-host) ──

/**
 * Open the pause wait dialog with the given message.
 * @param {string} text
 */
export function showPaused(text) {
  const msg = document.getElementById('pause-overlay-msg');
  if (msg) msg.textContent = text;
  if (pauseOverlay && !pauseOverlay.open) pauseOverlay.showModal();
}

/** Close the pause wait dialog if it's open. */
export function hidePaused() {
  if (pauseOverlay?.open) pauseOverlay.close();
}

/**
 * "Waiting for <Host> to resume the game"
 * @param {GameSnapshot} snap
 */
export function pausedText(snap) {
  const host = snap.players[snap.host]?.name || 'the host';
  return quip('pause.waiting_for_host', `Waiting for ${host} to resume the game`, { host });
}

/**
 * "Waiting for A and B to reconnect…" from a list of dropped player names.
 * @param {string[]} names
 */
export function waitingText(names) {
  if (names.length === 0) return '';
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return quip('waiting_reconnect', `Waiting for ${list} to reconnect…`, { names: list });
}

// ── Winner / loser overlay ──

// The server holds the overlay for ROUND_WIN_DELAY (server/config.py) before
// advancing the round — mirror it here to drive the countdown.
const WIN_OVERLAY_MS = 3000;

/** @type {ReturnType<typeof setInterval> | undefined} */
let winTimer;

function startWinTimer() {
  const fill = document.getElementById('winner-timer-fill');
  const secs = document.getElementById('winner-timer-secs');
  const end = Date.now() + WIN_OVERLAY_MS;
  clearInterval(winTimer);
  const tick = () => {
    const remaining = Math.max(0, end - Date.now());
    if (fill) fill.style.width = `${(remaining / WIN_OVERLAY_MS) * 100}%`;
    if (secs) {
      const s = String(Math.ceil(remaining / 1000)).padStart(2, '0');
      secs.textContent = `Next round starts in: ${s}s`;
    }
    if (remaining <= 0) clearInterval(winTimer);
  };
  tick();
  winTimer = setInterval(tick, 50);
}

/**
 * Show the round result overlay. `name` is shown under the dice (the winner's
 * name to the winner; the viewer's own name to everyone else); `isLoser`
 * flips the banner suffix + logo.
 * @param {string} name
 * @param {number} target
 * @param {number} round
 * @param {boolean} [isLoser]
 */
export function showWinner(name, target, round, isLoser = false) {
  const pill = document.getElementById('winner-round');
  if (pill) pill.textContent = String(round);
  const suffix = document.getElementById('winner-banner-suffix');
  if (suffix) {
    suffix.textContent = isLoser
      ? quip('winner.banner_lose', 'Loser')
      : quip('winner.banner_win', 'Winner');
  }
  const logo = /** @type {HTMLImageElement | null} */ (document.querySelector('.winner-logo'));
  if (logo) logo.src = isLoser ? '/static/images/logo-loser.svg' : '/static/images/logo-winner.svg';
  const nameEl = document.getElementById('winner-name');
  if (nameEl) nameEl.textContent = name;
  // Attitude flavor line — empty (and display:none) when the level is off.
  // {name} in flavor lines is the round WINNER: my own name when I won, the
  // player who beat me otherwise (`name` here is the viewer's name, so the
  // loser path reads winner_name off the round_won frame instead).
  const flavorEl = document.getElementById('winner-flavor');
  if (flavorEl) {
    const key = isLoser
      ? (wasNearMiss() ? 'winner.near_miss' : 'winner.flavor_lose')
      : 'winner.flavor_win';
    const winnerName = (isLoser && state.currentState?.winner_name) || name;
    flavorEl.textContent = quip(key, '', { name: winnerName, target });
  }
  startWinTimer();
  if (winner && !winner.open) winner.showModal();
}

/** Close the winner overlay (and its countdown) if open. */
export function hideWinner() {
  clearInterval(winTimer);
  if (winner?.open) winner.close();
}
