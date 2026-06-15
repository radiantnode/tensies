// @ts-check
import { getAuthUser } from '../auth.js';
import { byId } from '../dom.js';
import { renderGame } from '../game-render.js';
import { RESUME_CLOSE_DELAY_MS } from '../overlays.js';
import { roll } from '../roll.js';
import { state } from '../state.js';
import { TITLE_ROW_HTML } from '../title-row.js';

/** @typedef {import('../types.js').GameSnapshot} GameSnapshot */

/**
 * <game-screen> — the board + the in-game (pause) menu. Light DOM: the host
 * element *is* `#game.screen`. State-driven: `render(snap)` is called by
 * router.showFor on each started `state` frame and patches in place. Owns the
 * game-menu open/close and the Pause/Resume toggle (the server flips the
 * flag; renderMenu reflects it).
 */
export class GameScreen extends HTMLElement {
  /** @type {HTMLButtonElement | null} */
  #menuBtn = null;

  /** @type {HTMLElement | null} */
  #menu = null;

  /** @param {KeyboardEvent} event */
  #onKeydown = (event) => {
    if (event.key === 'Escape' && this.menuOpen()) {
      this.closeMenu();
      return;
    }
    if (event.code === 'Space' && state.currentState?.started && !state.rolling) {
      const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
      if (btn && !btn.disabled) {
        event.preventDefault();
        roll();
      }
    }
  };

  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'game';
    this.className = 'screen game-screen';
    this.setAttribute('aria-labelledby', 'game-title');
    this.innerHTML = `
      <header class="game-topbar">
        ${TITLE_ROW_HTML}
        <div class="players-bar" id="players-bar" role="list" aria-label="Players"></div>
      </header>
      <div id="game-menu" class="game-menu" aria-hidden="true">
        <nav class="menu-panel" aria-label="Game menu">
          <button id="menu-pause-btn" type="button" class="menu-item menu-toggle" aria-pressed="false" hidden>
            <span class="menu-item-label">Pause Game</span>
            <span class="menu-switch" aria-hidden="true"></span>
          </button>
          <div id="menu-pause-status" class="menu-status" aria-live="polite" hidden>
            <div class="menu-status-row">
              <span class="menu-status-label">Time remaining</span>
              <span class="menu-status-value" id="pause-remaining">—</span>
            </div>
            <p id="pause-players" class="menu-status-players"></p>
          </div>
        </nav>
      </div>
      <div class="my-area" id="my-area"></div>`;

    this.#menuBtn = /** @type {HTMLButtonElement} */ (this.querySelector('.game-menu-btn'));
    this.#menu = byId('game-menu');
    // The shared title row gives the hamburger a class; the game's needs the
    // id the rest of the app (and the test suites) reference.
    this.#menuBtn.id = 'game-menu-btn';
    this.#menuBtn.setAttribute('aria-controls', 'game-menu');

    // Hamburger toggles the GAME menu (not the nav menu).
    this.#menuBtn.addEventListener('click', () => {
      if (this.menuOpen()) this.closeMenu();
      else this.openMenu();
    });

    // Pause/Resume — send intent; the broadcast flips the flag and renderMenu
    // reflects it. Resuming closes the menu after a beat (toggle slide-off).
    byId('menu-pause-btn').addEventListener('click', () => {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
      const resuming = Boolean(state.currentState?.paused);
      state.ws.send(JSON.stringify({ action: 'pause' }));
      if (resuming) setTimeout(() => this.closeMenu(), RESUME_CLOSE_DELAY_MS);
    });

    // The roll button is rebuilt by every renderMyArea — delegate its clicks.
    byId('my-area').addEventListener('click', (event) => {
      const target = /** @type {HTMLButtonElement} */ (event.target);
      if (target.id === 'roll-btn' && !target.disabled) roll();
    });

    document.addEventListener('keydown', this.#onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.#onKeydown);
  }

  /** Whether the in-game menu is open. */
  menuOpen() {
    return Boolean(this.#menu?.classList.contains('open'));
  }

  /** Open the in-game menu (also auto-opened for a host returning to a pause). */
  openMenu() {
    this.#menu?.classList.add('open');
    this.#menu?.setAttribute('aria-hidden', 'false');
    this.#menuBtn?.classList.add('open');
    this.#menuBtn?.setAttribute('aria-expanded', 'true');
    this.#menuBtn?.setAttribute('aria-label', 'Close menu');
  }

  /** Close the in-game menu. */
  closeMenu() {
    this.#menu?.classList.remove('open');
    this.#menu?.setAttribute('aria-hidden', 'true');
    this.#menuBtn?.classList.remove('open');
    this.#menuBtn?.setAttribute('aria-expanded', 'false');
    this.#menuBtn?.setAttribute('aria-label', 'Open menu');
  }

  /**
   * Render the board from a server snapshot.
   * @param {GameSnapshot} snap
   */
  render(snap) {
    // Sync the username pill (auth may have changed since connectedCallback).
    const existing = this.querySelector('.header-username');
    const user = getAuthUser();
    if (user && !existing) {
      const tag = document.createElement('span');
      tag.className = 'header-username';
      tag.textContent = `@${user.username}`;
      this.#menuBtn.parentElement?.insertBefore(tag, this.#menuBtn);
    } else if (!user && existing) {
      existing.remove();
    }
    renderGame(snap);
  }
}

customElements.define('game-screen', GameScreen);
