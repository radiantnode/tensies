// <game-screen> — the board + the in-game (pause) menu. Host is #game.screen
// (light DOM). State-driven: render(snap) is called by net.js showFor() on each
// started `state` frame and patches in place. Owns the game-menu open/close and
// the Pause/Resume toggle (server flips the flag; renderMenu reflects it).
// The top bar is the global <app-header>; the players-bar sits as the first
// child of this screen, visually just below the header.
import { state } from '../state.js';
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
      <div class="players-bar" id="players-bar" role="list" aria-label="Players"></div>
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

    this._menu = this.querySelector('#game-menu');

    // Intercept the global hamburger's menu-toggle when this screen is active.
    this._onMenuToggle = () => {
      if (!this.classList.contains('active')) return;
      this.menuOpen() ? this.closeMenu() : this.openMenu();
    };
    document.addEventListener('menu-toggle', this._onMenuToggle);

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
    document.removeEventListener('menu-toggle', this._onMenuToggle);
    document.removeEventListener('keydown', this._onKeydown);
  }

  menuOpen() { return this._menu.classList.contains('open'); }

  openMenu() {
    this._menu.classList.add('open');
    this._menu.setAttribute('aria-hidden', 'false');
    document.querySelector('app-header')?.setOpen(true);
  }

  closeMenu() {
    this._menu.classList.remove('open');
    this._menu.setAttribute('aria-hidden', 'true');
    document.querySelector('app-header')?.setOpen(false);
  }

  render(snap) {
    renderGame(snap);
  }
}
customElements.define('game-screen', GameScreen);
