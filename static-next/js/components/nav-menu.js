// <nav-menu> — the slide-down menu (about + changelog) reachable from the
// hamburger on landing/join/lobby. Owns its own open/close, toggled by the
// bubbling `menu-toggle` event from <app-header>. Panel content (about blurb,
// Beer link, "What's New" changelog) is built in the nav-menu view; for now it
// renders closed so landing/join capture with the menu shut.
class NavMenu extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.id = 'nav-menu';
    this.className = 'game-menu';
    this.setAttribute('aria-hidden', 'true');
    this.hidden = true;

    document.addEventListener('menu-toggle', () => this.toggle());
  }

  toggle() {
    const open = !this.classList.contains('open');
    this.classList.toggle('open', open);
    this.hidden = !open;
    this.setAttribute('aria-hidden', String(!open));
    document.querySelectorAll('.game-menu-btn').forEach((b) => {
      b.classList.toggle('open', open);
      b.setAttribute('aria-expanded', String(open));
    });
  }
}
customElements.define('nav-menu', NavMenu);
