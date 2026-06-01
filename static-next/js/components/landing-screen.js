// <landing-screen> — create-or-join entry. Light DOM; the host element *is*
// #landing.screen so the existing #landing CSS applies unchanged.
import './app-header.js';
import { navigate } from '../router.js';

class LandingScreen extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.id = 'landing';
    this.className = 'screen';
    this.setAttribute('aria-labelledby', 'landing-title');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body">
        <img src="/static/logo.svg" class="logo-mark" alt="">
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
    this.querySelector('#show-join-btn').addEventListener('click', () => navigate('/join'));
    // Create flow (WebSocket) is wired when the lobby view is built.
    this.querySelector('#landing-form').addEventListener('submit', (e) => e.preventDefault());
  }
}
customElements.define('landing-screen', LandingScreen);
