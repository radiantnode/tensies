// <loading-screen> — first paint and the view for bootstrap, WS handshake,
// reconnect, and watching a disconnected peer. Light DOM so the shared
// loading.css (and the cross-screen logo morph) applies directly.
class LoadingScreen extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.id = 'loading';
    this.className = 'screen active';        // first painted screen
    this.setAttribute('aria-labelledby', 'loading-msg');
    this.innerHTML = `
      <img src="/static/logo.svg" class="logo-mark" alt="">
      <h1 class="logo">TENSIES</h1>
      <div class="loading-bar" aria-hidden="true"><div class="loading-bar-fill"></div></div>
      <p id="loading-msg">Loading…</p>`;
  }
}
customElements.define('loading-screen', LoadingScreen);
