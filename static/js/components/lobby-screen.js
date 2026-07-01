// @ts-check
import './app-header.js';
import { getAuthUser } from '../auth.js';
import { playCode } from '../audio-share.js';
import { byId } from '../dom.js';
import { EQ_ICON_HTML } from '../eq-icon.js';
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
        <div class="invite-actions">
          <button id="share-btn" type="button" class="btn btn-share">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
            </svg>
            <span>Share</span>
          </button>
          <button id="play-code-btn" type="button" class="btn btn-share btn-play-code btn-audio">
            ${EQ_ICON_HTML}
            <span>Play</span>
          </button>
        </div>
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
    byId('share-btn').addEventListener('click', () => this.#share());
    byId('play-code-btn').addEventListener('click', () => this.#playCode());
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
    // Sync the username pill in the header.
    const header = this.querySelector('app-header');
    if (header) {
      const existing = header.querySelector('.header-username');
      const user = getAuthUser();
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

    state.gameCode = snap.code;
    byId('lobby-code').textContent = snap.code;

    const list = this.#list;
    if (!list) return;
    // Sort: current player first, then insertion order.
    const entries = Object.entries(snap.players);
    entries.sort(([a], [b]) =>
      a === state.myId ? -1 : b === state.myId ? 1 : 0
    );
    for (const [pid, player] of entries) {
      let row = this.#rows.get(pid);
      if (!row) {
        row = document.createElement('li');
        row.className = 'player-list-item';
        this.#rows.set(pid, row);
      }
      // Always prepend "you" row, append others.
      if (pid === state.myId) {
        list.prepend(row);
      } else {
        list.appendChild(row);
      }
      row.textContent = player.name;
      if (pid === state.myId) {
        row.appendChild(this.#badge('you-badge', 'YOU'));
      }
      if (pid === snap.host) {
        row.appendChild(this.#badge('host-badge', 'HOST'));
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

  /**
   * Open the OS share sheet (AirDrop, Messages, WhatsApp, Copy, …) via the
   * Web Share API. The sheet already contains Messages, so it supersedes the
   * old SMS button; `#composeSms` stays as the fallback for browsers without
   * `navigator.share` (mostly desktop). A user-dismissed sheet rejects with
   * `AbortError` — that's a normal cancel, so it's swallowed silently.
   *
   * Only `title` + `url` are shared, deliberately no `text`: on iOS, passing
   * `text` alongside `url` makes the share sheet show plain text and drop the
   * rich link card (with the Tensies icon from the page's og:image). The dice
   * emoji moves into the SMS fallback body instead.
   */
  async #share() {
    if (!state.gameCode) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tensies',
          url: joinLink(),
        });
      } catch {
        // Cancelled or share target failed — nothing to recover.
      }
      return;
    }
    this.#composeSms();
  }

  /**
   * Chirp the game code through the speaker so a nearby phone on the join
   * screen can pick it up with its mic ("Listen"). Experimental.
   */
  async #playCode() {
    if (!state.gameCode) return;
    const btn = /** @type {HTMLButtonElement} */ (byId('play-code-btn'));
    if (btn.classList.contains('playing')) return; // already chirping
    const label = /** @type {HTMLSpanElement} */ (btn.querySelector('span:not(.eq)'));
    btn.classList.add('playing');
    label.textContent = 'Playing…';
    try {
      await playCode(state.gameCode);
    } catch {
      // Unsupported or interrupted — nothing to recover, just restore the button.
    } finally {
      btn.classList.remove('playing');
      label.textContent = 'Play';
    }
  }

  #composeSms() {
    if (!state.gameCode) return;
    const body = encodeURIComponent(`🎲 Come play Tensies! ${joinLink()}`);
    location.href = `sms:?&body=${body}`;
  }
}

customElements.define('lobby-screen', LobbyScreen);
