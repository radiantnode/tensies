// @ts-check

/**
 * <lobby-stamp> — the vintage postage-stamp invite that replaces the plain code
 * box. Static chrome (paper, frame, panels, seal, watermark, guilloche) is built
 * once; `update(code)` fills the dynamic bits: the serial (join code), the QR
 * (server-generated ink-on-paper), and the left panel's date (today).
 *
 * The host renders a #lobby-code button so the lobby's existing tap-to-copy
 * wiring keeps working unchanged. Styling lives in css/stamp.css.
 */
export class LobbyStamp extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = '1';
    this.innerHTML = `
      <button id="lobby-code" type="button" class="stamp-btn" aria-label="Copy invite link">
        <div class="stamp">
          <div class="frame">
            <div class="paper-tex"></div>
            <div class="panel panel-l"><span class="stamp-date">—</span></div>
            <div class="panel panel-r"><span>1 Game</span></div>
            <div class="corner corner-tl"></div><div class="corner corner-tr"></div>
            <div class="corner corner-bl"></div><div class="corner corner-br"></div>
            <div class="main">
              <div class="guilloche"></div>
              <div class="watermark">Tensies</div>
              <div class="banner">✦&nbsp;&nbsp;Official Game Stamp · McKinney, Texas&nbsp;&nbsp;✦</div>
              <div class="seal">
                <svg class="dice" viewBox="0 0 100 100" aria-hidden="true">
                  <g transform="rotate(-14 40 42)">
                    <rect x="18" y="20" width="44" height="44" rx="9" fill="var(--ink)"></rect>
                    <circle cx="29" cy="30" r="3.2" fill="var(--paper)"></circle>
                    <circle cx="29" cy="42" r="3.2" fill="var(--paper)"></circle>
                    <circle cx="29" cy="54" r="3.2" fill="var(--paper)"></circle>
                    <circle cx="51" cy="30" r="3.2" fill="var(--paper)"></circle>
                    <circle cx="51" cy="42" r="3.2" fill="var(--paper)"></circle>
                    <circle cx="51" cy="54" r="3.2" fill="var(--paper)"></circle>
                  </g>
                  <g transform="rotate(10 62 60)">
                    <rect x="41" y="39" width="42" height="42" rx="8" fill="var(--paper)" stroke="var(--ink)" stroke-width="2.2"></rect>
                    <circle cx="52" cy="50" r="3" fill="var(--ink)"></circle>
                    <circle cx="72" cy="50" r="3" fill="var(--ink)"></circle>
                    <circle cx="52" cy="70" r="3" fill="var(--ink)"></circle>
                    <circle cx="72" cy="70" r="3" fill="var(--ink)"></circle>
                  </g>
                </svg>
              </div>
              <div class="row1">
                <div class="idblock"><div class="serial">—————</div></div>
                <div class="qr-box"><img class="qr" alt="Scan to join"></div>
              </div>
            </div>
          </div>
        </div>
      </button>`;
  }

  /**
   * Fill the dynamic fields for a game code.
   * @param {string} code the join code (serial + QR payload)
   */
  update(code) {
    const serial = this.querySelector('.serial');
    if (serial) serial.textContent = code;
    const date = this.querySelector('.stamp-date');
    if (date) date.textContent = stampDate();
    const qr = /** @type {HTMLImageElement | null} */ (this.querySelector('.qr'));
    if (qr) {
      const src = `/api/qr/${code}.svg`;
      if (!qr.src.endsWith(src)) qr.src = src; // only on code change — no refetch
    }
  }
}

/** Today as `MM · DD · YY`, matching the stamp's postmark style. */
function stampDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)} · ${p(d.getDate())} · ${p(d.getFullYear() % 100)}`;
}

customElements.define('lobby-stamp', LobbyStamp);
