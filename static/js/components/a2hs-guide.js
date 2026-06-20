// @ts-check
import { triggerNativeInstall, hasNativePrompt, dismissBanner } from '../a2hs.js';

/**
 * <a2hs-guide> — the "Add to Home Screen" walkthrough.
 *
 * A body-level <dialog> (like the winner/pause overlays) holding a CSS/SVG
 * phone mockup that cross-fades through three synced steps. The iOS scenes
 * reproduce the real Safari chrome (floating bar → Share sheet → Add-to-Home-
 * Screen confirmation); Android gets the ⋮-menu route plus a native Install CTA.
 * Opened via the document-level `a2hs-open` event (see a2hs.js::openGuide).
 *
 * Light DOM, host is laid out as `display: contents` so a closed guide adds no
 * box to any screen — it stays inert until opened.
 */

const APP_ICON = '/static/images/apple-touch-icon-180.png';

// Inline SVG glyphs (stroke/fill = currentColor; no inline styles, CSP-safe).
const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

// iOS Safari share glyph (tray open at top + up arrow).
const SHARE_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/></svg>`;
// Rounded square with a plus — "Add to Home Screen".
const ADD_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>`;
const MORE_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>`;
const INSTALL_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M5 20h14"/></svg>`;
const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

// ── iOS Safari chrome glyphs ──
const EXT_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 11c-.83 0-1.5-.67-1.5-1.5V7a1 1 0 0 0-1-1h-2.5C14.67 6 14 5.33 14 4.5a2 2 0 1 0-4 0c0 .83-.67 1.5-1.5 1.5H6a1 1 0 0 0-1 1v2.5C5 10.33 4.33 11 3.5 11a2 2 0 1 0 0 4c.83 0 1.5.67 1.5 1.5V19a1 1 0 0 0 1 1h2.5c.83 0 1.5-.67 1.5-1.5a2 2 0 1 1 4 0c0 .83.67 1.5 1.5 1.5H18a1 1 0 0 0 1-1v-2.5c0-.83.67-1.5 1.5-1.5a2 2 0 1 0 0-4z"/></svg>`;
const RELOAD_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M20 8a8 8 0 1 0 1.3 6"/><path d="M20 3v5h-5"/></svg>`;
const CHEV_L = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`;
const CHEV_R = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;
const BOOK_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M12 6.5C10.5 5.3 8.5 4.5 6 4.5c-1 0-1.8.1-2.5.3v13c.7-.2 1.5-.3 2.5-.3 2.5 0 4.5.8 6 2 1.5-1.2 3.5-2 6-2 1 0 1.8.1 2.5.3v-13c-.7-.2-1.5-.3-2.5-.3-2.5 0-4.5.8-6 2z"/><path d="M12 6.5v13"/></svg>`;
const TABS_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><rect x="4" y="4" width="12" height="12" rx="2.5"/></svg>`;
// Share-sheet action-circle glyphs.
const COPY_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><rect x="8" y="8" width="11" height="13" rx="2"/><path d="M5 16V5a2 2 0 0 1 2-2h9"/></svg>`;
const BMARK_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/></svg>`;
const GLASSES_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><circle cx="6.5" cy="14" r="3.3"/><circle cx="17.5" cy="14" r="3.3"/><path d="M9.8 14c0-1 .9-1.6 2.2-1.6s2.2.6 2.2 1.6M3.2 13l1.7-4M20.8 13l-1.7-4"/></svg>`;
const CHEV_D = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
const STAR_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" ${S} aria-hidden="true"><path d="M12 4l2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 15.8 7.3 18.2l.9-5.1L4.5 9.5l5.2-.8z"/></svg>`;

const STEP_COUNT = 3;
const STEP_MS = 1900;

/** Closing scene for Android: the app icon popping onto a home-screen grid. */
const HOME_SCENE = `
  <div class="a2hs-scene" data-scene="3">
    <div class="a2hs-home">
      <div class="a2hs-home-grid">${'<i></i>'.repeat(8)}</div>
      <div class="a2hs-home-app">
        <img class="a2hs-home-icon" src="${APP_ICON}" alt="" width="48" height="48">
        <span class="a2hs-home-label">Tensies</span>
      </div>
      <div class="a2hs-home-dots"><i></i><i></i></div>
    </div>
  </div>`;

// ── iOS scenes (reproduce the real Safari chrome) ──

const IOS_SCENE_1 = `
  <div class="a2hs-scene" data-scene="1">
    <div class="a2hs-ios-page">
      <img class="a2hs-canvas-logo" src="/static/images/logo.svg" alt="" width="38" height="38">
      <span class="a2hs-canvas-word">TENSIES</span>
    </div>
    <div class="a2hs-ios-bar">
      <div class="a2hs-ios-url">
        <span class="a2hs-ios-url-ext">${EXT_SVG}</span>
        <span class="a2hs-ios-url-text">tensies.app</span>
        <span class="a2hs-ios-url-reload">${RELOAD_SVG}</span>
      </div>
      <div class="a2hs-ios-tools">
        <span class="a2hs-ios-tool a2hs-ios-tool-dim">${CHEV_L}</span>
        <span class="a2hs-ios-tool a2hs-ios-tool-dim">${CHEV_R}</span>
        <span class="a2hs-ios-tool a2hs-ios-target">${SHARE_SVG}<span class="a2hs-tap"></span></span>
        <span class="a2hs-ios-tool">${BOOK_SVG}</span>
        <span class="a2hs-ios-tool">${TABS_SVG}</span>
      </div>
    </div>
  </div>`;

const IOS_SCENE_2 = `
  <div class="a2hs-scene" data-scene="2">
    <div class="a2hs-sheet-dim"></div>
    <div class="a2hs-ios-sheet">
      <span class="a2hs-sheet-grabber"></span>
      <div class="a2hs-ios-sheet-head">
        <img src="${APP_ICON}" alt="" width="30" height="30">
        <span class="a2hs-ios-sheet-name">Tensies<small>tensies.app</small></span>
      </div>
      <div class="a2hs-ios-circles">
        <span class="a2hs-ios-circle">${COPY_SVG}<i>Copy</i></span>
        <span class="a2hs-ios-circle">${BMARK_SVG}<i>Bookmarks</i></span>
        <span class="a2hs-ios-circle">${GLASSES_SVG}<i>Reading List</i></span>
        <span class="a2hs-ios-circle">${CHEV_D}<i>More</i></span>
      </div>
      <div class="a2hs-ios-list">
        <div class="a2hs-ios-row"><span class="a2hs-ios-row-ic">${STAR_SVG}</span>Add to Favorites</div>
        <div class="a2hs-ios-row a2hs-ios-target"><span class="a2hs-ios-row-ic">${ADD_SVG}</span>Add to Home Screen<span class="a2hs-tap"></span></div>
      </div>
    </div>
  </div>`;

const IOS_SCENE_3 = `
  <div class="a2hs-scene" data-scene="3">
    <div class="a2hs-sheet-dim"></div>
    <div class="a2hs-ios-confirm">
      <div class="a2hs-confirm-head">
        <span class="a2hs-confirm-x">${CLOSE_SVG}</span>
        <span class="a2hs-confirm-title">Add to Home Screen</span>
        <span class="a2hs-confirm-add a2hs-ios-target">Add<span class="a2hs-tap"></span></span>
      </div>
      <div class="a2hs-confirm-row">
        <img class="a2hs-confirm-icon" src="${APP_ICON}" alt="" width="44" height="44">
        <span class="a2hs-confirm-fields">
          <span class="a2hs-confirm-name">Tensies<span class="a2hs-confirm-caret"></span></span>
          <span class="a2hs-confirm-url">https://tensies.app/</span>
        </span>
      </div>
      <div class="a2hs-confirm-toggle">
        <span>Open as Web App</span>
        <span class="a2hs-ios-switch"></span>
      </div>
      <p class="a2hs-confirm-note">An icon will be added to your Home Screen so you can quickly access this website.</p>
    </div>
  </div>`;

/**
 * Build the phone-mockup + step-list markup for a platform.
 * @param {'ios'|'android'} platform
 */
function guideBody(platform) {
  const ios = platform === 'ios';

  const scenes = ios
    ? `${IOS_SCENE_1}${IOS_SCENE_2}${IOS_SCENE_3}`
    : `<div class="a2hs-scene" data-scene="1">
         <div class="a2hs-browser">
           <div class="a2hs-url-bar a2hs-url-bar-top">
             <span class="a2hs-url">tensies.app</span>
             <span class="a2hs-tool a2hs-tool-active a2hs-tool-more">${MORE_SVG}<span class="a2hs-tap"></span></span>
           </div>
           <div class="a2hs-app-canvas">
             <img class="a2hs-canvas-logo" src="/static/images/logo.svg" alt="" width="40" height="40">
             <span class="a2hs-canvas-word">TENSIES</span>
           </div>
         </div>
       </div>
       <div class="a2hs-scene" data-scene="2">
         <div class="a2hs-sheet-dim"></div>
         <div class="a2hs-menu">
           <div class="a2hs-menu-row">New tab</div>
           <div class="a2hs-menu-row a2hs-menu-row-active">Install app ${INSTALL_SVG}<span class="a2hs-tap"></span></div>
           <div class="a2hs-menu-row">Share…</div>
           <div class="a2hs-menu-row">Settings</div>
         </div>
       </div>
       ${HOME_SCENE}`;

  const dots = Array.from(
    { length: STEP_COUNT },
    (_, i) => `<button type="button" class="a2hs-dot" data-step="${i + 1}" aria-label="Step ${i + 1}"></button>`,
  ).join('');

  const cta = !ios
    ? `<button type="button" class="btn btn-primary a2hs-install">${INSTALL_SVG}Install Tensies</button>`
    : '';

  return `
    <div class="a2hs-phone" data-platform="${platform}" data-step="1">
      <span class="a2hs-phone-notch"></span>
      <div class="a2hs-phone-screen">${scenes}</div>
    </div>
    <div class="a2hs-dots">${dots}</div>
    <p class="a2hs-caption" aria-live="polite"></p>
    ${cta}
    <button type="button" class="a2hs-later">Maybe later</button>`;
}

/**
 * Per-step instruction HTML (shown one at a time in the caption under the dots).
 * @param {'ios'|'android'} platform
 * @returns {string[]}
 */
function stepTexts(platform) {
  return platform === 'ios'
    ? [
        `Tap ${SHARE_SVG}<strong>Share</strong>`,
        `Choose <strong>Add to Home&nbsp;Screen</strong> ${ADD_SVG}`,
        `Tap <strong>Add</strong> — you're set`,
      ]
    : [
        `Tap the ${MORE_SVG}<strong>menu</strong>`,
        `Choose <strong>Install app</strong> ${INSTALL_SVG}`,
        `Tap <strong>Install</strong> — you're set`,
      ];
}

export class A2hsGuide extends HTMLElement {
  /** @type {HTMLDialogElement | null} */
  #dialog = null;
  /** @type {HTMLElement | null} */
  #phone = null;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  #timer;
  #step = 1;
  /** @type {string[]} */
  #steps = [];

  /** @param {CustomEvent} e */
  #onOpen = (e) => this.open(e.detail?.platform);

  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    document.addEventListener('a2hs-open', /** @type {EventListener} */ (this.#onOpen));
  }

  disconnectedCallback() {
    document.removeEventListener('a2hs-open', /** @type {EventListener} */ (this.#onOpen));
    this.#stop();
  }

  /**
   * Build (once per call) and show the walkthrough for a platform.
   * @param {'ios'|'android'} platform
   */
  open(platform) {
    if (platform !== 'ios' && platform !== 'android') return;
    this.#stop();

    const dialog = document.createElement('dialog');
    dialog.className = 'overlay-dialog a2hs-overlay';
    dialog.setAttribute('aria-label', 'Add Tensies to your Home Screen');
    dialog.innerHTML = `
      <button type="button" class="a2hs-close" aria-label="Close">${CLOSE_SVG}</button>
      <div class="a2hs-card">
        <h2 class="a2hs-title">Add Tensies to your Home Screen</h2>
        <p class="a2hs-sub">One tap to play — full screen, no browser bar.</p>
        ${guideBody(platform)}
      </div>`;

    this.replaceChildren(dialog);
    this.#dialog = dialog;
    this.#phone = dialog.querySelector('.a2hs-phone');
    this.#steps = stepTexts(platform);

    // Tappable dots: jump to a step and hand control to the user (stop auto-play).
    dialog.querySelectorAll('.a2hs-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        this.#stop();
        this.#step = Number(dot.getAttribute('data-step'));
        this.#applyStep();
      });
    });

    dialog.querySelector('.a2hs-close')?.addEventListener('click', () => this.close());
    dialog.querySelector('.a2hs-later')?.addEventListener('click', () => {
      dismissBanner();
      this.close();
    });
    dialog.querySelector('.a2hs-install')?.addEventListener('click', async () => {
      const accepted = await triggerNativeInstall();
      if (accepted) this.close();
    });
    // Backdrop tap closes; Escape closes (these aren't game-state overlays).
    dialog.addEventListener('click', (ev) => {
      if (ev.target === dialog) this.close();
    });

    // Android with no captured prompt (criteria unmet / Firefox): drop the dead
    // native CTA and lean on the ⋮-menu steps instead.
    if (platform === 'android' && !hasNativePrompt()) {
      dialog.querySelector('.a2hs-install')?.remove();
    }

    dialog.showModal();
    this.#startCycle();
  }

  /** Advance the step every STEP_MS, syncing the phone, dots, and caption. */
  #startCycle() {
    this.#step = 1;
    this.#applyStep();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // no auto-play: the user steps through via the dots
    this.#timer = setInterval(() => {
      this.#step = (this.#step % STEP_COUNT) + 1;
      this.#applyStep();
    }, STEP_MS);
  }

  /** Reflect the current step on the phone scene, the dots, and the caption. */
  #applyStep() {
    if (this.#phone) this.#phone.dataset.step = String(this.#step);

    this.querySelectorAll('.a2hs-dot').forEach((dot, i) => {
      const on = i === this.#step - 1;
      dot.classList.toggle('active', on);
      if (on) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });

    const caption = /** @type {HTMLElement | null} */ (this.querySelector('.a2hs-caption'));
    if (caption) {
      caption.innerHTML = `<span class="a2hs-caption-num">${this.#step}</span><span class="a2hs-caption-text">${this.#steps[this.#step - 1] ?? ''}</span>`;
      // Restart the swap animation so the new instruction fades in.
      caption.classList.remove('swap');
      void caption.offsetWidth;
      caption.classList.add('swap');
    }
  }

  #stop() {
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  /** Close + dispose the dialog. */
  close() {
    this.#stop();
    if (this.#dialog?.open) this.#dialog.close();
    this.replaceChildren();
    this.#dialog = null;
    this.#phone = null;
  }
}

customElements.define('a2hs-guide', A2hsGuide);
