// <app-header> — the branded top bar shared by every screen (landing, join,
// lobby, game). Renders into light DOM so the global shell.css applies, and
// emits a bubbling `menu-toggle` event when the hamburger is tapped. One
// definition replaces the four hand-duplicated headers in the old markup.
class AppHeader extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.className = 'game-topbar app-header';
    this.innerHTML = `
      <div class="topbar-title-row">
        <div class="game-title">
          <img src="/static/logo.svg" class="game-title-mark" alt="">
          <span>Tensies</span>
        </div>
        <button class="game-menu-btn" type="button" aria-label="Open menu"
                aria-expanded="false" aria-controls="nav-menu">
          <span></span><span></span><span></span>
        </button>
      </div>`;
    this.querySelector('.game-menu-btn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('menu-toggle', { bubbles: true }));
    });
  }
}
customElements.define('app-header', AppHeader);
