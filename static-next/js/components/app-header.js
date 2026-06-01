// <app-header> — the branded top bar for landing/join/lobby. Renders into light
// DOM and emits a bubbling `menu-toggle` when the hamburger is tapped (the nav
// menu listens). The game has its own header (it adds the players bar and opens
// the game menu) but shares the title-row markup.
import { titleRowHTML } from '../title-row.js';

class AppHeader extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.className = 'game-topbar app-header';
    this.innerHTML = titleRowHTML;
    const btn = this.querySelector('.game-menu-btn');
    // Per-screen id (landing-menu-btn / join-menu-btn / lobby-menu-btn) — the
    // host screen sets its own id before rendering this header.
    const screenId = this.parentElement?.id;
    if (screenId) {
      btn.id = `${screenId}-menu-btn`;
      btn.setAttribute('aria-controls', 'nav-menu');
    }
    btn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('menu-toggle', { bubbles: true }));
    });
  }
}
customElements.define('app-header', AppHeader);
