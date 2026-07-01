// @ts-check

/**
 * Game-start video intro: the intro video autoplays hidden+looping so iOS
 * grants playback permission. On game start we seek to 0, show it, and
 * let it play once — then fade in the game screen.
 */

const FADE_OUT_MS = 400;
const FADE_IN_MS = 1000;
const EARLY_FADE_IN_S = 1;
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

    // 1. Seek to start, stop looping so it plays once, and show it.
    intro.loop = false;
    intro.currentTime = 0;
    intro.classList.add('playing');

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
    const revealGame = () => {
      if (fadeStarted) return;
      fadeStarted = true;
      clearTimeout(failsafe);
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
      const remaining = intro.duration - intro.currentTime;
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
