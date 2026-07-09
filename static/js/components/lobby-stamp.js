// @ts-check
import { state } from '../state.js';

const EASE = 'transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * <lobby-stamp> — the vintage postage-stamp invite that replaces the plain code
 * box. Static chrome is built once; `update(code)` fills the serial, the QR
 * (server-generated), and the left panel's date.
 *
 * Tapping the stamp morphs it (FLIP-style) into a centred, rotated ~90°,
 * as-large-as-fits presentation over a dark scrim so the QR can be scanned across
 * a table; tapping again (or the scrim) morphs it back. Because the lobby clips
 * and container-contains the stamp, the enlarged view is a CLONE animated inside
 * a modal <dialog> — the top layer escapes the clip and stacking entirely, and
 * the real stamp never moves (no layout shift). Styling lives in css/stamp.css.
 */
export class LobbyStamp extends HTMLElement {
  /** @type {HTMLElement | null} */ #clone = null;
  /** @type {HTMLDialogElement | null} */ #dialog = null;
  /** @type {string} last QR source applied to the img (compared directly, not
   *  via img.src whose data-URL read-back can defeat a string guard). */
  #qrSrc = '';

  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = '1';
    this.innerHTML = `
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
      <p class="enlarge-hint">Have your friends join via the code or tap to show them the QR code.</p>
      <dialog class="stamp-zoom" aria-label="Enlarged invite stamp">
        <p class="close-hint">Tap anywhere to close</p>
      </dialog>`;

    this.#dialog = /** @type {HTMLDialogElement} */ (this.querySelector('.stamp-zoom'));
    this.querySelector('.stamp')?.addEventListener('click', () => this.#expand());
    // A tap anywhere in the dialog (backdrop, the enlarged stamp, or the hint)
    // collapses; so does Escape.
    this.#dialog.addEventListener('click', () => this.#collapse());
    this.#dialog.addEventListener('cancel', (e) => { e.preventDefault(); this.#collapse(); });
  }

  disconnectedCallback() {
    this.#clone?.remove();
    this.#clone = null;
    if (this.#dialog?.open) this.#dialog.close();
    const stamp = /** @type {HTMLElement | null} */ (this.querySelector('.stamp'));
    if (stamp) stamp.style.visibility = '';
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
      // Prefer the inline QR the server sent with the join (a data: URL — no
      // fetch, no flicker); fall back to the /api/qr endpoint if it's absent.
      const src = state.qr || `/api/qr/${code}.svg`;
      if (src !== this.#qrSrc) { qr.src = src; this.#qrSrc = src; }
    }
  }

  /** Morph a clone of the stamp up to the centred, rotated full-screen view. */
  #expand() {
    if (this.#clone || !this.#dialog) return;
    const stamp = /** @type {HTMLElement} */ (this.querySelector('.stamp'));
    // offsetWidth/Height are the UNtransformed border box; the tilted rect's
    // centre equals the border-box centre (rotation is about the centre). Sizing
    // + centring the clone from these makes its rest state pixel-match the
    // original, so removing it on collapse is seamless (no end pop).
    const ow = stamp.offsetWidth;
    const oh = stamp.offsetHeight;
    const r = stamp.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const clone = /** @type {HTMLElement} */ (stamp.cloneNode(true));
    // Pin the clone's size to the live stamp (its --u is container-relative, but
    // the clone lives in the top layer with no container).
    clone.style.setProperty('--u', `${ow / 346}px`);
    clone.style.position = 'fixed';
    clone.style.left = `${cx - ow / 2}px`;
    clone.style.top = `${cy - oh / 2}px`;
    clone.style.margin = '0';
    clone.style.transformOrigin = 'center center';
    clone.style.transform = 'rotate(-2.2deg)'; // FLIP first = resting tilt
    this.#clone = clone;

    this.#dialog.insertBefore(clone, this.#dialog.firstChild);
    this.#dialog.showModal();
    // Hide the real stamp while the clone is active so it doesn't show behind the
    // enlarged view (visibility keeps the slot's space). Restored on collapse.
    stamp.style.visibility = 'hidden';
    this.querySelector('.enlarge-hint')?.classList.add('hide');

    requestAnimationFrame(() => {
      clone.style.transition = EASE;
      clone.style.transform = this.#targetTransform(ow, oh, cx, cy);
      this.querySelector('.close-hint')?.classList.add('show');
    });
  }

  /**
   * Transform that morphs the stamp to centred + rotated 90° + fit-to-viewport.
   * The 90° turn maximises size on a portrait screen; 0.85 leaves room for the
   * drop-shadow and the seal that overhangs the frame. Rotated, the stamp's width
   * spans the screen height and vice versa, so fit against the swapped axes.
   * @param {number} ow border-box width  @param {number} oh border-box height
   * @param {number} cx viewport-x centre  @param {number} cy viewport-y centre
   */
  #targetTransform(ow, oh, cx, cy) {
    const pad = 26;
    const availW = window.innerWidth - pad * 2;
    const availH = window.innerHeight - pad * 2;
    const scale = Math.max(1, Math.min(availH / ow, availW / oh) * 0.85);
    const dx = window.innerWidth / 2 - cx;
    const dy = window.innerHeight / 2 - cy;
    return `translate(${dx}px, ${dy}px) rotate(87.8deg) scale(${scale})`;
  }

  /** Morph the clone back down over the real stamp, then tear it down. */
  #collapse() {
    const clone = this.#clone;
    if (!clone || !this.#dialog) return;
    this.#clone = null; // guard re-entry
    const stamp = /** @type {HTMLElement | null} */ (this.querySelector('.stamp'));
    this.querySelector('.close-hint')?.classList.remove('show'); // fade the hint out
    this.querySelector('.enlarge-hint')?.classList.remove('hide');
    // Fade the scrim + hint out (CSS .closing) as the clone morphs back, so the
    // lobby eases in rather than popping when the dialog finally closes.
    this.#dialog.classList.add('closing');
    clone.style.transition = EASE;
    clone.style.transform = 'rotate(-2.2deg)'; // back to FLIP first (left/top unchanged)

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clone.remove();
      if (stamp) stamp.style.visibility = ''; // reveal the real stamp as the clone goes
      this.#dialog?.close();
      this.#dialog?.classList.remove('closing');
    };
    clone.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 600); // fallback if transitionend never fires
  }
}

/** Today as `MM · DD · YY`, matching the stamp's postmark style. */
function stampDate() {
  const d = new Date();
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)} · ${p(d.getDate())} · ${p(d.getFullYear() % 100)}`;
}

customElements.define('lobby-stamp', LobbyStamp);
