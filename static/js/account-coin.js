// @ts-check
import { attachAvatarFallback } from './avatars.js';

/**
 * The account coin — ONE mark for "your account", everywhere it appears:
 * 96px on the sign-in screen, 36px in the nav menu, 24px in the header.
 * A struck brass ring around dark enamel carrying the drawn person (the
 * stroke is 1.8 in a 24 viewBox so the weight scales with the object), or
 * the account's photo seated inside the same ring.
 */

/** The drawn person, #currentColor strokes — the coin centre sets the ink. */
export const PERSON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.4" r="3.9"/><path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0"/></svg>`;

/**
 * Build a coin element. Size/ring proportions come from the CSS class the
 * caller styles it with (`.account-coin` is the 24px header size; menus and
 * the sign-in screen carry their own classes on the same structure).
 * @param {string | null | undefined} photo account photo URL, if any
 * @param {string} [className]
 * @returns {HTMLSpanElement}
 */
export function accountCoin(photo, className = 'account-coin') {
  const coin = document.createElement('span');
  coin.className = className;
  const seat = document.createElement('span');
  if (photo) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = photo;
    attachAvatarFallback(img);
    seat.appendChild(img);
  } else {
    seat.innerHTML = PERSON_SVG;
  }
  coin.appendChild(seat);
  return coin;
}

/**
 * The header username pill — an <a> to /@handle in the secondary register;
 * the coin is the only gold on it. Truncates rather than disappearing.
 * @param {{ username: string, photo_url?: string | null }} user
 * @returns {HTMLAnchorElement}
 */
export function usernamePill(user) {
  const pill = document.createElement('a');
  pill.className = 'header-username';
  pill.href = `/@${user.username}`;
  pill.appendChild(accountCoin(user.photo_url ?? null));
  const handle = document.createElement('b');
  handle.textContent = `@${user.username}`;
  pill.appendChild(handle);
  return pill;
}

/**
 * The board's signed-in state: the account mark ALONE — 24px, no handle, not
 * pressable (the players bar already names you; this says which account the
 * wins are going to).
 * @param {{ username: string, photo_url?: string | null }} user
 * @returns {HTMLSpanElement}
 */
export function accountMark(user) {
  const wrap = document.createElement('span');
  wrap.className = 'header-account-mark';
  wrap.title = `@${user.username}`;
  wrap.appendChild(accountCoin(user.photo_url ?? null));
  return wrap;
}
