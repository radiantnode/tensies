// @ts-check
/** @typedef {import('../types.js').GameSnapshot} GameSnapshot */

/**
 * <game-screen> — the live board. Light DOM: the host element *is*
 * `#game.screen`. (Scaffold stub — markup arrives with the game view.)
 */
export class GameScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'game';
    this.className = 'screen game-screen';
  }

  /**
   * Render the board from a server snapshot.
   * @param {GameSnapshot} snap
   */
  render(snap) {
    void snap;
  }
}

customElements.define('game-screen', GameScreen);
