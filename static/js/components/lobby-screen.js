// @ts-check
import './app-header.js';
import { byId } from '../dom.js';
import { startGame } from '../net.js';
import { updateScrollFades } from '../scroll-fades.js';
import { state } from '../state.js';

/** @typedef {import('../types.js').GameSnapshot} GameSnapshot */

const COPY_HINT = 'Click to copy or show your friends or don’t.';

const joinLink = () => `${location.origin}/${state.gameCode}`;

/**
 * <lobby-screen> — the waiting room. Light DOM: the host element *is*
 * `#lobby.screen`. State-driven: `render(snap)` is called by router.showFor
 * on each pre-start `state` frame. Player rows are keyed by pid so
 * joins/leaves patch in place without resetting scroll position.
 */
export class LobbyScreen extends HTMLElement {
  /** @type {Map<string, HTMLLIElement>} pid → row */
  #rows = new Map();

  /** @type {HTMLElement | null} */
  #list = null;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #copyResetTimer;

  #onResize = () => this.#updateFades();

  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'lobby';
    this.className = 'screen lobby-screen';
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
        <p id="waiting-msg" class="waiting-msg"></p>
      </div>`;

    this.#list = byId('lobby-players');
    this.#list.addEventListener('scroll', () => this.#updateFades(), { passive: true });
    window.addEventListener('resize', this.#onResize);

    byId('lobby-code').addEventListener('click', () => this.#copyJoinLink());
    byId('sms-btn').addEventListener('click', () => this.#composeSms());
    byId('start-btn').addEventListener('click', () => startGame());
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.#onResize);
  }

  /**
   * Render the roster + host controls from a pre-start snapshot.
   * @param {GameSnapshot} snap
   */
  render(snap) {
    state.gameCode = snap.code;
    byId('lobby-code').textContent = snap.code;

    const list = this.#list;
    if (!list) return;
    for (const [pid, player] of Object.entries(snap.players)) {
      let row = this.#rows.get(pid);
      if (!row) {
        row = document.createElement('li');
        row.className = 'player-list-item';
        this.#rows.set(pid, row);
        list.appendChild(row);
      }
      row.textContent = player.name;
      if (pid === snap.host) {
        row.appendChild(this.#badge('host-badge', 'HOST'));
      } else if (pid === state.myId) {
        row.appendChild(this.#badge('you-badge', 'you'));
      }
    }
    for (const [pid, row] of this.#rows) {
      if (!snap.players[pid]) {
        row.remove();
        this.#rows.delete(pid);
      }
    }

    const startBtn = byId('start-btn');
    const waitingMsg = byId('waiting-msg');
    if (snap.host === state.myId) {
      startBtn.hidden = false;
      waitingMsg.textContent =
        Object.keys(snap.players).length < 2 ? 'Invite friends — or start solo!' : '';
    } else {
      startBtn.hidden = true;
      waitingMsg.textContent = 'Waiting for the host to start…';
    }
    requestAnimationFrame(() => this.#updateFades());
  }

  /**
   * @param {string} className
   * @param {string} label
   */
  #badge(className, label) {
    const badge = document.createElement('span');
    badge.className = className;
    badge.textContent = label;
    return badge;
  }

  #updateFades() {
    if (this.#list) updateScrollFades(this.#list);
  }

  #copyJoinLink() {
    if (!state.gameCode) return;
    navigator.clipboard.writeText(joinLink()).then(() => {
      const hint = byId('copy-hint');
      hint.textContent = 'link copied!';
      hint.classList.add('copied');
      clearTimeout(this.#copyResetTimer);
      this.#copyResetTimer = setTimeout(() => {
        hint.textContent = COPY_HINT;
        hint.classList.remove('copied');
      }, 2000);
    });
  }

  #composeSms() {
    if (!state.gameCode) return;
    const body = encodeURIComponent(`🎲 Come play Tensies! ${joinLink()}`);
    location.href = `sms:?&body=${body}`;
  }
}

customElements.define('lobby-screen', LobbyScreen);
