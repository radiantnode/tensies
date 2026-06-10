// <content-screen> — host for permalinkable content pages (/hello, /about, etc.).
// Reads location.pathname whenever it becomes active to pick the right page.
const PAGES = {
  '/hello': () => `
    <h1>Hello, world</h1>
    <p>This is the hello page.</p>
  `,
};

class ContentScreen extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.id = 'content';
    this.className = 'screen';
    this.innerHTML = `<div class="content-body"></div>`;

    new MutationObserver(() => {
      if (this.classList.contains('active')) this._render();
    }).observe(this, { attributeFilter: ['class'] });
  }

  _render() {
    const page = PAGES[location.pathname];
    this.querySelector('.content-body').innerHTML = page
      ? page()
      : '<p>Page not found.</p>';
  }
}
customElements.define('content-screen', ContentScreen);
