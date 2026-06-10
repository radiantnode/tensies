// @ts-check

/**
 * <landing-screen> — create-or-join entry. Light DOM: the host element *is*
 * `#landing.screen`, so the global stylesheet applies directly.
 * (Scaffold stub — markup arrives with the landing view.)
 */
export class LandingScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'landing';
    this.className = 'screen landing-screen';
  }

  /**
   * Surface an error message on this screen.
   * @param {string} message
   */
  showError(message) {
    void message;
  }
}

customElements.define('landing-screen', LandingScreen);
