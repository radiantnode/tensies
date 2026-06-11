// @ts-check

/**
 * <player-card> — one mini card in the players bar. Light DOM so the
 * players-bar.css selectors apply (`.player-mini`, `.player-mini-name`, …).
 * Renders once on connect; attributeChangedCallback patches just the bits
 * that change.
 *
 * Attributes:
 *   name           player name (text)
 *   wins           win count (number)
 *   matched        dice matching current target (number 0–10)
 *   total          total dice (number, defaults 10)
 *   is-me          present → "you" badge + me-coloured fill
 *   leading        present → highlighted wins chip
 *   hot            present → red fill + count (only when !is-me and matched ≥ 7)
 *   disconnected   present → dimmed card
 */
export class PlayerCard extends HTMLElement {
  static observedAttributes = ['name', 'wins', 'matched', 'total', 'is-me', 'leading', 'hot', 'disconnected'];

  #built = false;

  /** @type {HTMLDivElement} */ #nameEl = document.createElement('div');
  /** @type {HTMLSpanElement} */ #youEl = document.createElement('span');
  /** @type {HTMLDivElement} */ #winsEl = document.createElement('div');
  /** @type {HTMLDivElement} */ #fillEl = document.createElement('div');
  /** @type {HTMLDivElement} */ #countEl = document.createElement('div');

  connectedCallback() {
    if (this.#built) return;
    this.#built = true;
    this.className = 'player-mini';

    const top = document.createElement('div');
    top.className = 'player-mini-top';
    this.#nameEl.className = 'player-mini-name';
    this.#youEl.className = 'player-mini-you';
    this.#youEl.textContent = 'you';
    this.#youEl.hidden = true;
    top.append(this.#nameEl, this.#youEl, this.#winsEl);
    this.appendChild(top);

    const progress = document.createElement('div');
    progress.className = 'player-mini-progress';
    progress.appendChild(this.#fillEl);
    this.appendChild(progress);

    this.appendChild(this.#countEl);
    this.#render();
  }

  attributeChangedCallback() {
    if (this.#built) this.#render();
  }

  #render() {
    const name = this.getAttribute('name') ?? '';
    const wins = Number(this.getAttribute('wins')) || 0;
    const matched = Number(this.getAttribute('matched')) || 0;
    const total = Number(this.getAttribute('total')) || 10;
    const isMe = this.hasAttribute('is-me');
    const leading = this.hasAttribute('leading');
    const hot = this.hasAttribute('hot');
    const disconnected = this.hasAttribute('disconnected');

    this.#nameEl.textContent = name;
    this.#youEl.hidden = !isMe;
    this.#winsEl.className = leading ? 'player-mini-wins leading' : 'player-mini-wins';
    this.#winsEl.textContent = `${wins}W`;
    let fillVariant = '';
    if (isMe) fillVariant = ' me';
    else if (hot) fillVariant = ' hot';
    this.#fillEl.className = `player-mini-fill${fillVariant}`;
    this.#fillEl.style.width = `${(matched / total) * 100}%`;
    this.#countEl.className = hot ? 'player-mini-count hot' : 'player-mini-count';
    this.#countEl.textContent = `${matched}/${total}`;
    this.className = disconnected ? 'player-mini disconnected' : 'player-mini';
  }
}

customElements.define('player-card', PlayerCard);
