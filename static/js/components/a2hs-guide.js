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

const APP_ICON = '/static/images/icon-180.png';

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
const EXT_SVG = `<svg class="a2hs-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
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

// The ⋮ drawn INTO the instruction (not the character): at small sizes the
// glyph's dots are a hair of ink; drawn, it takes the brass with the word so
// the target reads as ONE mark (a2hs.json).
const MORE_INLINE = `<svg class="a2hs-morein" viewBox="8.6 2.4 6.8 19.2" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="12" cy="19" r="2.1"/></svg>`;

const STEP_MS = 1900;

// ── status bar (time + signal/wifi/battery); iOS gets the Dynamic Island,
// Android a centred hole punch — the cheapest possible tell. ──
const SB_SIGNAL = `<svg class="a2hs-sb-ic" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="6" rx="1"/><rect x="10" y="3.5" width="3" height="8.5" rx="1"/><rect x="15" y="1" width="3" height="11" rx="1"/></svg>`;
const SB_WIFI = `<svg class="a2hs-sb-ic" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 4.4a9 9 0 0 1 12 0"/><path d="M4.3 6.8a6 6 0 0 1 7.4 0"/><path d="M6.5 9a3 3 0 0 1 3 0"/><circle cx="8" cy="10.8" r="0.5" fill="currentColor" stroke="none"/></svg>`;
const SB_BATTERY = `<svg class="a2hs-sb-bat" viewBox="0 0 25 12" fill="none" aria-hidden="true"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity="0.45"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor"/><path d="M23 4v4c.9-.4.9-3.6 0-4z" fill="currentColor" fill-opacity="0.45"/></svg>`;
const STATUSBAR = `
  <div class="a2hs-statusbar">
    <span class="a2hs-sb-time">9:41</span>
    <span class="a2hs-sb-icons">${SB_SIGNAL}${SB_WIFI}${SB_BATTERY}</span>
  </div>`;
const IOS_CHROME = `${STATUSBAR}<span class="a2hs-island"></span>`;
/* The Android status strip carries the app's own <meta name="theme-color">
   because Chrome tints it from the page; it stops when Chrome stops, so the
   home-screen scene's bar is the launcher's, untinted. */
const ANDROID_CHROME = `<div class="a2hs-sb-tint">${STATUSBAR}</div><span class="a2hs-hole"></span>`;
const ANDROID_BARE = `${STATUSBAR}<span class="a2hs-hole"></span>`;

/**
 * The user's current time as "H:MM" in their locale's hour convention
 * (12- or 24-hour, no AM/PM) — to match what their real status bar shows.
 */
function currentStatusTime() {
  try {
    const parts = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).formatToParts(new Date());
    return parts
      .filter((p) => p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && p.value.trim() === ':'))
      .map((p) => (p.type === 'literal' ? ':' : p.value))
      .join('');
  } catch {
    return '9:41';
  }
}

/**
 * A home screen with the Tensies tile. The generic apps lose their names but
 * KEEP their label boxes so the row heights stay equal — only Tensies is
 * named. iOS's closing scene adds a halo AROUND the tile (it is an
 * instruction: open it); Android's adds nothing (it is a RESULT: installed,
 * nothing left to press) and its launcher masks tiles to circles.
 * @param {number} scene  which data-scene slot
 * @param {'ios'|'android'} platform
 * @param {boolean} [tap] halo around the tile (iOS launch cue)
 */
function homeScene(scene, platform, tap = false) {
  const android = platform === 'android';
  const rnd = android ? ' a2hs-rnd' : '';
  const cell = `<div class="a2hs-home-cell"><span class="a2hs-home-ph${rnd}"></span><span class="a2hs-home-phlabel"></span></div>`;
  const before = cell.repeat(3);
  const after = cell.repeat(android ? 8 : 3);
  return `
  <div class="a2hs-scene" data-scene="${scene}">
    <div class="a2hs-home">
      ${android ? ANDROID_BARE : ''}
      <div class="a2hs-home-grid">
        ${before}
        <div class="a2hs-home-cell a2hs-home-tensies">
          <span class="a2hs-home-tile${rnd}"><img class="a2hs-home-icon" src="${APP_ICON}" alt="" width="36" height="36"></span>
          <span class="a2hs-home-label">Tensies</span>
          ${tap ? '<span class="a2hs-tile-halo"></span>' : ''}
        </div>
        ${after}
      </div>
      ${android
        ? '<div class="a2hs-pagedots"><i></i><i></i><i></i></div><div class="a2hs-dock"><i></i><i></i><i></i><i></i></div><div class="a2hs-searchpill"></div>'
        : '<div class="a2hs-home-dots"><i></i><i></i></div>'}
    </div>
  </div>`;
}

// ── iOS scenes (reproduce the real Safari chrome) ──

const IOS_SCENE_1 = `
  <div class="a2hs-scene" data-scene="1">
    <div class="a2hs-ios-page"></div>
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

  // Chrome's toolbar: omnibox, tab counter, overflow — Chrome's own dark
  // greys, never ours. The white tap ripple is the ONLY thing that says
  // "this one"; the accent was removed by deletion, not substitution.
  const atool = (/** @type {boolean} */ tap) => `<div class="a2hs-abar">
    <span class="a2hs-aomni"><span class="a2hs-alock">${EXT_SVG}</span>tensies.app</span>
    <span class="a2hs-atabs">3</span>
    <span class="a2hs-amore">${MORE_SVG}${tap ? '<span class="a2hs-tap a2hs-tap-toolbar"></span>' : ''}</span></div>`;

  const scenes = ios
    ? `${IOS_SCENE_1}${IOS_SCENE_2}${IOS_SCENE_3}${homeScene(4, 'ios', true)}`
    : `<div class="a2hs-scene" data-scene="1">
         <div class="a2hs-ios-page a2hs-page-under"></div>
         ${ANDROID_CHROME}${atool(true)}
       </div>
       <div class="a2hs-scene" data-scene="2">
         <div class="a2hs-ios-page a2hs-page-under"></div>
         ${ANDROID_CHROME}${atool(false)}
         <div class="a2hs-sheet-dim"></div>
         <div class="a2hs-menu">
           <div class="a2hs-menu-icons">${CHEV_L}${CHEV_R}${STAR_SVG}${RELOAD_SVG}</div>
           <div class="a2hs-menu-row">New tab</div>
           <div class="a2hs-menu-row">New Incognito tab</div>
           <div class="a2hs-menu-row">History</div>
           <div class="a2hs-menu-row">Downloads</div>
           <div class="a2hs-menu-row">Bookmarks</div>
           <div class="a2hs-menu-row a2hs-menu-row-hot">Install app ${INSTALL_SVG}<span class="a2hs-tap a2hs-tap-row"></span></div>
           <div class="a2hs-menu-row">Share…</div>
           <div class="a2hs-menu-row">Settings</div>
         </div>
       </div>
       ${homeScene(3, 'android')}`;

  const stepCount = stepTexts(platform).length;
  // Progress is the loading screen's brass THREAD in filling segments, not
  // dots — this walkthrough drives itself, and a thread that fills reads as
  // progress rather than navigation. Segments stay tappable.
  const segs = Array.from(
    { length: stepCount },
    (_, i) => `<button type="button" class="a2hs-seg" data-step="${i + 1}" aria-label="Step ${i + 1}"></button>`,
  ).join('');

  // The native CTA is OURS, so it takes the keeper brass — and that single
  // material rule carries the hierarchy: with a prompt to fire the BUTTON is
  // the path and the steps are reassurance. Without one (a2hs.js removes it)
  // the instruction is loudest again — the iOS lock, unchanged.
  const cta = !ios
    ? `<button type="button" class="btn btn-primary a2hs-install">${INSTALL_SVG}Install Tensies</button>`
    : '';

  return `
    <div class="a2hs-phone" data-platform="${platform}" data-step="1">
      <div class="a2hs-phone-screen">${ios ? IOS_CHROME : ''}${scenes}</div>
    </div>
    <p class="a2hs-stepno" aria-hidden="true"></p>
    <div class="a2hs-thread">${segs}</div>
    <p class="a2hs-caption" aria-live="polite"></p>
    ${cta}`;
}

/**
 * Per-step instruction (the loudest thing at the bottom). `hint` renders as a
 * separate muted line below it.
 * @param {'ios'|'android'} platform
 * @returns {{ html: string, hint?: string }[]}
 */
function stepTexts(platform) {
  return platform === 'ios'
    ? [
        { html: `Tap <strong>Share</strong>` },
        { html: `Choose <strong>Add to Home&nbsp;Screen</strong>`, hint: `Swipe up if you don't see it` },
        { html: `Tap <strong>Add</strong>`, hint: `Make sure Open as Web App is checked` },
        { html: `Open <strong>Tensies</strong> from your Home Screen` },
      ]
    : [
        { html: `Tap the <strong>${MORE_INLINE} menu</strong>` },
        { html: `Choose <strong>Install app</strong>` },
        { html: `Tensies lands on your <strong>Home screen</strong>`, hint: `Confirm <strong>Install</strong> if Chrome asks` },
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
  #stepCount = 3;
  /** @type {{ html: string, hint?: string }[]} */
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
        <h2 class="a2hs-title">Keep Tensies<br>on your phone.</h2>
        <p class="a2hs-sub">One tap to play — full screen, no browser bar.</p>
        ${guideBody(platform)}
      </div>`;

    this.replaceChildren(dialog);
    this.#dialog = dialog;
    this.#phone = dialog.querySelector('.a2hs-phone');
    this.#steps = stepTexts(platform);
    this.#stepCount = this.#steps.length;

    // Show the user's real time in the mocked status bar (a nice touch).
    const timeEl = dialog.querySelector('.a2hs-sb-time');
    if (timeEl) timeEl.textContent = currentStatusTime();

    // Tappable thread segments: jump to a step and hand control to the user.
    dialog.querySelectorAll('.a2hs-seg').forEach((seg) => {
      seg.addEventListener('click', () => {
        this.#stop();
        this.#step = Number(seg.getAttribute('data-step'));
        this.#applyStep();
      });
    });

    dialog.querySelector('.a2hs-close')?.addEventListener('click', () => this.close());
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
      this.#step = (this.#step % this.#stepCount) + 1;
      this.#applyStep();
    }, STEP_MS);
  }

  /** Reflect the current step on the phone scene, the thread, the legend,
   *  and the instruction. */
  #applyStep() {
    if (this.#phone) this.#phone.dataset.step = String(this.#step);

    // The thread FILLS to the current step.
    this.querySelectorAll('.a2hs-seg').forEach((seg, i) => {
      const on = i <= this.#step - 1;
      seg.classList.toggle('on', on);
      if (i === this.#step - 1) seg.setAttribute('aria-current', 'step');
      else seg.removeAttribute('aria-current');
    });

    // The step position is the quietest thing; the instruction the loudest.
    const stepno = /** @type {HTMLElement | null} */ (this.querySelector('.a2hs-stepno'));
    if (stepno) stepno.textContent = `Step ${this.#step} of ${this.#stepCount}`;

    const caption = /** @type {HTMLElement | null} */ (this.querySelector('.a2hs-caption'));
    if (caption) {
      const item = this.#steps[this.#step - 1] ?? { html: '' };
      caption.innerHTML = item.html
        + (item.hint ? `<span class="a2hs-caption-hint">${item.hint}</span>` : '');
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
