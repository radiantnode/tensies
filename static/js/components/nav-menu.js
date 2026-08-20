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

/**
 * <nav-menu> — the slide-down menu (the owner's about copy + the foot of
 * controls; "What's New" is its own routed page at /changelog since
 * 2026-08-20) reached from the hamburger on landing/join/lobby. Light DOM; the host *is*
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
