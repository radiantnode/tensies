// @ts-check
import './app-header.js';
import { byId } from '../dom.js';
import { isSignedIn, getAuthUser, isWebAuthnAvailable } from '../auth.js';
import { createGame } from '../net.js';
import { showJoin, showSignin } from '../router.js';
import { state } from '../state.js';

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
        <img src="/static/images/logo.svg" class="logo-mark" alt="">
        <h1 id="landing-title" class="logo">TENSIES</h1>
        <p class="tagline">Roll all ten to win</p>
        <p class="auth-status" id="auth-status" hidden></p>
        <form id="landing-form" class="form-stack" autocomplete="off" novalidate>
          <label class="field-hint" for="name-input">Enter a player name or go with it</label>
          <input id="name-input" name="name" type="text" aria-label="Your name" placeholder="Your name" maxlength="20">
          <button type="submit" class="btn btn-primary">Create Game</button>
          <div class="or-divider" aria-hidden="true"><span>or</span></div>
          <button id="show-join-btn" type="button" class="btn btn-secondary">Join Game with Code</button>
          <p class="error-msg" id="landing-error" role="alert" aria-live="polite"></p>
        </form>
        <p class="auth-link" id="auth-link" hidden></p>
      </div>`;

    /** @type {HTMLInputElement} */ (byId('name-input')).placeholder = state.randomNamePlaceholder;
    byId('show-join-btn').addEventListener('click', () => showJoin());
    byId('landing-form').addEventListener('submit', (event) => {
      event.preventDefault();
      createGame();
    });

    // Auth link: show "Sign in or Sign up" if WebAuthn is available
    if (isWebAuthnAvailable()) {
      const authLink = byId('auth-link');
      authLink.hidden = false;
      authLink.addEventListener('click', () => showSignin());
      this._updateAuthState();
    }
  }

  /** Update the landing screen to reflect sign-in state. */
  _updateAuthState() {
    const authLink = /** @type {HTMLElement} */ (document.getElementById('auth-link'));
    const authStatus = /** @type {HTMLElement} */ (document.getElementById('auth-status'));
    const nameInput = /** @type {HTMLInputElement | null} */ (document.getElementById('name-input'));
    const nameLabel = /** @type {HTMLElement | null} */ (document.querySelector('.field-hint[for="name-input"]'));
    if (!authLink) return;

    const user = getAuthUser();
    if (user) {
      authStatus.hidden = false;
      authStatus.innerHTML = `Signed in as <strong>@${user.username}</strong>`;
      authLink.textContent = 'Switch account';
      if (nameInput) {
        nameInput.value = user.username;
        nameInput.disabled = true;
      }
      if (nameLabel) nameLabel.textContent = 'Playing as';
    } else {
      authStatus.hidden = true;
      authLink.textContent = 'Sign in or Sign up';
      if (nameInput) nameInput.disabled = false;
      if (nameLabel) nameLabel.textContent = 'Enter a player name or go with it';
    }
  }

  /**
   * Refresh the auth state (called after sign-in/sign-out from other screens).
   */
  refreshAuth() {
    this._updateAuthState();
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
