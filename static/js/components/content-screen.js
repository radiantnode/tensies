// <content-screen> — host for permalinkable content pages (/hello, /about, etc.).
// Content is fetched from /static/content/{slug}.html on first visit and cached.
const _cache = new Map();

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

  async _render() {
    const slug = location.pathname.slice(1);
    const body = this.querySelector('.content-body');

    if (_cache.has(slug)) {
      body.innerHTML = _cache.get(slug);
      return;
    }

    body.innerHTML = `<p class="content-loading">Loading…</p>`;

    try {
      const res = await fetch(`/static/content/${slug}.html`);
      if (!res.ok) throw new Error(res.status);
      const html = await res.text();
      _cache.set(slug, html);
      if (location.pathname.slice(1) === slug) body.innerHTML = html;
    } catch {
      body.innerHTML = `<p>Page not found.</p>`;
    }
  }
}
customElements.define('content-screen', ContentScreen);
