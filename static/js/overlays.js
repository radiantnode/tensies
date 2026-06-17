// @ts-check

/**
 * Dialog overlays — the winner/loser celebration and the non-host pause wait
 * screen. Both sit on top of the still-visible game board. (Loading is a
 * screen, not a dialog.) Module scripts run after parsing, so the dialogs in
 * index.html exist by the time these lookups run.
 */

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */
/** @typedef {import('./types.js').GameEndedMessage} GameEndedMessage */

const winner = /** @type {HTMLDialogElement | null} */ (document.getElementById('winner-overlay'));
const pauseOverlay = /** @type {HTMLDialogElement | null} */ (document.getElementById('pause-overlay'));
const gameEndedOverlay = /** @type {HTMLDialogElement | null} */ (document.getElementById('game-ended-overlay'));

// Neither dialog may be Escape-dismissed — only game state closes them.
winner?.addEventListener('cancel', (event) => event.preventDefault());
pauseOverlay?.addEventListener('cancel', (event) => event.preventDefault());
gameEndedOverlay?.addEventListener('cancel', (event) => event.preventDefault());

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
  return `Waiting for ${host} to resume the game`;
}

/**
 * "Waiting for A and B to reconnect…" from a list of dropped player names.
 * @param {string[]} names
 */
export function waitingText(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `Waiting for ${names[0]} to reconnect…`;
  return `Waiting for ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} to reconnect…`;
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
  void target; // part of the protocol payload; the next target shows in the round header
  const pill = document.getElementById('winner-round');
  if (pill) pill.textContent = String(round);
  const suffix = document.getElementById('winner-banner-suffix');
  if (suffix) suffix.textContent = isLoser ? 'Loser' : 'Winner';
  const logo = /** @type {HTMLImageElement | null} */ (document.querySelector('.winner-logo'));
  if (logo) logo.src = isLoser ? '/static/images/logo-loser.svg' : '/static/images/logo-winner.svg';
  const nameEl = document.getElementById('winner-name');
  if (nameEl) nameEl.textContent = name;
  startWinTimer();
  if (winner && !winner.open) winner.showModal();
}

/** Close the winner overlay (and its countdown) if open. */
export function hideWinner() {
  clearInterval(winTimer);
  if (winner?.open) winner.close();
}

// ── Game ended overlay ──

/**
 * Show the game-ended overlay with final player stats.
 * @param {GameEndedMessage} msg
 */
export function showGameEnded(msg) {
  const title = document.getElementById('game-ended-title');
  if (title) title.textContent = `Game ended by ${msg.ended_by}`;
  const list = document.getElementById('game-ended-stats');
  if (list) {
    const totalRounds = Math.max(0, msg.round_num - 1);
    const sorted = Object.values(msg.players).sort((a, b) => b.wins - a.wins);
    list.innerHTML = sorted.map((p) => {
      const losses = totalRounds - p.wins;
      const score = `${p.wins}/${totalRounds}`;
      const isWinner = p.wins > 0 && p.wins >= sorted[0].wins;
      return `<li class="game-ended-player">
        <span class="game-ended-score${isWinner ? '' : ' game-ended-score-loss'}">${score}</span>
        <span class="game-ended-player-body">
          <span class="game-ended-avatar-ring${isWinner ? ' game-ended-avatar-winner' : ''}"><img class="game-ended-avatar" src="/static/images/avatar-default.svg" alt="" aria-hidden="true"></span>
          <span class="game-ended-player-name">${p.name}</span>
        </span>
        <span class="game-ended-losses">${losses}L</span>
      </li>`;
    }).join('');
  }
  // Close any other overlays that might be open.
  hideWinner();
  hidePaused();
  if (gameEndedOverlay && !gameEndedOverlay.open) gameEndedOverlay.showModal();
}

/** Close the game-ended overlay. */
export function hideGameEnded() {
  if (gameEndedOverlay?.open) gameEndedOverlay.close();
}
