// @ts-check
import './app-header.js';
import { byId } from '../dom.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import {
  signInOrUp, validateUsername, isWebAuthnAvailable,
} from '../auth.js';
import { showLanding, showOnboarding } from '../router.js';

/**
 * <signin-screen> — passkey sign-in / sign-up. Light DOM: the host element
 * *is* `#signin.screen`, so the global stylesheet applies directly.
 */
export class SigninScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'signin';
    this.className = 'screen signin-screen';
    this.setAttribute('aria-labelledby', 'signin-title');

    const available = isWebAuthnAvailable();

    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body">
        <button id="signin-back-btn" type="button" class="btn-back">${BACK_BUTTON_HTML}</button>
        <h1 id="signin-title" class="screen-title">Sign In</h1>
        <p class="tagline">Sign in or create an account</p>
        ${available ? `
        <form id="signin-form" class="form-stack" autocomplete="off" novalidate>
          <input id="username-input" name="username" type="text"
                 aria-label="Username" placeholder="Enter your username"
                 maxlength="30" autocapitalize="none" autocomplete="username webauthn"
                 spellcheck="false">
          <button id="auth-submit-btn" type="submit" class="btn btn-primary">Sign In / Sign Up</button>
          <p class="error-msg" id="signin-error" role="alert" aria-live="polite"></p>
        </form>
        ` : `
        <p class="signin-unavailable">Passkeys are not supported in this browser.</p>
        `}
      </div>`;

    byId('signin-back-btn').addEventListener('click', () => showLanding());

    if (!available) return;

    const form = byId('signin-form');
    const usernameInput = /** @type {HTMLInputElement} */ (byId('username-input'));
    const submitBtn = byId('auth-submit-btn');

    /** @param {boolean} disabled */
    const setLoading = (disabled) => {
      usernameInput.disabled = disabled;
      submitBtn.classList.toggle('btn-loading', disabled);
      /** @type {HTMLButtonElement} */ (submitBtn).disabled = disabled;
    };

    // One button, double duty: sign in if the account exists, else sign up.
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      const err = validateUsername(username);
      if (err) { this.showError(err); return; }
      this.showError('');
      setLoading(true);
      try {
        const outcome = await signInOrUp(username);
        if (outcome.mode === 'signup') {
          showOnboarding(outcome.username, outcome.stats);
        } else {
          showLanding();
        }
      } catch (/** @type {any} */ error) {
        this.showError(error.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    });
  }

  /**
   * Surface an error message on this screen.
   * @param {string} message
   */
  showError(message) {
    const el = document.getElementById('signin-error');
    if (el) el.textContent = message;
  }
}

customElements.define('signin-screen', SigninScreen);
