// @ts-check
import './app-header.js';
import { byId } from '../dom.js';
import { joinGame } from '../net.js';
import { showLanding } from '../router.js';
import { state } from '../state.js';

// Chevron + label for the back chip. Extracted to a shared module at second
// use (the changelog back chip renders the same chip).
const BACK_BUTTON_HTML = `<svg class="back-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg><span>Back</span>`;

/**
 * <join-screen> — enter name + game code. Light DOM: the host element *is*
 * `#join.screen`.
 */
export class JoinScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'join';
    this.className = 'screen join-screen';
    this.setAttribute('aria-labelledby', 'join-title');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body">
        <button id="back-btn" type="button" class="btn-back">${BACK_BUTTON_HTML}</button>
        <h1 id="join-title" class="screen-title">Join a Game</h1>
        <p class="tagline">Enter your name and game code</p>
        <form id="join-form" class="form-stack" autocomplete="off" novalidate>
          <input id="join-name-input" name="name" type="text" aria-label="Your name" placeholder="Your name" maxlength="20">
          <input id="code-input" name="code" class="code-input" type="text" aria-label="Game code" inputmode="latin" placeholder="ABCDE" maxlength="5" autocapitalize="characters">
          <button type="submit" class="btn btn-primary">Join Game</button>
          <p class="error-msg" id="join-error" role="alert" aria-live="polite"></p>
        </form>
      </div>`;
    const codeInput = /** @type {HTMLInputElement} */ (byId('code-input'));
    /** @type {HTMLInputElement} */ (byId('join-name-input')).placeholder = state.randomNamePlaceholder;
    byId('back-btn').addEventListener('click', () => showLanding());
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase();
    });
    byId('join-form').addEventListener('submit', (event) => {
      event.preventDefault();
      joinGame();
    });
  }

  /**
   * Surface an error message on this screen.
   * @param {string} message
   */
  showError(message) {
    byId('join-error').textContent = message;
  }
}

customElements.define('join-screen', JoinScreen);
