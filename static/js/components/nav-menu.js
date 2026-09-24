// @ts-check
import { isSignedIn, getAuthUser, signOut } from '../auth.js';
import { getPlatform, openGuide } from '../a2hs.js';
import { accountCoin } from '../account-coin.js';
import { cachedProfile, loadProfile } from '../account-sync.js';
import { makeMenuToggle } from '../menu-toggle.js';
import { navigate, showProfile, showSignin } from '../router.js';

// Phone-with-plus glyph for the "Add to Home Screen" entry.
const A2HS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7.5v5M9.5 10h5"/></svg>`;
// The pint (redrawn: the old handled mug read as coffee at 17px).
const BEER_ICON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.4 6.2h9.2l-1 13.4a2.3 2.3 0 0 1-2.3 2.1h-2.6a2.3 2.3 0 0 1-2.3-2.1z"/><path d="M7.6 9.9h8.8"/><path d="M8.6 6.2a2 2 0 0 1 2.1-2.4 2.1 2.1 0 0 1 3.4-.5 1.9 1.9 0 0 1 1.3 2.9"/></svg>`;
const CHEV_ICON = `<svg class="menu-tab-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;
const X_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
// The maker's mark for the sign-off: the MS/ monogram, inline so it takes the
// foot's ink through currentColor (one colour — the slash included).
const MS_MONOGRAM = `<svg class="menu-signoff-mark" viewBox="-2 16 202 94" aria-hidden="true" focusable="false"><path fill="currentColor" d="M91.94 100L69.16 100L69.16 74.21Q69.16 69.42 69.52 64.38Q69.89 59.34 70.30 55.90Q70.72 52.47 70.82 51.54L70.82 51.54L70.41 51.54L57.20 100L39.21 100L25.90 51.64L25.48 51.64Q25.58 52.58 26.05 55.96Q26.52 59.34 26.94 64.38Q27.35 69.42 27.35 74.21L27.35 74.21L27.35 100L6.24 100L6.24 28.45L38.69 28.45L49.50 69.74L49.92 69.74L60.63 28.45L91.94 28.45L91.94 100Z"/><path fill="currentColor" transform="translate(22.5 0)" d="M104.73 27.20Q118.46 27.20 127.30 32.76Q136.14 38.33 136.35 49.25L136.35 49.25L136.35 50.50L114.82 50.50L114.82 50.08Q114.82 46.96 112.53 44.88Q110.24 42.80 105.56 42.80L105.56 42.80Q100.99 42.80 98.54 44.15Q96.10 45.50 96.10 47.48L96.10 47.48Q96.10 50.29 99.43 51.64Q102.76 52.99 110.14 54.45L110.14 54.45Q118.77 56.22 124.34 58.14Q129.90 60.06 134.06 64.43Q138.22 68.80 138.32 76.29L138.32 76.29Q138.32 88.98 129.74 95.11Q121.16 101.25 106.81 101.25L106.81 101.25Q90.07 101.25 80.76 95.63Q71.45 90.02 71.45 75.77L71.45 75.77L93.19 75.77Q93.19 81.18 96.00 83.00Q98.80 84.82 104.73 84.82L104.73 84.82Q109.10 84.82 111.96 83.88Q114.82 82.94 114.82 80.03L114.82 80.03Q114.82 77.43 111.65 76.13Q108.48 74.83 101.30 73.38L101.30 73.38Q92.56 71.50 86.84 69.48Q81.12 67.45 76.86 62.77Q72.60 58.09 72.60 50.08L72.60 50.08Q72.60 38.33 81.70 32.76Q90.80 27.20 104.73 27.20L104.73 27.20Z"/><rect fill="currentColor" x="172.5" y="22.2" width="9" height="84" rx="4.5" transform="rotate(18 177 64.2)"/></svg>`;

/**
 * <nav-menu> — the slide-down menu (the owner's about copy + the foot of
 * controls, signed off with the maker's mark and the fine print; "What's New"
 * is its own routed page at /changelog since 2026-08-20) reached from the
 * hamburger on landing/join/lobby. Light DOM; the host *is*
 * `#nav-menu.game-menu.nav-menu`. Toggled by the bubbling `menu-toggle`
 * event from <app-header>. While open it sets `nav-menu-open` on <body>,
 * which drives the landing-header chrome rules in landing.css.
 */
export class NavMenu extends HTMLElement {
  #onMenuToggle = () => this.toggle();

  /** @param {KeyboardEvent} event */
  #onKeydown = (event) => {
    if (event.key === 'Escape' && this.isOpen()) this.close();
  };

  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'nav-menu';
    this.className = 'game-menu nav-menu';
    this.setAttribute('aria-hidden', 'true');
    this.innerHTML = `
      <div class="menu-topbar">
        <div class="topbar-title-row">
          <div class="game-title">
            <img src="/static/images/logo.svg" class="game-title-mark" alt="">
            <span>Tensies</span>
          </div>
          <button type="button" class="menu-close-btn nav-menu-close" aria-label="Close menu">${X_ICON}</button>
        </div>
      </div>
      <nav class="menu-panel" aria-label="Menu">
        <button type="button" class="menu-tab-line" id="menu-tab-line"></button>
        <h2 class="menu-about-heading">Built at the bar because you don't have to go home but you can't stay there.</h2>
        <p class="menu-about-body">My name's Michael. Over 20 years of making computers do things for businesses, people, and fun, and <strong>Tensies</strong> is squarely in the fun column. I wanted to build something cool while I picked up a few new tricks and passed along what I learned (usually by breaking it first).</p>
        <p class="menu-about-body">The real game gets played at the bar, with real dice, the good heavy kind. This is the version for when you forget yours, or the bar closes and reminds you that you do, in fact, have a home to go to: ten dice each, one target number, everybody rolling at once and racing to lock all ten first.</p>
        <p class="menu-about-body">For a bar game, it's wildly over-engineered, in the best way. I built it to be secure and to hold up under anything, using the same industry standards I'd trust for serious work. I work on it in my spare time, a little at home, a little at the bar, a little in Cap Cana with a drink in reach. The code's all out in the open, if you want to see how it works. Pull up a stool.</p>
      </nav>
      <div class="menu-foot">
        <button type="button" class="btn btn-primary menu-whats-new-btn">See What's New</button>
        <a href="https://buymeacoffee.com/radiantnode" target="_blank" rel="noopener noreferrer" class="btn btn-secondary menu-beer-btn">${BEER_ICON}Buy me a beer</a>
        <button type="button" class="menu-signout-btn" hidden>Sign out</button>
        <div class="menu-signoff">
          <a href="https://simmonstx.com/" target="_blank" rel="noopener noreferrer" class="menu-signoff-maker">${MS_MONOGRAM}<span>Made by Michael Simmons.</span></a>
          <p class="menu-signoff-line">&copy; Michael Simmons. All rights reserved.</p>
          <p class="menu-signoff-line"><a href="https://simmonstx.com/terms/" target="_blank" rel="noopener noreferrer">Terms</a><span aria-hidden="true"> | </span><a href="https://simmonstx.com/privacy/" target="_blank" rel="noopener noreferrer">Privacy</a></p>
        </div>
      </div>
      `;

    document.addEventListener('menu-toggle', this.#onMenuToggle);
    document.addEventListener('keydown', this.#onKeydown);

    this._updateAuthButton();
    this.querySelectorAll('.nav-menu-close').forEach((btn) =>
      btn.addEventListener('click', () => this.close()));
    /** @type {HTMLElement} */ (this.querySelector('#menu-tab-line'))
      .addEventListener('click', () => {
        const user = getAuthUser();
        this.close();
        if (user) showProfile(user.username);
        else showSignin();
      });
    /** @type {HTMLElement} */ (this.querySelector('.menu-signout-btn'))
      .addEventListener('click', () => {
        signOut();
        this._updateAuthButton();
        // Remove header account chrome from every header
        document.querySelectorAll('.header-username, .header-account-mark').forEach((el) => el.remove());
        // Refresh landing screen auth state if it exists
        const landing = /** @type {any} */ (document.getElementById('landing'));
        if (landing?.refreshAuth) landing.refreshAuth();
        this.close();
      });
    /** @type {HTMLElement} */ (this.querySelector('.menu-whats-new-btn'))
      .addEventListener('click', () => {
        // The changelog is its own page now (2026-08-20) — navigate, don't panel-swap.
        this.close();
        navigate('/changelog');
      });

    this.#mountInstallEntry();
  }


  /**
   * Add the "Add to Home Screen" entry — only when an install flow applies
   * (mobile, not already installed). Stays out of the DOM otherwise.
   */
  #mountInstallEntry() {
    if (!getPlatform()) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary menu-a2hs-btn';
    btn.innerHTML = `${A2HS_ICON}Add to Home Screen`;
    btn.addEventListener('click', () => {
      this.close();
      openGuide();
    });
    const beer = this.querySelector('.menu-beer-btn');
    beer?.parentElement?.insertBefore(btn, beer);
  }

  disconnectedCallback() {
    document.removeEventListener('menu-toggle', this.#onMenuToggle);
    document.removeEventListener('keydown', this.#onKeydown);
  }

  /** Whether the menu is currently open. */
  isOpen() {
    return this.classList.contains('open');
  }

  /** Rapid-tap-guarded open/close (see makeMenuToggle; 320ms tracks the 0.28s
   *  opacity fade). */
  #guardedToggle = makeMenuToggle({
    isOpen: () => this.isOpen(),
    open: () => this.open(),
    close: () => this.close(),
  });

  /** Open if closed, close if open. */
  toggle() {
    this.#guardedToggle();
  }

  /** The host screen's document scroll offset while the menu owns the
   *  scroller (doc-scroll mode; restored on close). */
  #savedScrollY = 0;

  /** Whether this menu enabled doc-scroll itself (host screen was on the
   *  fixed shell — the landing) and must take it back down on close. */
  #forcedDocScroll = false;

  /** Slide the menu in and reflect the open state on body + hamburgers. */
  open() {
    // The menu flows as a page even over fixed-shell hosts (the landing):
    // force doc-scroll on for the menu's lifetime and restore on close.
    this.#forcedDocScroll = !document.documentElement.classList.contains('doc-scroll');
    if (this.#forcedDocScroll) {
      document.documentElement.classList.add('doc-scroll');
      this.#savedScrollY = 0;
      window.scrollTo(0, 0);
    } else {
      // The host already owns the document scroller — park its offset and
      // start the menu at its top.
      this.#savedScrollY = window.scrollY;
      window.scrollTo(0, 0);
    }
    this.classList.add('open');
    this.setAttribute('aria-hidden', 'false');
    document.body.classList.add('nav-menu-open');
    this._updateAuthButton();
    this.#syncButtons(true);
  }

  /** Slide the menu out (and leave the changelog panel). */
  close() {
    this.classList.remove('open');
    this.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nav-menu-open');
    this.#syncButtons(false);
    // Hand the document scroller back to the host screen where it was —
    // or take doc-scroll back down if the host is on the fixed shell.
    if (this.#forcedDocScroll) {
      window.scrollTo(0, 0);
      document.documentElement.classList.remove('doc-scroll');
      this.#forcedDocScroll = false;
    } else if (document.documentElement.classList.contains('doc-scroll')) {
      window.scrollTo(0, this.#savedScrollY);
    }
  }

  /**
   * Reflect open state on whichever pre-game hamburger triggered it.
   * @param {boolean} open
   */
  #syncButtons(open) {
    document.querySelectorAll('.app-header .game-menu-btn').forEach((btn) => {
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  /**
   * The tab line at the top of the menu. Signed out it is the pitch — "Get
   * your own tab." with the struck coin. Signed in it becomes YOUR tab: the
   * photo in the same ring, @handle, and the real stats as the sub — a door
   * to your profile. Sign out appears in the foot, the quietest thing in the
   * menu (header-signedin.json).
   */
  _updateAuthButton() {
    const line = /** @type {HTMLElement | null} */ (this.querySelector('#menu-tab-line'));
    const signoutBtn = /** @type {HTMLElement | null} */ (this.querySelector('.menu-signout-btn'));
    if (!line) return;
    const user = getAuthUser();
    if (signoutBtn) signoutBtn.hidden = !user;

    const text = document.createElement('span');
    text.className = 'menu-tab-text';
    const title = document.createElement('b');
    const sub = document.createElement('span');
    if (user) {
      const cached = cachedProfile(user.username);
      title.textContent = `@${user.username}`;
      if (cached) {
        sub.textContent = `${cached.total_games} game${cached.total_games === 1 ? '' : 's'} · ${cached.total_rounds} rounds won`;
      } else {
        sub.textContent = 'See your stats and games';
        // Fill the real figures in when the profile lands.
        loadProfile(user.username).then(() => {
          if (getAuthUser()?.username === user.username) this._updateAuthButton();
        });
      }
      text.append(title, sub);
      line.replaceChildren(
        accountCoin(cached?.photo_url ?? null, 'menu-coin account-coin'), text);
    } else {
      title.textContent = 'Get your own tab.';
      sub.textContent = 'Keep your stats, your name and your wins';
      text.append(title, sub);
      line.replaceChildren(accountCoin(null, 'menu-coin account-coin'), text);
    }
    line.insertAdjacentHTML('beforeend', CHEV_ICON);
  }

}

customElements.define('nav-menu', NavMenu);
