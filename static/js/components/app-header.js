// <app-header> — the global branded top bar shared by all screens. Renders into
// light DOM and emits a bubbling `menu-toggle` when the hamburger is tapped.
// Callers (nav-menu, game-screen) handle the event and call setOpen() to sync
// the button's visual state.
import { titleRowHTML } from '../title-row.js';

class AppHeader extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.className = 'game-topbar app-header';
    this.innerHTML = titleRowHTML;
    const btn = this.querySelector('.game-menu-btn');
    btn.id = 'app-header-menu-btn';
    btn.setAttribute('aria-controls', 'nav-menu');
    btn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('menu-toggle', { bubbles: true }));
    });
  }

  setOpen(open) {
    const btn = this.querySelector('.game-menu-btn');
    if (!btn) return;
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
}
customElements.define('app-header', AppHeader);
