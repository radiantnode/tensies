// @ts-check
import './app-header.js';
import { byId } from '../dom.js';
import { getAuthUser } from '../auth.js';
import { shouldOfferInstall, dismissBanner, requestInstall } from '../a2hs.js';
import { createGame } from '../net.js';
import { showJoin, showNearby, showSignin } from '../router.js';
import { state } from '../state.js';

// A mini rotating radar (rings + conic sweep) echoing the nearby screen's scope.
const RADAR_ICON = `<span class="landing-radar" aria-hidden="true"><span class="landing-radar-sweep"></span></span>`;

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
          <input id="name-input" name="name" type="text" aria-label="Your name" placeholder="Your name" maxlength="20">
          <button type="submit" class="btn btn-primary">Create Game</button>
          <div class="or-divider" aria-hidden="true"><span>or</span></div>
          <div class="lobby-actions landing-actions">
            <div class="lobby-action-item">
              <button id="show-join-btn" type="button" class="lobby-action" aria-label="Join a game with a code">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 7 20"/><path d="M17 4 15 20"/><path d="M4.5 9h15"/><path d="M3.5 15h15"/></svg>
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
      </div>`;

    const nameInput = /** @type {HTMLInputElement} */ (byId('name-input'));
    nameInput.placeholder = state.randomNamePlaceholder;

    this.refreshAuth();

    byId('show-join-btn').addEventListener('click', () => showJoin());
    byId('show-nearby-btn').addEventListener('click', () => showNearby());
    byId('signup-link').addEventListener('click', (event) => {
      event.preventDefault();
      showSignin();
    });
    byId('landing-form').addEventListener('submit', (event) => {
      event.preventDefault();
      createGame();
    });

    this.#mountInstallBanner();
    document.addEventListener('a2hs-installed', this.#onInstalled);
  }

  disconnectedCallback() {
    document.removeEventListener('a2hs-installed', this.#onInstalled);
  }

  #onInstalled = () => this.#removeBanner();

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
