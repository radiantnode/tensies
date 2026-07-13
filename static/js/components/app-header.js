// @ts-check
import { TITLE_ROW_HTML } from '../title-row.js';

/**
 * <app-header> — the branded top bar (logo mark + wordmark + hamburger) for
 * the pre-game screens. Light DOM; emits a bubbling `menu-toggle` when the
 * hamburger is tapped (the nav menu listens at body level). The game screen
 * has its own header (it adds the players bar and opens the game menu) but
 * shares the title-row markup.
 */
export class AppHeader extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.className = 'game-topbar app-header';
    this.innerHTML = TITLE_ROW_HTML;

    const btn = /** @type {HTMLButtonElement} */ (this.querySelector('.game-menu-btn'));
    // Per-screen id (landing-menu-btn / join-menu-btn / lobby-menu-btn): the
    // host screen sets its own id before this header connects.
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
