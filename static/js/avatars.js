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
