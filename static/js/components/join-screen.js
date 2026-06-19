// @ts-check
import './app-header.js';
import { AudioShareError, listenForCode } from '../audio-share.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { byId } from '../dom.js';
import { EQ_ICON_HTML } from '../eq-icon.js';
import { isSignedIn } from '../auth.js';
import { joinGame } from '../net.js';
import { showLanding } from '../router.js';
import { state } from '../state.js';

/**
 * <join-screen> — enter name + game code. Light DOM: the host element *is*
 * `#join.screen`.
 */
export class JoinScreen extends HTMLElement {
  /** @type {AbortController | null} non-null while listening for an audio code */
  #listenAbort = null;

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
          <button id="listen-btn" type="button" class="btn btn-secondary btn-listen btn-audio">
            ${EQ_ICON_HTML}
            <span>Listen</span>
          </button>
          <button type="submit" class="btn btn-primary">Join Game</button>
          <p class="error-msg" id="join-error" role="alert" aria-live="polite"></p>
        </form>
      </div>`;
    const codeInput = /** @type {HTMLInputElement} */ (byId('code-input'));
    const joinNameInput = /** @type {HTMLInputElement} */ (byId('join-name-input'));
    joinNameInput.placeholder = state.randomNamePlaceholder;
    if (isSignedIn()) {
      joinNameInput.hidden = true;
      /** @type {HTMLElement} */ (this.querySelector('.tagline')).textContent = 'Enter the game code';
    }
    byId('back-btn').addEventListener('click', () => showLanding());
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase();
    });
    byId('join-form').addEventListener('submit', (event) => {
      event.preventDefault();
      joinGame();
    });
    byId('listen-btn').addEventListener('click', () => this.#toggleListen());
  }

  disconnectedCallback() {
    this.#listenAbort?.abort();
  }

  /**
   * "Listen" — pick up a game code chirped by a host's "Play" button.
   * One tap starts listening (mic permission prompt on first use); tapping
   * again cancels. On success the code input is filled and focused — the
   * user still taps Join themselves.
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
    this.showError('');

    try {
      codeInput.value = await listenForCode({
        signal: this.#listenAbort.signal,
        onStatus: () => {
          label.textContent = 'Hearing it…';
        },
      });
      codeInput.focus();
    } catch (err) {
      const reason = err instanceof AudioShareError ? err.reason : 'unsupported';
      if (reason === 'permission') {
        this.showError('Microphone access needed — check your browser settings.');
      } else if (reason === 'timeout') {
        this.showError("Couldn't hear a code — move the phones closer and try again.");
      } else if (reason === 'unsupported') {
        this.showError("Audio codes aren't supported in this browser.");
      }
      // 'aborted' is a deliberate cancel — stay silent.
    } finally {
      this.#listenAbort = null;
      btn.classList.remove('listening');
      label.textContent = 'Listen';
    }
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
