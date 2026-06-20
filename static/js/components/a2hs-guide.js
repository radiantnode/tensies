// @ts-check
import { triggerNativeInstall, hasNativePrompt, dismissBanner } from '../a2hs.js';

/**
 * <a2hs-guide> — the "Add to Home Screen" walkthrough.
 *
 * A body-level <dialog> (like the winner/pause overlays) holding a CSS/SVG
 * phone mockup that cross-fades through three synced steps. iOS gets the Safari
 * Share-sheet route; Android gets the ⋮-menu route plus a native Install CTA.
 * Opened via the document-level `a2hs-open` event (see a2hs.js::openGuide).
 *
 * Light DOM, host is laid out as `display: contents` so a closed guide adds no
 * box to any screen — it stays inert until opened.
 */

const APP_ICON = '/static/images/apple-touch-icon-180.png';

// Inline SVG glyphs (stroke = currentColor; no inline styles, CSP-safe).
const SHARE_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>`;
const ADD_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>`;
const MORE_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>`;
const INSTALL_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M5 20h14"/></svg>`;
const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

const STEP_COUNT = 3;
const STEP_MS = 1900;

/** Shared closing scene: the app icon popping onto a home-screen grid. */
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

/**
 * Build the phone-mockup + step-list markup for a platform.
 * @param {'ios'|'android'} platform
 */
function guideBody(platform) {
  const ios = platform === 'ios';

  const scene1 = ios
    ? `<div class="a2hs-scene" data-scene="1">
         <div class="a2hs-browser">
           <div class="a2hs-url-bar"><span class="a2hs-url">tensies.app</span></div>
           <div class="a2hs-app-canvas">
             <img class="a2hs-canvas-logo" src="/static/images/logo.svg" alt="" width="40" height="40">
             <span class="a2hs-canvas-word">TENSIES</span>
           </div>
           <div class="a2hs-toolbar">
             <span class="a2hs-tool">${chevron('left')}</span>
             <span class="a2hs-tool">${chevron('right')}</span>
             <span class="a2hs-tool a2hs-tool-active">${SHARE_SVG}<span class="a2hs-tap"></span></span>
             <span class="a2hs-tool">${bookGlyph()}</span>
             <span class="a2hs-tool">${tabsGlyph()}</span>
           </div>
         </div>
       </div>`
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
       </div>`;

  const scene2 = ios
    ? `<div class="a2hs-scene" data-scene="2">
         <div class="a2hs-sheet-dim"></div>
         <div class="a2hs-sheet">
           <span class="a2hs-sheet-grabber"></span>
           <div class="a2hs-sheet-app">
             <img src="${APP_ICON}" alt="" width="36" height="36">
             <span class="a2hs-sheet-app-name">Tensies<small>tensies.app</small></span>
           </div>
           <div class="a2hs-sheet-list">
             <div class="a2hs-sheet-row">Add to Favorites ${starGlyph()}</div>
             <div class="a2hs-sheet-row a2hs-sheet-row-active">Add to Home Screen ${ADD_SVG}<span class="a2hs-tap"></span></div>
             <div class="a2hs-sheet-row">Copy ${copyGlyph()}</div>
           </div>
         </div>
       </div>`
    : `<div class="a2hs-scene" data-scene="2">
         <div class="a2hs-sheet-dim"></div>
         <div class="a2hs-menu">
           <div class="a2hs-menu-row">New tab</div>
           <div class="a2hs-menu-row a2hs-menu-row-active">Install app ${INSTALL_SVG}<span class="a2hs-tap"></span></div>
           <div class="a2hs-menu-row">Share…</div>
           <div class="a2hs-menu-row">Settings</div>
         </div>
       </div>`;

  const steps = ios
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

  const stepList = steps
    .map(
      (html, i) =>
        `<li class="a2hs-step" data-step="${i + 1}"><span class="a2hs-step-num">${i + 1}</span><span class="a2hs-step-text">${html}</span></li>`,
    )
    .join('');

  const cta = !ios
    ? `<button type="button" class="btn btn-primary a2hs-install">${INSTALL_SVG}Install Tensies</button>`
    : '';

  return `
    <div class="a2hs-phone" data-platform="${platform}" data-step="1">
      <span class="a2hs-phone-notch"></span>
      <div class="a2hs-phone-screen">${scene1}${scene2}${HOME_SCENE}</div>
    </div>
    <ol class="a2hs-steps">${stepList}</ol>
    ${cta}
    <button type="button" class="a2hs-later">Maybe later</button>`;
}

// ── small glyph helpers (kept tiny + local) ──
/** @param {'left'|'right'} dir */
function chevron(dir) {
  const d = dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6';
  return `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
function bookGlyph() {
  return `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1-1h5v16H5a1 1 0 0 1-1-1zM20 5a1 1 0 0 0-1-1h-5v16h5a1 1 0 0 0 1-1z"/></svg>`;
}
function tabsGlyph() {
  return `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>`;
}
function starGlyph() {
  return `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 15.8 7.3 18.2l.9-5.1L4.5 9.5l5.2-.8z"/></svg>`;
}
function copyGlyph() {
  return `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>`;
}

export class A2hsGuide extends HTMLElement {
  /** @type {HTMLDialogElement | null} */
  #dialog = null;
  /** @type {HTMLElement | null} */
  #phone = null;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  #timer;
  #step = 1;

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
        <img class="a2hs-app-icon" src="${APP_ICON}" alt="" width="60" height="60">
        <h2 class="a2hs-title">Add Tensies to your Home Screen</h2>
        <p class="a2hs-sub">One tap to play — full screen, no browser bar.</p>
        ${guideBody(platform)}
      </div>`;

    this.replaceChildren(dialog);
    this.#dialog = dialog;
    this.#phone = dialog.querySelector('.a2hs-phone');

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

  /** Advance the step every STEP_MS, syncing the phone + step list. */
  #startCycle() {
    this.#step = 1;
    this.#applyStep();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // static: the numbered list already conveys every step
    this.#timer = setInterval(() => {
      this.#step = (this.#step % STEP_COUNT) + 1;
      this.#applyStep();
    }, STEP_MS);
  }

  #applyStep() {
    if (this.#phone) this.#phone.dataset.step = String(this.#step);
    this.querySelectorAll('.a2hs-step').forEach((li) => {
      li.classList.toggle('active', li.getAttribute('data-step') === String(this.#step));
    });
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
