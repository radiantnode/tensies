// <player-card> — one mini card in the players bar.
//
// Light-DOM custom element so the existing players-bar.css selectors keep
// working (.player-mini, .player-mini-name, …). Renders once on connect,
// then attributeChangedCallback patches just the bits that change.
//
// Attributes:
//   name           player name (text)
//   wins           win count (number)
//   matched        dice matching current target (number 0–10)
//   total          total dice (number, defaults 10)
//   is-me          present → "you" badge + me-coloured fill
//   leading        present → highlighted wins chip
//   hot            present → red fill + count (only when !is-me and matched ≥ 7)
//   disconnected   present → dimmed card

class PlayerCard extends HTMLElement {
  static observedAttributes = ['name', 'wins', 'matched', 'total', 'is-me', 'leading', 'hot', 'disconnected'];

  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this.className = 'player-mini';

    const top = document.createElement('div');
    top.className = 'player-mini-top';
    this._nameEl = document.createElement('div');
    this._nameEl.className = 'player-mini-name';
    top.appendChild(this._nameEl);
    this._youEl = document.createElement('span');
    this._youEl.className = 'player-mini-you';
    this._youEl.textContent = 'you';
    this._youEl.hidden = true;
    top.appendChild(this._youEl);
    this._winsEl = document.createElement('div');
    top.appendChild(this._winsEl);
    this.appendChild(top);

    const prog = document.createElement('div');
    prog.className = 'player-mini-progress';
    this._fillEl = document.createElement('div');
    prog.appendChild(this._fillEl);
    this.appendChild(prog);

    this._countEl = document.createElement('div');
    this.appendChild(this._countEl);

    this._render();
  }

  attributeChangedCallback() {
    if (this._built) this._render();
  }

  _render() {
    const name = this.getAttribute('name') || '';
    const wins = +this.getAttribute('wins') || 0;
    const matched = +this.getAttribute('matched') || 0;
    const total = +this.getAttribute('total') || 10;
    const isMe = this.hasAttribute('is-me');
    const leading = this.hasAttribute('leading');
    const hot = this.hasAttribute('hot');
    const disconnected = this.hasAttribute('disconnected');

    this._nameEl.textContent = name;
    this._youEl.hidden = !isMe;
    this._winsEl.className = 'player-mini-wins' + (leading ? ' leading' : '');
    this._winsEl.textContent = `${wins}W`;
    this._fillEl.className = 'player-mini-fill' + (isMe ? ' me' : hot ? ' hot' : '');
    this._fillEl.style.width = `${(matched / total) * 100}%`;
    this._countEl.className = 'player-mini-count' + (hot ? ' hot' : '');
    this._countEl.textContent = `${matched}/${total}`;
    this.className = 'player-mini' + (disconnected ? ' disconnected' : '');
  }
}

customElements.define('player-card', PlayerCard);
