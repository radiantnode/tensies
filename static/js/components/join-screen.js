// @ts-check

/**
 * <join-screen> — join-by-code form. Light DOM: the host element *is*
 * `#join.screen`. (Scaffold stub — markup arrives with the join view.)
 */
export class JoinScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'join';
    this.className = 'screen join-screen';
  }

  /**
   * Surface an error message on this screen.
   * @param {string} message
   */
  showError(message) {
    void message;
  }
}

customElements.define('join-screen', JoinScreen);
