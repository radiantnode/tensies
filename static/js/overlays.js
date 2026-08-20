// @ts-check

/**
 * Dialog overlays — the winner/loser celebration and the non-host pause wait
 * screen. Both sit on top of the still-visible game board. (Loading is a
 * screen, not a dialog.) Module scripts run after parsing, so the dialogs in
 * index.html exist by the time these lookups run.
 */

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

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

// ── Round result (win / lose) ──
// Full takeover; ALWAYS shows the winner. Win and lose differ by one material
// fact — the medallion's ring is brass when you took it, a dark rim when
// somebody else did. Nothing is ever labelled "Loser". (result2.json)

// The server holds the overlay for ROUND_WIN_DELAY (server/config.py) before
// advancing the round — mirror it here to drive the countdown thread.
const WIN_OVERLAY_MS = 3000;

/** @type {ReturnType<typeof setInterval> | undefined} */
let winTimer;

function startWinTimer() {
  const fill = document.getElementById('winner-timer-fill');
  const end = Date.now() + WIN_OVERLAY_MS;
  clearInterval(winTimer);
  const tick = () => {
    const remaining = Math.max(0, end - Date.now());
    if (fill) fill.style.width = `${(remaining / WIN_OVERLAY_MS) * 100}%`;
    if (remaining <= 0) clearInterval(winTimer);
  };
  tick();
  winTimer = setInterval(tick, 50);
}

/**
 * Show the round result. `name` is the WINNER's name, whoever is looking;
 * `mine` sets the one material difference (brass vs dark ring).
 * @param {string} name
 * @param {string | null} photo the winner's profile photo URL, if any
 * @param {number} round
 * @param {boolean} mine did the viewer take the round
 */
export function showWinner(name, photo, round, mine) {
  const pill = document.getElementById('winner-round');
  if (pill) pill.textContent = String(round);
  const suffix = document.getElementById('winner-banner-suffix');
  if (suffix) suffix.textContent = mine ? 'you took it' : 'taken by';

  const medallion = document.getElementById('result-medallion');
  if (medallion) medallion.className = `result-medallion ${mine ? 'is-brass' : 'is-dark'}`;

  // The photo seats in a dark gap inside the ring. No photo is the COMMON
  // case: a struck monogram carrying the winner's initial — the disc stays
  // about a person, not about the absence of a photo.
  const seat = document.getElementById('result-seat');
  if (seat) {
    if (photo) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = photo;
      img.addEventListener('error', () => {
        seat.innerHTML = monogramHTML(name);
      }, { once: true });
      seat.replaceChildren(img);
    } else {
      seat.innerHTML = monogramHTML(name);
    }
  }

  const nameEl = document.getElementById('winner-name');
  if (nameEl) {
    nameEl.textContent = name;
    // Names cap at 20 chars server-side, which 2.5rem cannot hold at 390px:
    // step the size down by length band, and break a spaceless 20-char name.
    const band = name.length <= 10 ? '' : name.length <= 15 ? ' n-mid' : ' n-long';
    const brk = !name.includes(' ') && name.length > 12 ? ' n-break' : '';
    nameEl.className = `result-name${band}${brk}`;
  }
  startWinTimer();
  if (winner && !winner.open) winner.showModal();
}

/**
 * The struck-monogram seat markup for a winner with no photo.
 * @param {string} name
 */
function monogramHTML(name) {
  const initial = (name.trim()[0] || '?').toUpperCase();
  const span = document.createElement('span');
  span.className = 'result-mono';
  const inner = document.createElement('span');
  inner.textContent = initial;
  span.appendChild(inner);
  return span.outerHTML;
}

/** Close the winner overlay (and its countdown) if open. */
export function hideWinner() {
  clearInterval(winTimer);
  if (winner?.open) winner.close();
}

