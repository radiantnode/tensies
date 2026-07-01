// @ts-check
import './app-header.js';
import { byId } from '../dom.js';
import { getAuthUser } from '../auth.js';
import { shouldOfferInstall, dismissBanner, requestInstall } from '../a2hs.js';
import { createGame } from '../net.js';
import { showJoin } from '../router.js';
import { state } from '../state.js';

const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

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
    this.setAttribute('aria-labelledby', 'landing-title');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body">
        <img src="/static/images/logo.svg" class="logo-mark landing-hidden" alt="">
        <h1 id="landing-title" class="logo landing-hidden">TENSIES</h1>
        <p class="tagline landing-hidden">Roll all ten to win</p>
        <form id="landing-form" class="form-stack" autocomplete="off" novalidate>
          <label class="field-hint" for="name-input">Enter a player name or go with it</label>
          <input id="name-input" name="name" type="text" aria-label="Your name" placeholder="Your name" maxlength="20">
          <button type="submit" class="btn btn-primary">Create Game</button>
          <div class="or-divider" aria-hidden="true"><span>or</span></div>
          <button id="show-join-btn" type="button" class="btn btn-secondary">Join Game with Code</button>
          <p class="error-msg" id="landing-error" role="alert" aria-live="polite"></p>
        </form>
      </div>`;

    const nameInput = /** @type {HTMLInputElement} */ (byId('name-input'));
    nameInput.placeholder = state.randomNamePlaceholder;

    this.refreshAuth();

    byId('show-join-btn').addEventListener('click', () => showJoin());
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
    const nameLabel = /** @type {HTMLElement | null} */ (this.querySelector('.field-hint[for="name-input"]'));
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
