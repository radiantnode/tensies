// <round-target value="6"> — the tilted target die in the round header.
// Light DOM, so the existing .round-target-die CSS keeps applying.
import { PIP_POSITIONS } from '../pips.js';

class RoundTarget extends HTMLElement {
  static observedAttributes = ['value'];

  connectedCallback() {
    this.className = 'round-target-die';
    this._render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }

  _render() {
    const value = +this.getAttribute('value') || 0;
    const active = new Set(PIP_POSITIONS[value] || []);
    this.replaceChildren(...Array.from({ length: 9 }, (_, i) => {
      const dot = document.createElement('span');
      dot.className = 'dot' + (active.has(i) ? ' active' : '');
      return dot;
    }));
  }
}

customElements.define('round-target', RoundTarget);
