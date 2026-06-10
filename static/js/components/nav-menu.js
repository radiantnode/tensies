// @ts-check

/**
 * <nav-menu> — the slide-in about/changelog panel reached from the top-bar
 * hamburger on pre-game screens. Body-level, not a `.screen`.
 * (Scaffold stub — markup arrives with the nav-menu view.)
 */
export class NavMenu extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'nav-menu';
  }
}

customElements.define('nav-menu', NavMenu);
