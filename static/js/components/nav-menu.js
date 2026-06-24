// @ts-check
import { isSignedIn, getAuthUser, signOut } from '../auth.js';
import { getPlatform, openGuide } from '../a2hs.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { showSignin } from '../router.js';
import { updateScrollFades } from '../scroll-fades.js';

// Phone-with-plus glyph for the "Add to Home Screen" entry.
const A2HS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7.5v5M9.5 10h5"/></svg>`;

// Baked changelog HTML — content, not code; the changelog skill regenerates it.
const CHANGELOG = `<p>Pull up a stool. Newest stuff up top.</p>
<h2>1.18.0 ("Cherry on Top")</h2>
<p>Wednesday, June 24, 2026</p>
<ul>
<li>The roll button is a big floating circle now. Easier to find, easier to tap.</li>
<li>When it's not your turn, the button pulses with a rotating glow so you know it's alive. 🫧</li>
<li>Fresh app icons everywhere, so Tensies looks right on your home screen and share sheet.</li>
<li><em>Behind the scenes: tightened tap targets and scoped visual effects to keep the board clean.</em></li>
</ul>
<h2>1.17.1 ("Rim Salt")</h2>
<p>Tuesday, June 23, 2026</p>
<ul>
<li>Share links look better. When you text someone a Tensies link, the preview card actually does its job.</li>
<li>Fixed the share icon on iOS so it shows up where it belongs. 📱</li>
<li><em>Behind the scenes: tidied up how pages present themselves to search engines and social previews.</em></li>
</ul>
<h2>1.17.0 ("Pocket Pour")</h2>
<p>Sunday, June 21, 2026</p>
<ul>
<li>An animated walkthrough shows you how to add Tensies to your home screen, step by step. 🏠</li>
</ul>
<h2>1.16.1 ("Well Drink")</h2>
<p>Saturday, June 20, 2026</p>
<ul>
<li>Fixed a bug where the standings on your profile showed players in the wrong order. Your wins are your wins. 🏆</li>
<li><em>Behind the scenes: bumped every dependency, added automated security scanning, set up a CI gate.</em></li>
</ul>
<h2>1.16.0 ("The Group Chat")</h2>
<p>Friday, June 19, 2026</p>
<ul>
<li>When a game ends, you land on the game's detail page instead of a throwaway overlay. Your scoreboard sticks around.</li>
<li>Got a Discord server? Tensies can post game updates there: who joined, who won, round by round.</li>
<li>There's a /verify command in Discord too, so anyone can check that the dice were fair without leaving the chat. 🎲</li>
</ul>
<h2>1.15.0 ("House Rules")</h2>
<p>Thursday, June 18, 2026</p>
<ul>
<li>Your profile has a bio and location field now.</li>
<li>Every roll is backed by a distributed randomness beacon (drand), which means you can mathematically prove the dice weren't rigged. Not that you'd accuse your friends of anything. 🛡️</li>
<li>Each game has its own page at /games/CODE with a Roll Trust section. Tap the shield to see the cryptographic proof.</li>
<li><em>Behind the scenes: the randomness verification runs end to end, from the beacon to the roll to the proof page.</em></li>
</ul>
<h2>1.14.0 ("Closing Time")</h2>
<p>Wednesday, June 17, 2026</p>
<ul>
<li>Hosts can end the game. When it's over, everyone sees a scoreboard with final standings, avatars, and bragging rights. 🍻</li>
<li>The game-ended screen survives a refresh, so you can't lose your receipts.</li>
<li><em>Behind the scenes: tuned profile recent games to count everyone who actually showed up.</em></li>
</ul>
<h2>1.13.1 ("Napkin Notes")</h2>
<p>Tuesday, June 16, 2026</p>
<ul>
<li><em>Behind the scenes: reviewed outside feedback on the codebase, sharpened a few things based on what held up.</em></li>
</ul>
<h2>1.13.0 ("Bar Card")</h2>
<p>Monday, June 15, 2026</p>
<ul>
<li>You've got a public profile at /@yourusername with your stats, avatar, and recent games. Show it off or don't. 🪪</li>
<li>Your username pill on the landing and lobby links straight to your profile.</li>
<li>Signing in works everywhere now, including prod.</li>
<li><em>Behind the scenes: wrote data repair scripts to backfill stats for players who were rolling before accounts existed.</em></li>
</ul>
<h2>1.12.0 ("Regular's Tab")</h2>
<p>Sunday, June 14, 2026</p>
<ul>
<li>You can create an account with a passkey. No passwords, no email, just your fingerprint or face. Your stats carry over from anonymous games. 🔑</li>
<li>Once signed in, your name shows up in a pill in the header.</li>
<li>The changelog scrolls as one smooth page now instead of fighting with the menu panel.</li>
<li>Fixed a gap at the bottom of the screen on iOS when running from the home screen.</li>
</ul>
<h2>1.11.0 ("Jukebox")</h2>
<p>Saturday, June 13, 2026</p>
<ul>
<li>The dice on the landing screen wiggle. They're happy to see you. 🎲</li>
<li>Buttons have a shimmer sweep that catches the light. Looks good in a dim bar.</li>
<li>Share and Play sit side by side in the lobby so inviting friends is faster.</li>
<li>Player badges (YOU, HOST) both show up now, and you're always sorted to the top.</li>
<li><em>Behind the scenes: built a standalone soundboard tool for field-testing the audio code share across different phones.</em></li>
</ul>
<h2>1.10.0 ("On Tap")</h2>
<p>Friday, June 12, 2026</p>
<ul>
<li>Tensies is installable. Add it to your home screen and it launches full screen, like a real app. 📲</li>
<li>The invite button uses your phone's native share sheet, so you can text, AirDrop, whatever.</li>
<li>Turn your phone sideways and you'll see a "rotate your phone" screen instead of a sideways mess.</li>
<li>Experimental: the lobby has a Play button that chirps your game code as audio, and a Listen button that decodes it. Hold your phones close.</li>
</ul>
<h2>1.9.0 ("Same Round, New Glass")</h2>
<p>Thursday, June 11, 2026</p>
<ul>
<li>Fixed a bug where the winner overlay could flash away if another player's roll came in at the wrong moment.</li>
<li>Dice land in their scattered positions before the board paints, so they don't snap into place after the fact.</li>
<li>Safari users, the 3D dice stay 3D during screen transitions now. They were going flat. 🧊</li>
<li>The loading screen holds until your dice are actually rendered, then dissolves.</li>
<li><em>Behind the scenes: rebuilt the entire frontend from scratch with stricter code organization. Every view was pixel-verified against the original.</em></li>
</ul>
<h2>1.8.1 ("Bar Back")</h2>
<p>Wednesday, June 10, 2026</p>
<ul>
<li><em>Behind the scenes: overhauled dev tooling and session bootstrapping. Pinned browser versions for consistent test results.</em></li>
</ul>
<h2>1.8.0 ("Quick Pour")</h2>
<p>Monday, June 8, 2026</p>
<ul>
<li>The winner overlay pops up right after the dice scatter instead of waiting for a stale animation. Faster bragging rights. 👑</li>
<li><em>Behind the scenes: added a build pipeline that bundles, minifies, and fingerprints every asset. Prod loads are leaner.</em></li>
</ul>
<h2>1.7.0 ("Bouncer")</h2>
<p>Sunday, June 7, 2026</p>
<ul>
<li>Fixed a bug where the winner overlay would flash away if a broadcast landed mid-reveal. Your moment of glory stays put.</li>
<li>Join links are cleaner. tensies.app/ABCD instead of tensies.app/?join=ABCD. 🔗</li>
<li><em>Behind the scenes: strict security headers (CSP, HSTS), nginx in front for prod, metrics endpoints locked down.</em></li>
</ul>
<h2>1.6.0 ("Open Bar")</h2>
<p>Monday, June 1, 2026</p>
<ul>
<li>Games can run across multiple servers now, sharing one Redis backend. Tensies can handle a packed house. 🍺</li>
<li>Security got a tune-up: patched dependencies, locked down the container, added abuse guards.</li>
<li>The frontend was rewritten into web components, pixel-identical to what you know. Same look, better architecture.</li>
<li><em>Behind the scenes: all game state lives in Redis now so any server can pick up any game. Built from a barstool in Cap Cana, Dominican Republic.</em></li>
</ul>
<h2>1.5.0 ("Happy Hour")</h2>
<p>Sunday, May 31, 2026</p>
<ul>
<li>Everything looks warmer. The landing page, the lobby, the buttons, the fonts, all of it got redecorated.</li>
<li>The dice are properly 3D now, lit to match the bar. They look like real dice on real wood.</li>
<li>Losers see cracked dice on the round-end screen. Winners get a glowing 3D die flying at them with their name in gold. You earned it. 💀</li>
<li>There's a nav menu now (hamburger on the landing page) with an About section and a What's New panel.</li>
<li>Rounds count up (1, 2, 3, 4, 5, 6, repeat) instead of down. Feels more natural.</li>
<li><em>Behind the scenes: self-hosted the Inter font, rebuilt overlays and status elements to match the warm aesthetic.</em></li>
</ul>
<h2>1.4.0 ("Last Call")</h2>
<p>Saturday, May 30, 2026</p>
<ul>
<li>Hosts can pause the game. Perfect for a bar run, a bathroom break, or settling who's buying the next round. Everyone else sees a "waiting for the host" screen while the board stays live underneath. ⏸️</li>
<li>If the host's phone dies during a pause, another player gets promoted so the crew isn't stuck. If nobody comes back for an hour, the game wraps itself up.</li>
<li>Reconnect uses a private token now, so nobody can hijack your seat.</li>
<li><em>Behind the scenes: tuned the dashboards and started tracking more per game to keep matches fair.</em></li>
</ul>
<h2>1.3.0 ("Cocktail Menu")</h2>
<p>Friday, May 29, 2026</p>
<ul>
<li>There's an in-game menu now. Tap the hamburger to open it. It's the skeleton for bigger things, but it's there. 🍔</li>
<li><em>Behind the scenes: built out analytics dashboards and the test harness.</em></li>
</ul>
<h2>1.2.0 ("Coaster")</h2>
<p>Thursday, May 28, 2026</p>
<ul>
<li>Your dice stay put now, even if you refresh or your phone naps. 🛋️</li>
<li>There's a proper loading screen instead of the old disconnect/reconnect dialogs. It tells you what's happening.</li>
<li>Fixed a bug where the winner overlay could stick around and block the next round.</li>
<li><em>Behind the scenes: split the codebase into modules, added a telemetry pipeline, started tracking game events.</em></li>
</ul>
<h2>1.1.0 ("Designated Driver")</h2>
<p>Wednesday, May 27, 2026</p>
<ul>
<li>If your phone drops the connection, you've got 30 seconds to get back in. A little overlay lets you know it's trying. 🔌</li>
<li>Other players see the dice change at the right moment now, synced with the roller's animation instead of spoiling the reveal.</li>
<li>Fixed a freeze when your re-roll landed on the exact same numbers. Spooky, but gone.</li>
<li>The game header got a dice logo, warmer text, and animated progress bars.</li>
<li>Tensies link previews look good now. OG tags and a proper card image.</li>
<li><em>Behind the scenes: dice rolls are server-authoritative, so nobody can cheat from the client side.</em></li>
</ul>
<h2>1.0.1 ("Garnish")</h2>
<p>Tuesday, May 26, 2026</p>
<ul>
<li>Tensies has a logo. A pair of dice, as the favicon and app icon. 🎲</li>
<li><em>Behind the scenes: moved dice rolling to the server so every roll is legit.</em></li>
</ul>
<h2>1.0.0 ("First Round")</h2>
<p>Monday, May 25, 2026</p>
<ul>
<li>A bar regular and his friends love playing Tensies, the dice game. One night, a few heated rounds deep and drinks in, he thought it'd be great to play anywhere, even when you forget the dice. So he started having Claude build the game, sketched the very first game board himself, and kept tinkering on it from his barstool, chatting with Claude between rounds.</li>
<li>The whole game was already built before anyone remembered to type git init. By the time the first commit landed, you could create a game, invite friends with a link or a text, roll your dice with physics and animations, and watch your opponents in real time. Ten dice, one target, first to lock them all wins the round.</li>
<li>iOS friendly from the start. No scroll, no zoom, rapid taps all register. Five players fit at the bar at once. 🍺</li>
<li><em>Behind the scenes: the git history starts at "Initial commit" but the game was already a whole thing. Classic "I'll set up version control later" energy.</em></li>
</ul>
<div class="menu-changelog-footer">
  <p class="menu-changelog-footer-lead">Still scrolling? Either you're into the nerdy bits or just doomscrolling between rounds.</p>
  <p>Tensies got built at the bar, and it stays open like one. Anybody can wander in. The code's all there if you want to see how it works or check that the rolls are fair.</p>
  <a class="menu-changelog-ghlink" href="https://github.com/radiantnode/tensies" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
    View on GitHub
  </a>
</div>`;

/**
 * <nav-menu> — the slide-down menu (about + "What's New" changelog) reached
 * from the hamburger on landing/join/lobby. Light DOM; the host *is*
 * `#nav-menu.game-menu.nav-menu`. Toggled by the bubbling `menu-toggle`
 * event from <app-header>. While open it sets `nav-menu-open` on <body>,
 * which drives the landing-header chrome rules in landing.css.
 */
export class NavMenu extends HTMLElement {
  /** @type {HTMLElement | null} */
  #body = null;

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
      <nav class="menu-panel" aria-label="Menu">
        <div class="menu-about">
          <h2 class="menu-about-heading">Built at the bar, because you don't have to go home but you can't stay there.</h2>
          <p class="menu-about-body">Someone had the bright idea to build a bar game instead of just playing one. That someone was me, and the bar was very much open. <strong>Tensies</strong> is what came out of it: ten dice, one target number, everyone racing to lock all ten first. It runs in your browser, takes forty seconds to explain, and has absolutely no business being as competitive as it gets. Works best with real people in the same room — which, if you're reading this, hopefully describes the situation.</p>
          <button type="button" class="menu-whats-new-btn">See What's New</button>
          <a href="https://buymeacoffee.com/radiantnode" target="_blank" rel="noopener noreferrer" class="menu-beer-btn">
            <svg viewBox="0 3 26 26" width="30" height="30" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="7" cy="9.5" r="2.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="7.5" r="3" fill="currentColor" stroke="none"/>
              <circle cx="16.5" cy="9.5" r="2.2" fill="currentColor" stroke="none"/>
              <circle cx="4.5" cy="11" r="1.5" fill="currentColor" stroke="none"/>
              <path d="M4 11h14l-2 16H6L4 11z" fill="none" stroke-width="2"/>
              <path d="M18 15h1a2.5 4.5 0 0 1 0 9H18" fill="none" stroke-width="2"/>
            </svg>
            Buy me a beer
          </a>
          <div class="menu-divider"></div>
          <button type="button" class="btn btn-secondary menu-auth-btn"></button>
        </div>
      </nav>
      <div class="menu-changelog-panel">
        <div class="menu-changelog-header">
          <h2 class="menu-changelog-heading">See What's New</h2>
          <button type="button" class="menu-changelog-back-btn btn-back">${BACK_BUTTON_HTML}</button>
        </div>
        <div class="menu-changelog-body">${CHANGELOG}</div>
      </div>`;

    this.#body = /** @type {HTMLElement} */ (this.querySelector('.menu-changelog-body'));
    this.#body.addEventListener('scroll', () => this.#updateFades(), { passive: true });

    document.addEventListener('menu-toggle', this.#onMenuToggle);
    document.addEventListener('keydown', this.#onKeydown);

    this._updateAuthButton();
    /** @type {HTMLElement} */ (this.querySelector('.menu-auth-btn'))
      .addEventListener('click', () => {
        if (isSignedIn()) {
          signOut();
          this._updateAuthButton();
          // Remove header username badges from all app-headers
          document.querySelectorAll('.header-username').forEach((el) => el.remove());
          // Refresh landing screen auth state if it exists
          const landing = /** @type {any} */ (document.getElementById('landing'));
          if (landing?.refreshAuth) landing.refreshAuth();
          this.close();
        } else {
          this.close();
          showSignin();
        }
      });
    /** @type {HTMLElement} */ (this.querySelector('.menu-whats-new-btn'))
      .addEventListener('click', () => {
        this.classList.add('show-changelog');
        if (this.#body) this.#body.scrollTop = 0;
        requestAnimationFrame(() => this.#updateFades());
      });
    /** @type {HTMLElement} */ (this.querySelector('.menu-changelog-back-btn'))
      .addEventListener('click', () => {
        this.classList.remove('show-changelog');
      });

    this.#mountInstallEntry();
  }

  /**
   * Add the "Add to Home Screen" entry — only when an install flow applies
   * (mobile, not already installed). Stays out of the DOM otherwise, so the
   * desktop pixel baseline of the menu is untouched.
   */
  #mountInstallEntry() {
    if (!getPlatform()) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-whats-new-btn menu-a2hs-btn';
    btn.innerHTML = `${A2HS_ICON}Add to Home Screen`;
    btn.addEventListener('click', () => {
      this.close();
      openGuide();
    });
    const divider = this.querySelector('.menu-about .menu-divider');
    divider?.parentElement?.insertBefore(btn, divider);
  }

  disconnectedCallback() {
    document.removeEventListener('menu-toggle', this.#onMenuToggle);
    document.removeEventListener('keydown', this.#onKeydown);
  }

  /** Whether the menu is currently open. */
  isOpen() {
    return this.classList.contains('open');
  }

  /** Open if closed, close if open. */
  toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  /** Slide the menu in and reflect the open state on body + hamburgers. */
  open() {
    this.classList.add('open');
    this.setAttribute('aria-hidden', 'false');
    document.body.classList.add('nav-menu-open');
    this._updateAuthButton();
    this.#syncButtons(true);
  }

  /** Slide the menu out (and leave the changelog panel). */
  close() {
    this.classList.remove('open', 'show-changelog');
    this.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nav-menu-open');
    this.#syncButtons(false);
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

  /** Update the auth button label based on sign-in state. */
  _updateAuthButton() {
    const btn = /** @type {HTMLElement | null} */ (this.querySelector('.menu-auth-btn'));
    if (!btn) return;
    const user = getAuthUser();
    btn.textContent = user ? 'Sign out' : 'Sign in or Sign up';
  }

  #updateFades() {
    if (this.#body) updateScrollFades(this.#body);
  }
}

customElements.define('nav-menu', NavMenu);
