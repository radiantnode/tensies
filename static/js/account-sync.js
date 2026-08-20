// @ts-check
import { accountCoin, accountMark, usernamePill } from './account-coin.js';

/**
 * Signed-in header state, shared by every screen that renders a header:
 * the username pill (landing/lobby/pre-game) and the bare account mark
 * (the board). Also caches the account's public profile so the coin can
 * carry the photo and the nav menu can show real stats.
 */

/** @type {{ username: string, photo_url: string | null, total_games: number, total_rounds: number } | null} */
let profileCache = null;
/** @type {string | null} which username the cache belongs to */
let profileFor = null;
/** @type {Promise<void> | null} */
let profileFetch = null;

/**
 * The cached profile for the signed-in account (photo + stats), if loaded.
 * @param {string} username
 */
export function cachedProfile(username) {
  return profileFor === username ? profileCache : null;
}

/**
 * Fetch (once) the signed-in account's public profile; resolves when the
 * cache is filled. Degrades silently when profiles are unavailable
 * (TELEMETRY_ENABLED=0 deployments return 503).
 * @param {string} username
 */
export function loadProfile(username) {
  if (profileFor === username && (profileCache || profileFetch)) {
    return profileFetch ?? Promise.resolve();
  }
  profileFor = username;
  profileCache = null;
  profileFetch = fetch(`/api/profile/${encodeURIComponent(username)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || profileFor !== username) return;
      profileCache = {
        username,
        photo_url: data.profile_photo_url ?? null,
        total_games: data.stats?.total_games ?? 0,
        total_rounds: data.stats?.total_rounds ?? 0,
      };
      // Upgrade every coin already in a header with the photo.
      if (profileCache.photo_url) {
        document.querySelectorAll('.header-username, .header-account-mark').forEach((el) => {
          const coin = el.querySelector('.account-coin');
          coin?.replaceWith(accountCoin(profileCache?.photo_url));
        });
      }
    })
    .catch(() => {})
    .finally(() => { profileFetch = null; });
  return profileFetch;
}

/**
 * Keep a header's username pill in sync with auth state (pre-game screens).
 * @param {Element} header the .app-header (or title-row container)
 * @param {{ username: string } | null | undefined} user
 */
export function syncUsernamePill(header, user) {
  const existing = header.querySelector('.header-username');
  if (user && !existing) {
    const cached = cachedProfile(user.username);
    const pill = usernamePill({ username: user.username, photo_url: cached?.photo_url ?? null });
    const btn = header.querySelector('.game-menu-btn');
    btn?.parentElement?.insertBefore(pill, btn);
    if (!cached) loadProfile(user.username);
  } else if (!user && existing) {
    existing.remove();
  }
}

/**
 * Keep the board header's bare account mark in sync (the board never shows
 * the handle — the players bar already names you).
 * @param {Element} header
 * @param {{ username: string } | null | undefined} user
 */
export function syncAccountMark(header, user) {
  const existing = header.querySelector('.header-account-mark');
  if (user && !existing) {
    const cached = cachedProfile(user.username);
    const mark = accountMark({ username: user.username, photo_url: cached?.photo_url ?? null });
    const btn = header.querySelector('.game-menu-btn');
    btn?.parentElement?.insertBefore(mark, btn);
    if (!cached) loadProfile(user.username);
  } else if (!user && existing) {
    existing.remove();
  }
}
