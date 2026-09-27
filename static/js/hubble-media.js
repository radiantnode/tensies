// @ts-check
/**
 * Wall media — the 4K masters instead of the phone-sized clips, when Hubble is
 * holding the page.
 *
 * ## Why this is worth doing
 *
 * Hubble frames Tensies as a phone — an iPhone 17 Pro Max's proportions,
 * 942 panel pixels wide on its 4K wall — and the shipped `landing-h264.mp4`
 * is 640 wide, so it arrives at two thirds of the resolution it is displayed
 * at, which is exactly the case a phone-first asset is not built for. The
 * wall pair is 960 wide, so it lands about 1:1.
 *
 * ## 60p, interpolated — and sized to the frame, not the panel
 *
 * The wall clips are 60 frames a second. The phone clips are 24, and 24 on
 * a 60Hz panel means every frame is held for two refreshes, then three, then
 * two — a 3:2 cadence that reads as a stutter on anything that moves, and
 * was reported from the room as lag. These were made from the 24p masters
 * by motion-compensated interpolation (ffmpeg's `minterpolate`, mci with
 * bidirectional estimation and overlapped block compensation), which
 * synthesises the in-between frames rather than repeating them; the
 * in-betweens were inspected around the neon, where that kind of thing
 * tears, and are clean. They are also 960 x 1922 rather than 1918 x 3840:
 * the frame draws 942 pixels across, so a 4K clip decoded four times the
 * pixels the wall could show, at a bitrate written for a whole panel, and
 * that decode was most of what the wall's browser was doing with Tensies
 * up. Files are `static/video/{landing,game-start}-4k.mp4`, names kept
 * for the fingerprinting; the 24p 4K originals are outside the repository.
 *
 * ## The costs, stated plainly
 *
 * These are still big for a phone: 41 MB and 14 MB, against 2.6 MB and
 * 1.7 MB. That is fine for the wall — it is one LAN hop to nginx on
 * elite01 — and it is deliberately not fine anywhere else, which is why this
 * is behind the Hubble check rather than a viewport query. A phone on
 * cellular must never reach this path.
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
