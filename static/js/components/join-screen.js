// <join-screen> — enter name + game code. Light DOM; host is #join.screen.
import { showLanding } from '../router.js';
import { joinGame } from '../net.js';
import { backButtonHTML } from '../title-row.js';

class JoinScreen extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.id = 'join';
    this.className = 'screen';
    this.setAttribute('aria-labelledby', 'join-title');
    this.innerHTML = `
      <div class="screen-body">
        <button id="back-btn" type="button" class="btn-back">${backButtonHTML}</button>
        <h1 id="join-title" class="screen-title">Join a Game</h1>
        <p class="tagline">Enter your name and game code</p>
        <form id="join-form" class="form-stack" autocomplete="off" novalidate>
          <input id="join-name-input" name="name" type="text" aria-label="Your name" placeholder="Your name" maxlength="20">
          <input id="code-input" name="code" class="code-input" type="text" aria-label="Game code" inputmode="latin" placeholder="ABCDE" maxlength="5" autocapitalize="characters">
          <button type="submit" class="btn btn-primary">Join Game</button>
          <p class="error-msg" id="join-error" role="alert" aria-live="polite"></p>
        </form>
      </div>`;
    this.querySelector('#back-btn').addEventListener('click', () => showLanding());
    // Uppercase the code as it's typed (matches the old behaviour).
    this.querySelector('#code-input').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
    this.querySelector('#join-form').addEventListener('submit', (e) => {
      e.preventDefault();
      joinGame();
    });
  }
}
customElements.define('join-screen', JoinScreen);
