// @ts-check
import { PIP_POSITIONS } from '../pips.js';

/**
 * <round-target value="6"> — the tilted target die in the round header.
 * Light DOM: the host *is* the `.round-target-die`.
 */
export class RoundTarget extends HTMLElement {
  static observedAttributes = ['value'];

  connectedCallback() {
    this.className = 'round-target-die';
    this.#render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  #render() {
    const value = Number(this.getAttribute('value')) || 0;
    const active = new Set(PIP_POSITIONS[value] ?? []);
    this.replaceChildren(...Array.from({ length: 9 }, (_, i) => {
      const dot = document.createElement('span');
      dot.className = active.has(i) ? 'dot active' : 'dot';
      return dot;
    }));
  }
}

customElements.define('round-target', RoundTarget);
