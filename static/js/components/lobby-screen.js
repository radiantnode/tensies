// <lobby-screen> — waiting room. Host is #lobby.screen (light DOM). State-driven:
// render(snap) is called by net.js showFor() on each pre-start `state` frame.
// The player list is small and updates only on join/leave, so rebuilding it per
// render is fine (the per-frame in-place discipline is for the game board).
import './app-header.js';
import { state } from '../state.js';
import { startGame } from '../net.js';

const joinLink = () => `${location.origin}/?join=${state.gameCode}`;
const COPY_HINT = 'Click to copy or show your friends or don’t.';

class LobbyScreen extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.id = 'lobby';
    this.className = 'screen';
    this.setAttribute('aria-labelledby', 'lobby-title');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body lobby-body">
        <h1 id="lobby-title" class="lobby-title">Waiting for players…</h1>
        <p class="lobby-hint">Share this link to invite friends</p>
        <button id="lobby-code" type="button" class="code-display" aria-label="Copy invite link">——</button>
        <p class="copy-hint" id="copy-hint">${COPY_HINT}</p>
        <div class="or-divider" aria-hidden="true"><span>or</span></div>
        <button id="sms-btn" type="button" class="btn btn-sms">
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <span>Send Message</span>
        </button>
        <section class="lobby-players-section" aria-labelledby="players-label">
          <h2 id="players-label" class="section-label">Fellow Bar Rats</h2>
          <ul class="player-list" id="lobby-players" aria-label="Players"></ul>
        </section>
        <button id="start-btn" type="button" class="btn btn-primary btn-block" hidden>Start Game</button>
        <p id="waiting-msg"></p>
      </div>`;

    this.list = this.querySelector('#lobby-players');
    this.list.addEventListener('scroll', () => this.updateFades(), { passive: true });
    window.addEventListener('resize', () => this.updateFades());

    this.querySelector('#lobby-code').addEventListener('click', () => this.copyCode());
    this.querySelector('#sms-btn').addEventListener('click', () => this.smsTap());
    this.querySelector('#start-btn').addEventListener('click', () => startGame());
  }

  render(snap) {
    state.gameCode = snap.code;
    this.querySelector('#lobby-code').textContent = snap.code;

    this.list.innerHTML = '';
    for (const [pid, p] of Object.entries(snap.players)) {
      const li = document.createElement('li');
      li.className = 'player-list-item';
      li.textContent = p.name;
      if (pid === snap.host) {
        const b = document.createElement('span'); b.className = 'host-badge'; b.textContent = 'HOST';
        li.appendChild(b);
      } else if (pid === state.myId) {
        const b = document.createElement('span'); b.className = 'you-badge'; b.textContent = 'you';
        li.appendChild(b);
      }
      this.list.appendChild(li);
    }

    const startBtn = this.querySelector('#start-btn');
    const waitMsg = this.querySelector('#waiting-msg');
    if (snap.host === state.myId) {
      startBtn.hidden = false;
      waitMsg.textContent = Object.keys(snap.players).length < 2 ? 'Invite friends — or start solo!' : '';
    } else {
      startBtn.hidden = true;
      waitMsg.textContent = 'Waiting for the host to start…';
    }
    requestAnimationFrame(() => this.updateFades());
  }

  // Edge fades as a scroll affordance — shown only when there's overflow.
  updateFades() {
    const { scrollTop, scrollHeight, clientHeight } = this.list;
    this.list.classList.toggle('can-scroll-up', scrollTop > 1);
    this.list.classList.toggle('can-scroll-down', scrollTop + clientHeight < scrollHeight - 1);
  }

  copyCode() {
    if (!state.gameCode) return;
    navigator.clipboard.writeText(joinLink()).then(() => {
      const hint = this.querySelector('#copy-hint');
      hint.textContent = 'link copied!';
      hint.classList.add('copied');
      setTimeout(() => { hint.textContent = COPY_HINT; hint.classList.remove('copied'); }, 2000);
    });
  }

  smsTap() {
    if (!state.gameCode) return;
    const body = encodeURIComponent(`🎲 Come play Tensies! ${joinLink()}`);
    location.href = `sms:?&body=${body}`;
  }
}
customElements.define('lobby-screen', LobbyScreen);
