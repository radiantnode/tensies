// @ts-check
/**
 * Avatar helpers — one source of truth for the fallback image and the
 * broken-photo error handling every screen needs.
 */

/** Fallback avatar: anonymous hosts, or a photo URL that fails to load. */
export const DEFAULT_AVATAR = '/static/images/avatar-default.svg';

/**
 * A host/player photo URL, or the default silhouette when there isn't one.
 * @param {string | null | undefined} photo
 * @returns {string}
 */
export function avatarSrc(photo) {
  return photo || DEFAULT_AVATAR;
}

/**
 * Swap a broken photo for the default on load failure. CSP blocks inline
 * `onerror`, so this is wired in JS. The guard stops an infinite loop if the
 * default itself 404s. Attach once per <img>.
 * @param {HTMLImageElement} img
 */
export function attachAvatarFallback(img) {
  img.addEventListener('error', () => {
    if (img.src !== location.origin + DEFAULT_AVATAR) img.src = DEFAULT_AVATAR;
  }, { once: true });
}

/**
 * Build an avatar <img> — the host's photo when present, else the default
 * silhouette — with the broken-photo fallback already wired.
 * @param {string | null | undefined} photo
 * @param {string} className
 * @returns {HTMLImageElement}
 */
export function avatarImg(photo, className) {
  const img = document.createElement('img');
  img.className = className;
  img.alt = '';
  img.src = avatarSrc(photo);
  attachAvatarFallback(img);
  return img;
}

/**
 * A player's seat on any roster, standing, blip or row: the photo when there
 * is one, otherwise a struck MONOGRAM — the player's initial on dark enamel.
 * Never a blank disc and never an enlarged silhouette: the seat stays about a
 * person, not about the absence of a photo (the round-result lock, propagated
 * app-wide in the 2026-08-19 final-pitch pass).
 * @param {string | null | undefined} photo
 * @param {string} name whose initial carries the no-photo seat
 * @param {string} className size/ring class (e.g. 'avatar-seat')
 * @returns {HTMLSpanElement}
 */
export function avatarSeat(photo, name, className) {
  const seat = document.createElement('span');
  seat.className = className;
  if (photo) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = photo;
    // A broken photo falls back to the monogram, not to a silhouette.
    img.addEventListener('error', () => {
      seat.replaceChildren(monogram(name));
    }, { once: true });
    seat.appendChild(img);
  } else {
    seat.appendChild(monogram(name));
  }
  return seat;
}

/**
 * The struck-monogram inner: the initial in Besley on the enamel ground
 * (styled by .avatar-mono).
 * @param {string} name
 */
function monogram(name) {
  const span = document.createElement('span');
  span.className = 'avatar-mono';
  span.textContent = (name.trim()[0] || '?').toUpperCase();
  return span;
}
