// <game-screen> — the board + the in-game (pause) menu. Host is #game.screen
// (light DOM). State-driven: render(snap) is called by net.js showFor() on each
// started `state` frame and patches in place. Owns the game-menu open/close and
// the Pause/Resume toggle (server flips the flag; renderMenu reflects it).
import { state } from '../state.js';
import { titleRowHTML } from '../title-row.js';
import { renderGame } from '../game-render.js';
import { roll } from '../roll.js';
import { RESUME_CLOSE_DELAY_MS } from '../overlays.js';

class GameScreen extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.id = 'game';
    this.className = 'screen';
    this.setAttribute('aria-labelledby', 'game-title');
    this.innerHTML = `
      <header class="game-topbar">
        ${titleRowHTML}
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

    this._menuBtn = this.querySelector('.game-menu-btn');
    this._menu = this.querySelector('#game-menu');
    // The shared title-row gives the hamburger a class; the game's needs the id
    // the rest of the app (and tooling) references.
    this._menuBtn.id = 'game-menu-btn';
    this._menuBtn.setAttribute('aria-controls', 'game-menu');

    // Hamburger toggles the GAME menu (not the nav menu).
    this._menuBtn.addEventListener('click', () => (this.menuOpen() ? this.closeMenu() : this.openMenu()));

    // Pause/Resume — send intent; the broadcast flips the flag and renderMenu
    // reflects it. Resuming closes the menu after a beat (toggle slide-off).
    this.querySelector('#menu-pause-btn').addEventListener('click', () => {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
      const resuming = !!state.currentState?.paused;
      state.ws.send(JSON.stringify({ action: 'pause' }));
      if (resuming) setTimeout(() => this.closeMenu(), RESUME_CLOSE_DELAY_MS);
    });

    // Roll button is rebuilt each render — delegate.
    this.querySelector('#my-area').addEventListener('click', (e) => {
      if (e.target.id === 'roll-btn' && !e.target.disabled) roll();
    });

    this._onKeydown = (e) => {
      if (e.key === 'Escape' && this.menuOpen()) { this.closeMenu(); return; }
      if (e.code === 'Space' && state.currentState?.started && !state.rolling) {
        const btn = document.getElementById('roll-btn');
        if (btn && !btn.disabled) { e.preventDefault(); roll(); }
      }
    };
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
  }

  menuOpen() { return this._menu.classList.contains('open'); }
  openMenu() {
    this._menu.classList.add('open');
    this._menuBtn.classList.add('open');
    this._menuBtn.setAttribute('aria-expanded', 'true');
    this._menuBtn.setAttribute('aria-label', 'Close menu');
    this._menu.setAttribute('aria-hidden', 'false');
  }
  closeMenu() {
    this._menu.classList.remove('open');
    this._menuBtn.classList.remove('open');
    this._menuBtn.setAttribute('aria-expanded', 'false');
    this._menuBtn.setAttribute('aria-label', 'Open menu');
    this._menu.setAttribute('aria-hidden', 'true');
  }

  render(snap) {
    renderGame(snap);
  }
}
customElements.define('game-screen', GameScreen);
