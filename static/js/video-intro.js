// @ts-check
import { randomFact } from './bar-facts.js';

/**
 * Game-start video intro: the intro video autoplays hidden+looping so iOS
 * grants playback permission. On game start we seek to 0, show it, and
 * let it play once — then fade in the game screen. While it plays, a bar fact
 * and a progress bar are overlaid (#intro-overlay) so there's something to read.
 */

const FADE_OUT_MS = 400;
const FADE_IN_MS = 1000;
const EARLY_FADE_IN_S = 1;
// The fact fades in this long after the video starts, and fades out this many
// seconds before the reveal — so it eases in a beat after the clip begins and
// out a beat before it ends, while the progress bar stays up the whole intro.
const FACT_IN_DELAY_MS = 600;
const FACT_OUT_LEAD_S = 0.5;
// Hard ceiling on the whole intro. Comfortably longer than the clip, but a
// backstop so a stalled/undecodable video (never plays, never fires `ended`,
// never rejects) still reveals the game instead of stranding a hidden screen.
const MAX_INTRO_MS = 8000;

/**
 * Play the intro sequence. Seeks the already-autoplaying intro video to
 * the start, shows it, and fades everything else out. Works from any
 * context (tap or WS callback) because the video is already playing.
 * @param {() => void} buildGame
 * @returns {Promise<void>}
 */
export function playIntro(buildGame) {
  return new Promise((resolve) => {
    const intro = /** @type {HTMLVideoElement} */ (document.getElementById('intro-video'));
    const bg = /** @type {HTMLVideoElement} */ (document.getElementById('bg-video'));
    const main = /** @type {HTMLElement} */ (document.querySelector('main'));
    const overlay = document.getElementById('intro-overlay');
    const factEl = document.getElementById('intro-fact');
    const bar = document.getElementById('intro-progress-bar');

    // 1. Seek to start, stop looping so it plays once, and show it.
    intro.loop = false;
    intro.currentTime = 0;
    intro.classList.add('playing');

    // 1b. Fresh fact text + reset progress, then show the overlay so the
    // progress bar is up for the whole intro. The fact itself stays hidden
    // (opacity 0) and fades in shortly after via .show-fact, below.
    if (factEl) factEl.textContent = randomFact();
    if (bar) bar.style.inlineSize = '0%';
    overlay?.classList.add('visible');

    // 2. Fade out UI simultaneously.
    main.classList.add('intro-fade-out');

    setTimeout(() => {
      main.classList.add('intro-hidden');
      bg.pause();
      buildGame();
    }, FADE_OUT_MS);

    // 3. Fade the game screen in 1s before the video ends.
    let fadeStarted = false;
    let failsafe = 0;
    // Fade the fact in a beat after the clip starts (guarded so a video that
    // fails fast — revealGame already fired — never flashes the fact in late).
    const factInTimer = setTimeout(() => {
      if (!fadeStarted) overlay?.classList.add('show-fact');
    }, FACT_IN_DELAY_MS);
    const revealGame = () => {
      if (fadeStarted) return;
      fadeStarted = true;
      clearTimeout(failsafe);
      clearTimeout(factInTimer);
      // Fact/bar fade out as the board fades in; snap the bar full first so it
      // reads as "ready" even if the video stalled before reaching the end.
      if (bar) bar.style.inlineSize = '100%';
      overlay?.classList.remove('show-fact');
      overlay?.classList.remove('visible');
      main.classList.remove('intro-hidden');
      void main.offsetHeight;
      main.classList.remove('intro-fade-out');
      main.classList.add('intro-fade-in');

      setTimeout(() => {
        main.classList.remove('intro-fade-in');
        intro.classList.remove('playing');
        resolve(undefined);
      }, FADE_IN_MS);
    };
    const startFadeIn = () => {
      if (fadeStarted) return;
      // Drive the bar off real playback, but scale it so 100% lands at the
      // reveal moment (EARLY_FADE_IN_S before the clip ends), not at the clip's
      // end — so it fills smoothly to full exactly as the board reveals instead
      // of snapping the last stretch to 100%.
      if (bar && intro.duration) {
        const fillDuration = Math.max(0.1, intro.duration - EARLY_FADE_IN_S);
        bar.style.inlineSize = `${Math.min(100, (intro.currentTime / fillDuration) * 100)}%`;
      }
      const remaining = intro.duration - intro.currentTime;
      // Fade the fact out a beat before the reveal, leaving the bar up until the
      // board takes over.
      if (remaining <= EARLY_FADE_IN_S + FACT_OUT_LEAD_S) overlay?.classList.remove('show-fact');
      if (remaining <= EARLY_FADE_IN_S) revealGame();
      else requestAnimationFrame(startFadeIn);
    };
    if (intro.duration) requestAnimationFrame(startFadeIn);
    else intro.addEventListener('loadedmetadata', () => requestAnimationFrame(startFadeIn), { once: true });

    // Explicitly (re)start playback. On the first game the page-load autoplay
    // is still running, so seeking is enough; but once it plays through with
    // looping off it's left in the `ended` state, and a second game start must
    // kick it off again or the intro never plays. If playback can't start (or
    // the video ends before the rAF loop catches it), reveal the game anyway so
    // a playback failure costs the animation, not a stranded hidden screen.
    intro.addEventListener('ended', revealGame, { once: true });
    failsafe = setTimeout(revealGame, MAX_INTRO_MS);
    const playPromise = intro.play();
    if (playPromise) playPromise.catch(revealGame);
  });
}
