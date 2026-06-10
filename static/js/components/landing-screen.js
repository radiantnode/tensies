// @ts-check
import './app-header.js';
import { byId } from '../dom.js';
import { createGame } from '../net.js';
import { showJoin } from '../router.js';
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
        <form id="landing-form" class="form-stack" autocomplete="off" novalidate>
          <label class="field-hint" for="name-input">Enter a player name or go with it</label>
          <input id="name-input" name="name" type="text" aria-label="Your name" placeholder="Your name" maxlength="20">
          <button type="submit" class="btn btn-primary">Create Game</button>
          <div class="or-divider" aria-hidden="true"><span>or</span></div>
          <button id="show-join-btn" type="button" class="btn btn-secondary">Join Game with Code</button>
          <p class="error-msg" id="landing-error" role="alert" aria-live="polite"></p>
        </form>
      </div>`;
    /** @type {HTMLInputElement} */ (byId('name-input')).placeholder = state.randomNamePlaceholder;
    byId('show-join-btn').addEventListener('click', () => showJoin());
    byId('landing-form').addEventListener('submit', (event) => {
      event.preventDefault();
      createGame();
    });
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
