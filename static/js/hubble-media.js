// @ts-check
/**
 * Wall media — the 4K masters instead of the phone-sized clips, when Hubble is
 * holding the page.
 *
 * ## Why this is worth doing
 *
 * Hubble frames Tensies at a third of the panel's pixels and draws it three
 * times over (`zoom`, default 3). So a 720 CSS-pixel-wide frame lands on 2160
 * device pixels, and the shipped `landing-h264.mp4` is 640 wide — it arrives on
 * the wall at roughly a third of the resolution it is being displayed at, which
 * is exactly the case a phone-first asset is not built for. The 4K pair is 1918
 * wide, so it lands about 1:1.
 *
 * ## The costs, stated plainly
 *
 * These are big: 157 MB for the landing loop and 78 MB for the intro, against
 * 2.6 MB and 1.7 MB. That is fine for the wall — it is one LAN hop to nginx on
 * elite01 — and it is deliberately not fine anywhere else, which is why this is
 * behind the Hubble check rather than a viewport query. A phone on cellular
 * must never reach this path.
 *
 * There is also a small wasted fetch: `preload="auto"` in `index.html` means the
 * browser starts pulling the 640-wide clips while parsing, and this runs after
 * (module scripts are deferred). Those fetches are abandoned when `load()` is
 * called. Fixing it properly would need the swap to happen during parse, which
 * means an inline script, which the CSP forbids — `script-src 'self'` with no
 * `'unsafe-inline'`. A few aborted megabytes is the cheaper answer.
 *
 * ## Only h264, and only one source
 *
 * There is no HEVC variant of the 4K pair, so each element gets a single `src`
 * rather than the hevc/h264 `<source>` ladder. A `src` attribute wins over
 * `<source>` children in the resource selection algorithm, so the ladder in
 * `index.html` does not need removing — it stops being consulted.
 *
 * Every path below is written as a whole literal string on purpose:
 * `scripts/build_assets.mjs` rewrites `/static/...` references inside the JS
 * bundle to their fingerprinted URLs by plain string match, so a path built up
 * from pieces would ship pointing at a file that does not exist in `dist/`.
 */

/** @typedef {{id: string, src: string, poster: string | null}} WallClip */

/** @type {WallClip[]} */
const WALL_MEDIA = [
  {
    id: 'bg-video',
    src: '/static/video/landing-4k.mp4',
    poster: '/static/video/poster-landing-4k.webp',
  },
  {
    id: 'intro-video',
    src: '/static/video/game-start-4k.mp4',
    // The intro has no poster attribute — it is hidden until it plays. Its
    // still is `poster-game-4k.webp`, painted by `.game-bg` in critical.css
    // under the same `html[data-hubble]` switch this module is gated by.
    poster: null,
  },
];

/**
 * Point the two video elements at the 4K masters. Safe to call once, at boot,
 * before anything has started a game.
 *
 * Swallows its own failures: this is a quality upgrade, and a page that plays
 * the small clips is enormously better than one that throws on the way up. The
 * caller is `app.js`, ahead of the router.
 */
export function useWallMedia() {
  for (const clip of WALL_MEDIA) {
    try {
      const el = document.getElementById(clip.id);
      if (!(el instanceof HTMLVideoElement)) continue;
      el.src = clip.src;
      if (clip.poster) el.poster = clip.poster;
      // Required: changing src alone does not restart resource selection, so
      // without this the element keeps playing whatever it already picked.
      el.load();
      // `autoplay` re-fires by itself after load(), but both elements are muted
      // and expected to be running (the intro autoplays hidden to win iOS its
      // playback permission), so ask explicitly and ignore a refusal.
      const played = el.play();
      if (played) played.catch(() => {});
    } catch {
      /* One element failing must not stop the other. */
    }
  }
}
