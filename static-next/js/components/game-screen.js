// <game-screen> — the board. Host is #game.screen (light DOM). State-driven:
// render(snap) is called by net.js showFor() on each started `state` frame and
// patches in place (renderGame uses keyed cards + myDiceKey). The in-game menu
// (pause) markup and wiring land with the pause view; for now the header carries
// the hamburger and the players bar.
import { state } from '../state.js';
import { titleRowHTML } from '../title-row.js';
import { renderGame } from '../game-render.js';
import { roll } from '../roll.js';

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
      <div class="my-area" id="my-area"></div>`;

    // The roll button is rebuilt by renderMyArea on every render, so delegate.
    this.querySelector('#my-area').addEventListener('click', (e) => {
      if (e.target.id === 'roll-btn' && !e.target.disabled) roll();
    });
    // Spacebar rolls during play.
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && state.currentState?.started && !state.rolling) {
        const btn = document.getElementById('roll-btn');
        if (btn && !btn.disabled) { e.preventDefault(); roll(); }
      }
    });
  }

  render(snap) {
    renderGame(snap);
  }
}
customElements.define('game-screen', GameScreen);
