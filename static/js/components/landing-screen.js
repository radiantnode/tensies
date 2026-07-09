// @ts-check
import './app-header.js';
import { AudioShareError, listenForCode } from '../audio-share.js';
import { byId } from '../dom.js';
import { EQ_ICON_HTML } from '../eq-icon.js';
import { getAuthUser, isSignedIn } from '../auth.js';
import { shouldOfferInstall, dismissBanner, requestInstall } from '../a2hs.js';
import { createGame, joinGame } from '../net.js';
import { showNearby, showSignin } from '../router.js';
import { SheetController } from '../sheet.js';
import { state } from '../state.js';

// A mini rotating radar (rings + conic sweep) echoing the nearby screen's scope.
const RADAR_ICON = `<span class="landing-radar" aria-hidden="true"><span class="landing-radar-sweep"></span></span>`;

// The Join button shows a live, scrambling 5-letter "game code" (monospace).
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const randCodeChar = () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
const randCode = () => Array.from({ length: 5 }, randCodeChar).join('');
const CODE_ICON = `<span class="join-code" aria-hidden="true">${randCode()}</span>`;

const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

/**
 * Southern, bar-friendly landing greetings, bucketed by time of day. The
 * ANYTIME regulars are always in the running alongside the current bucket.
 * @type {Record<'morning'|'afternoon'|'evening'|'night', string[]>}
 */
const GREETINGS = {
  morning: [
    "Mornin', sunshine.",
    "Well, look who's up.",
    "Rise and shine, y'all.",
    "Coffee first, dice second.",
    "You're up with the roosters.",
    "Early's a good look on you.",
    "Mornin', darlin'.",
  ],
  afternoon: [
    "Afternoon, partner.",
    "Good afternoon, y'all.",
    "Beatin' the happy hour rush?",
    "Little early to be rollin', ain't it?",
    "Sun's still up. Let's roll.",
    "Well howdy, afternoon regular.",
    "Perfect time for a round.",
  ],
  evening: [
    "Evenin', y'all.",
    "Come on in, night's young.",
    "Good evenin', darlin'.",
    "Pull up a stool.",
    "First round's on you.",
    "Well howdy, evening crowd.",
    "The night's young and so are the dice.",
  ],
  night: [
    "Y'all still up?",
    "Last call. Kidding.",
    "Night owl, huh?",
    "The bar never closes here.",
    "Burnin' the midnight oil, sugar?",
    "You don't have to go home.",
    "The good hour for bad decisions.",
  ],
};

/** Regulars that fit any hour. */
const ANYTIME = [
  "Howdy there.",
  "Welcome back, stranger.",
  "Look what the cat dragged in.",
  "Pull up a stool, partner.",
];

/**
 * Pick a random greeting for the given moment (defaults to now, local time).
 * Fresh on every call — nothing cached.
 * @param {Date} [now]
 * @returns {string}
 */
function pickGreeting(now = new Date()) {
  const h = now.getHours();
  const bucket =
    h >= 5 && h < 11 ? 'morning' :
    h >= 11 && h < 17 ? 'afternoon' :
    h >= 17 && h < 22 ? 'evening' : 'night';
  const pool = GREETINGS[bucket].concat(ANYTIME);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * <landing-screen> — create-or-join entry. Light DOM: the host element *is*
 * `#landing.screen`, so the global stylesheet applies directly.
 */
export class LandingScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'landing';
    this.className = 'screen landing-screen';
    this.setAttribute('aria-label', 'Tensies');
    const greeting = pickGreeting();
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body">
        <h1 class="screen-title landing-greeting">${greeting}</h1>
        <form id="landing-form" class="form-stack" autocomplete="off" novalidate>
          <p class="field-hint">Play with any name, or <a id="signup-link" class="field-hint-link" href="/signin">sign up</a> to keep your stats.</p>
          <input id="name-input" name="name" type="text" aria-label="Your name" placeholder="Your name" maxlength="20" autocomplete="off">
          <button type="submit" class="btn btn-primary">Create Game</button>
          <div class="or-divider" aria-hidden="true"><span>or</span></div>
          <div class="lobby-actions landing-actions">
            <div class="lobby-action-item">
              <button id="show-join-btn" type="button" class="lobby-action" aria-label="Join a game with a code">
                ${CODE_ICON}
              </button>
              <span class="lobby-action-label">Join with Code</span>
            </div>
            <div class="lobby-action-item">
              <button id="show-nearby-btn" type="button" class="lobby-action" aria-label="Find nearby games">
                ${RADAR_ICON}
              </button>
              <span class="lobby-action-label">Find Nearby Games</span>
            </div>
          </div>
          <p class="error-msg" id="landing-error" role="alert" aria-live="polite"></p>
        </form>
      </div>
      <dialog id="join-sheet" class="sheet join-sheet" aria-labelledby="join-sheet-title">
        <div class="sheet-head">
          <h2 id="join-sheet-title" class="sheet-title">Join a Game</h2>
          <button id="join-close" type="button" class="sheet-close" aria-label="Close" autofocus>${CLOSE_SVG}</button>
        </div>
        <form id="join-form" class="form-stack" autocomplete="off" novalidate>
          <input id="join-name-input" name="name" type="text" aria-label="Your name" placeholder="Your name" maxlength="20" autocomplete="off">
          <input id="code-input" name="code" class="code-input" type="text" aria-label="Game code" inputmode="latin" placeholder="ABCDE" maxlength="5" autocapitalize="characters" autocomplete="off">
          <button id="listen-btn" type="button" class="btn btn-secondary btn-listen btn-audio">${EQ_ICON_HTML}<span>Listen</span></button>
          <button type="submit" class="btn btn-primary">Join Game</button>
          <p class="error-msg" id="join-error" role="alert" aria-live="polite"></p>
        </form>
      </dialog>`;

    const nameInput = /** @type {HTMLInputElement} */ (byId('name-input'));
    nameInput.placeholder = state.randomNamePlaceholder;

    this.refreshAuth();

    byId('show-join-btn').addEventListener('click', () => this.openJoinSheet());
    byId('show-nearby-btn').addEventListener('click', () => showNearby());
    byId('signup-link').addEventListener('click', (event) => {
      event.preventDefault();
      showSignin();
    });
    byId('landing-form').addEventListener('submit', (event) => {
      event.preventDefault();
      createGame();
    });

    // Join sheet (modal <dialog>, reusing the shared .sheet chrome + controller).
    const joinNameInput = /** @type {HTMLInputElement} */ (byId('join-name-input'));
    joinNameInput.placeholder = state.randomNamePlaceholder;
    if (isSignedIn()) joinNameInput.hidden = true;
    const codeInput = /** @type {HTMLInputElement} */ (byId('code-input'));
    codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase(); });
    byId('join-form').addEventListener('submit', (event) => {
      event.preventDefault();
      joinGame();
    });
    byId('listen-btn').addEventListener('click', () => this.#toggleListen());
    byId('join-close').addEventListener('click', () => this.closeJoinSheet());
    // Shared bottom-sheet behaviour (open/close/Escape/backdrop + keyboard
    // docking). On any dismissal, stop listening and clear a deep-link URL.
    this.#joinSheet = new SheetController(/** @type {HTMLDialogElement} */ (byId('join-sheet')), {
      onClosed: () => {
        this.#listenAbort?.abort();
        if (location.pathname !== '/') history.replaceState({ id: 'landing' }, '', '/');
      },
    });

    this.#mountInstallBanner();
    this.#startCodeScramble();
    document.addEventListener('a2hs-installed', this.#onInstalled);
  }

  disconnectedCallback() {
    document.removeEventListener('a2hs-installed', this.#onInstalled);
    if (this.#codeTimer) clearInterval(this.#codeTimer);
    this.#listenAbort?.abort();
    this.#joinSheet?.destroy();
  }

  #onInstalled = () => this.#removeBanner();

  /** @type {AbortController | null} non-null while listening for an audio code */
  #listenAbort = null;

  /** @type {import('../sheet.js').SheetController | null} */
  #joinSheet = null;

  /**
   * Open the Join sheet (idempotent). Carries the landing name across, optionally
   * pre-fills a code and/or surfaces an error, then focuses the field still needed.
   * @param {{ code?: string, error?: string }} [opts]
   */
  openJoinSheet(opts = {}) {
    const nameInput = /** @type {HTMLInputElement} */ (byId('join-name-input'));
    const codeInput = /** @type {HTMLInputElement} */ (byId('code-input'));
    const landingName = /** @type {HTMLInputElement} */ (byId('name-input')).value.trim();
    if (landingName && !nameInput.value) nameInput.value = landingName;
    if (opts.code) codeInput.value = opts.code.toUpperCase();
    this.showJoinError(opts.error ?? '');
    this.#joinSheet?.open();
  }

  /** Slide the Join sheet down (mic-abort + URL reset run in its onClosed). */
  closeJoinSheet() {
    this.#joinSheet?.close();
  }

  /**
   * "Listen" — pick up a game code chirped by a host's "Play" button. One tap
   * starts listening (mic permission on first use); tapping again cancels. On
   * success the code input is filled and focused — the user still taps Join.
   */
  async #toggleListen() {
    if (this.#listenAbort) {
      this.#listenAbort.abort();
      return;
    }
    const btn = /** @type {HTMLButtonElement} */ (byId('listen-btn'));
    const label = /** @type {HTMLSpanElement} */ (btn.querySelector('span:not(.eq)'));
    const codeInput = /** @type {HTMLInputElement} */ (byId('code-input'));
    this.#listenAbort = new AbortController();
    btn.classList.add('listening');
    label.textContent = 'Listening…';
    this.showJoinError('');

    try {
      codeInput.value = await listenForCode({
        signal: this.#listenAbort.signal,
        onStatus: () => { label.textContent = 'Hearing it…'; },
      });
      codeInput.focus();
    } catch (err) {
      const reason = err instanceof AudioShareError ? err.reason : 'unsupported';
      if (reason === 'permission') {
        this.showJoinError('Microphone access needed — check your browser settings.');
      } else if (reason === 'timeout') {
        this.showJoinError("Couldn't hear a code — move the phones closer and try again.");
      } else if (reason === 'unsupported') {
        this.showJoinError("Audio codes aren't supported in this browser.");
      }
      // 'aborted' is a deliberate cancel — stay silent.
    } finally {
      this.#listenAbort = null;
      btn.classList.remove('listening');
      label.textContent = 'Listen';
    }
  }

  /**
   * Surface an error message inside the Join sheet.
   * @param {string} message
   */
  showJoinError(message) {
    byId('join-error').textContent = message;
  }

  /** @type {number} */
  #codeTimer = 0;

  /**
   * Keep the Join button's 5-letter code scrambling — a couple of positions
   * flip to a new random letter each tick. Skipped under reduced motion.
   */
  #startCodeScramble() {
    const el = this.querySelector('.join-code');
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.#codeTimer = window.setInterval(() => {
      el.textContent = (el.textContent || '')
        .split('')
        .map((c) => (Math.random() < 0.4 ? randCodeChar() : c))
        .join('');
    }, 140);
  }

  #removeBanner() {
    this.querySelector('.a2hs-banner')?.remove();
    this.classList.remove('a2hs-has-banner');
    this.style.removeProperty('--a2hs-banner-h');
  }

  /**
   * Offer the dismissible "Add to Home Screen" banner across the top of the
   * landing page. Gated on shouldOfferInstall() (mobile, not already installed,
   * not previously dismissed), so it never renders on the desktop pixel harness.
   * Tapping it runs requestInstall() — Android's native prompt when available,
   * otherwise the walkthrough. Nothing opens on its own.
   */
  #mountInstallBanner() {
    if (!shouldOfferInstall() || this.querySelector('.a2hs-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'a2hs-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Add Tensies to your Home Screen');
    banner.innerHTML = `
      <button type="button" class="a2hs-banner-main">
        <img class="a2hs-banner-icon" src="/static/images/icon-180.png" alt="">
        <span class="a2hs-banner-text">
          <span class="a2hs-banner-title">Add to Home Screen</span>
          <span class="a2hs-banner-sub">Faster launch, full screen &amp; more</span>
        </span>
        <span class="a2hs-banner-cta">Add</span>
      </button>
      <button type="button" class="a2hs-banner-close" aria-label="Dismiss">${CLOSE_SVG}</button>`;
    banner.querySelector('.a2hs-banner-main')?.addEventListener('click', () => requestInstall());
    banner.querySelector('.a2hs-banner-close')?.addEventListener('click', () => {
      dismissBanner();
      this.#removeBanner();
    });
    this.append(banner);
    this.classList.add('a2hs-has-banner');
    // Measure the banner so the header can sit just below it.
    requestAnimationFrame(() => {
      this.style.setProperty('--a2hs-banner-h', `${banner.offsetHeight}px`);
    });
  }

  /**
   * Refresh the auth state (called after sign-in/sign-out from other screens).
   */
  refreshAuth() {
    const user = getAuthUser();
    const nameInput = /** @type {HTMLInputElement | null} */ (document.getElementById('name-input'));
    const nameLabel = /** @type {HTMLElement | null} */ (this.querySelector('.field-hint'));
    if (nameInput) nameInput.hidden = !!user;
    if (nameLabel) nameLabel.hidden = !!user;

    const header = this.querySelector('app-header');
    if (!header) return;
    const existing = header.querySelector('.header-username');
    if (user && !existing) {
      const tag = document.createElement('a');
      tag.className = 'header-username';
      tag.textContent = `@${user.username}`;
      tag.href = `/@${user.username}`;
      const btn = header.querySelector('.game-menu-btn');
      btn?.parentElement?.insertBefore(tag, btn);
    } else if (!user && existing) {
      existing.remove();
    }
  }

  /**
   * Surface an error message on this screen.
   * @param {string} message
   */
  showError(message) {
    byId('landing-error').textContent = message;
  }
}

customElements.define('landing-screen', LandingScreen);
