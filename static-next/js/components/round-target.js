// <round-target value="6"> — the tilted target die in the round header.
// Light DOM, so the existing .round-target-die CSS keeps applying.

const DOT_POSITIONS = {
  0: [], 1: [4], 2: [2, 6], 3: [2, 4, 6],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

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
    const active = new Set(DOT_POSITIONS[value] || []);
    this.replaceChildren(...Array.from({ length: 9 }, (_, i) => {
      const dot = document.createElement('span');
      dot.className = 'dot' + (active.has(i) ? ' active' : '');
      return dot;
    }));
  }
}

customElements.define('round-target', RoundTarget);
