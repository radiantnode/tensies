// @ts-check
/** @typedef {import('../types.js').GameSnapshot} GameSnapshot */

/**
 * <lobby-screen> — pre-game roster. Light DOM: the host element *is*
 * `#lobby.screen`. (Scaffold stub — markup arrives with the lobby view.)
 */
export class LobbyScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'lobby';
    this.className = 'screen lobby-screen';
  }

  /**
   * Render the lobby from a server snapshot.
   * @param {GameSnapshot} snap
   */
  render(snap) {
    void snap;
  }
}

customElements.define('lobby-screen', LobbyScreen);
