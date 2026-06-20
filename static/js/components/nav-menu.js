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
<h2>1.15.0 ("Last Call")</h2>
<p>Wednesday, June 17, 2026</p>
<ul>
<li>The host can end the game from the menu. First tap says "Tap to confirm," second tap sends everyone home.</li>
<li>When a game ends, everyone lands on the game's detail page — player stats, round wins, and roll verification all in one place.</li>
<li>Profile recent games got some polish. Better spacing, cleaner score glow.</li>
</ul>
<h2>1.14.1 ("Coaster Notes")</h2>
<p>Tuesday, June 16, 2026</p>
<ul>
<li><em>Behind the scenes: collected outside feedback and updated the status tracker. Nothing player-facing, just listening.</em></li>
</ul>
<h2>1.14.0 ("The Regulars")</h2>
<p>Monday, June 15, 2026</p>
<ul>
<li>Your profile page is live at /@username. Lifetime stats, recent games, win rate, best time.</li>
<li>Recent games show who you played, who won, and how fast. Stacked avatars, gold glow on the winner. Solo games don't show up.</li>
<li>A gradient shimmer runs across the stat cards when the profile first loads. Once, then it's done. ✨</li>
<li>The username pill in the header links straight to your profile from the landing and lobby.</li>
<li>Fixed a bug where total_games was stuck at zero. Backfilled from actual game history.</li>
<li><em>Behind the scenes: data-repair scripts and prod config fixes keep the numbers honest.</em></li>
</ul>
<h2>1.13.0 ("Wristband Night")</h2>
<p>Sunday, June 14, 2026</p>
<ul>
<li>Signed-in players see their username pill next to the hamburger on every screen, in-game included.</li>
<li>The changelog scrolls as one page now, same as the menu panel.</li>
<li>iOS standalone screens fill edge-to-edge at the bottom, and nothing bleeds through behind the status bar. 📱</li>
<li><em>Behind the scenes: the README got some hero screenshots for GitHub.</em></li>
</ul>
<h2>1.12.0 ("Backstage Pass")</h2>
<p>Saturday, June 13, 2026</p>
<ul>
<li>Passkey sign-up is here. Tap, scan your face or fingerprint, done. Anonymous stats carry over and you get a vanity URL. 🔑</li>
<li>The onboarding screen shows your profile card, vanity link, and stat history. Survives a refresh.</li>
<li>Signed-in players skip the name field on landing. You're already you.</li>
<li>The soundboard shipped as a standalone tool for field-testing audio share. It went out for 6 sessions and 744 tests across beaches, bars, and a pool.</li>
<li>Lobby Share and Play buttons sit side-by-side with more room around Start.</li>
<li>The landing dice logo wiggles when you arrive. Primary buttons picked up a shimmer sweep.</li>
<li>Player list shows both YOU and HOST badges, and you're always sorted to the top.</li>
<li><em>Behind the scenes: pixel baselines updated for the new auth and lobby states, and all the soundboard data is in the repo.</em></li>
</ul>
<h2>1.11.0 ("Jukebox")</h2>
<p>Friday, June 12, 2026</p>
<ul>
<li>Tensies installs to your home screen. Launches standalone, no browser chrome.</li>
<li>The lobby Share button opens AirDrop, Messages, WhatsApp, whatever your phone offers. SMS fallback still works.</li>
<li>Experimental: the lobby "Play" button chirps your game code through the speaker. A friend taps "Listen" on the join screen and their mic picks it up. Works best when it's not too loud. 🔊</li>
<li>Turn your phone sideways and you'll get a nudge to rotate back. Portrait game.</li>
<li><em>Behind the scenes: the audio share got another round of tuning for louder transmission and better error correction.</em></li>
</ul>
<h2>1.10.0 ("Fresh Coat")</h2>
<p>Thursday, June 11, 2026</p>
<ul>
<li>The whole frontend got rebuilt from scratch. Layered CSS, typed JS modules, one concern per file. Every screen was pixel-verified against the original at zero diff. If you spot anything different, that's a bug.</li>
<li>Fixed the winner overlay closing early when an opponent's roll echo snuck in during the celebration.</li>
<li>Dice scatter into place before the board paints, so there's no blank flash.</li>
<li>The loading overlay holds until dice are rendered, then dissolves.</li>
<li>Safari stopped flattening the 3D dice during screen transitions. 🎲</li>
<li><em>Behind the scenes: the rewrite means changes land without quietly breaking something three files away.</em></li>
</ul>
<h2>1.9.2 ("Bar Back")</h2>
<p>Wednesday, June 10, 2026</p>
<ul>
<li><em>Behind the scenes: documentation cleanup, test tooling sharpened, and the groundwork laid for the frontend rebuild that shipped the next day.</em></li>
</ul>
<h2>1.9.1 ("Garnish")</h2>
<p>Monday, June 8, 2026</p>
<ul>
<li>The winner overlay pops right after the scatter reveal. You don't sit there staring at the board anymore.</li>
<li>Prod gets a real asset pipeline. One bundled, minified JS file instead of a dozen loose modules. Faster cold load. ⚡</li>
<li><em>Behind the scenes: nginx handles static files so the app server just runs the game.</em></li>
</ul>
<h2>1.9.0 ("Open Mic")</h2>
<p>Sunday, June 7, 2026</p>
<ul>
<li>Join URLs are shorter: tensies.app/ABCD instead of tensies.app/?join=ABCD. Old links still work.</li>
<li>Fixed the winner overlay flashing away when a broadcast landed mid-reveal. It stays put until the countdown finishes now.</li>
<li>Strict CSP and HSTS on every response. Your browser won't load anything we didn't serve. 🔒</li>
<li>The nav menu stopped flashing on the loading screen.</li>
<li><em>Behind the scenes: abuse limits read the real client IP behind a proxy, and metrics require auth in dev too.</em></li>
</ul>
<h2>1.8.0 ("Vacation Pour")</h2>
<p>Monday, June 1, 2026</p>
<ul>
<li>Game state lives in Redis now. The server can run as multiple instances behind a load balancer, no sticky sessions needed. Your game keeps going if one instance restarts.</li>
<li>A reaper cleans up abandoned games and publishes the active count across instances.</li>
<li>Security pass: Starlette and h11 bumped for CVEs, lockfile pinned, Docker image runs non-root.</li>
<li>The frontend was rebuilt as web components. Each screen is its own element. The loading screen paints before JS even runs. Same design, better wiring. 🔧</li>
<li><em>Behind the scenes: a pixel-regression harness verified every view at zero diff. 25 views, all green.</em></li>
</ul>
<h2>1.7.0 ("Open Bar")</h2>
<p>Sunday, May 31, 2026</p>
<ul>
<li>Everything got warmer. Landing, lobby, join, board, winner, loser. It all feels like the same bar now.</li>
<li>Dice look real. Soft edges, lit from the same direction as the wood underneath.</li>
<li>The winner overlay is something to see. A 3D die flies at you, your name glows in gold, and a countdown bar ticks to the next round.</li>
<li>Losers get a cracked die. Black and broken. 💔</li>
<li>The roll button looks like a leather coaster sitting on the bartop.</li>
<li>Nav menu slides in from the hamburger with an About section and a "What's New" changelog (hi).</li>
<li>Round target goes 1, 2, 3, 4, 5, 6. Ascending, the way you'd count.</li>
<li><em>Behind the scenes: Inter is self-hosted for consistent type across phones, and the scroll fades on the player list took some real CSS.</em></li>
</ul>
<h2>1.6.0 ("Saturday Sipper")</h2>
<p>Saturday, May 30, 2026</p>
<ul>
<li>The host can pause the game. Good for a bar run, a bathroom break, or settling who's buying the next round. ⏸️</li>
<li>Non-host players see a "waiting for host" overlay while paused. The board stays live underneath.</li>
<li>If the host disappears, another connected player gets promoted.</li>
<li>Paused games survive up to an hour. If nobody returns, the game ends on its own.</li>
<li>Reconnect tokens work now. Drop and come back, the server knows it's you.</li>
<li>The pause menu has a countdown, connected-player count, and the resume toggle.</li>
<li><em>Behind the scenes: telemetry dashboards picked up a luck balance chart, per-game event logs, and a luckiest-players leaderboard.</em></li>
</ul>
<h2>1.5.0 ("Back Booth")</h2>
<p>Friday, May 29, 2026</p>
<ul>
<li>Multiplayer got a stress test. A headless driver spins up hundreds of games looking for leaks and race conditions. It found one. Fixed. 🧪</li>
<li>The test harness runs two isolated browser profiles so each player keeps their own identity.</li>
<li><em>Behind the scenes: two SQL bugs in the telemetry pipeline were caught and fixed during the first automated run.</em></li>
</ul>
<h2>1.4.0 ("Double Shot")</h2>
<p>Thursday, May 28, 2026</p>
<ul>
<li>Dice stay put when you refresh or your phone naps. Scatter positions are saved. 🎲</li>
<li>A unified loading screen replaces the old disconnect and reconnect dialogs. 600ms minimum so it doesn't blink in and out.</li>
<li>The winner overlay stopped sticking around when a stray roll queued during the celebration.</li>
<li>Telemetry is running. Rolls, wins, games, all flowing into Postgres and Grafana.</li>
<li>The server, CSS, and JS each got split into proper packages. Same game, cleaner foundation.</li>
<li><em>Behind the scenes: cache-busting covers the full ES module import graph, not just the entry scripts.</em></li>
</ul>
<h2>1.3.0 ("Whiskey Neat")</h2>
<p>Wednesday, May 27, 2026</p>
<ul>
<li>Fixed a freeze when your re-roll landed on the exact same numbers. Rare, but it locked the whole game up.</li>
<li>Other players' dice update in sync with the roller's reveal animation now. You won't see the result before the shake finishes.</li>
<li>If your phone drops the connection, you get 30 seconds to come back. A reconnecting overlay holds your spot. 🔌</li>
<li>The dice logo landed in the game header, overlapping the wordmark.</li>
<li>Warmer in-game text, animated progress bars, bar background shifted to a better focal point.</li>
<li><em>Behind the scenes: join errors route to the right screen now, and a dice-tearing fix freezes the transform before clearing the animation.</em></li>
</ul>
<h2>1.2.0 ("Pint Glass")</h2>
<p>Tuesday, May 26, 2026</p>
<ul>
<li>Dice rolls are server-authoritative. Everyone sees the same result.</li>
<li>The dice logo and favicon give Tensies its own face in the browser tab. 🎲</li>
<li><em>Behind the scenes: the fairness engine is quiet but real.</em></li>
</ul>
<h2>1.1.0 ("First Round")</h2>
<p>Monday, May 25, 2026</p>
<ul>
<li>Invite friends with a tap. Share a link or fire off a text. 📲</li>
<li>Dice physics: gather, shake, scatter, and they never pile on top of each other. Matched dice lock in.</li>
<li>The board looks like a bartop. Warm wood photo, soft shadows, lit from the top left.</li>
<li>Players bar fits five, the join screen is its own page, and random names fill in so nobody has to think.</li>
<li>iOS plays nice. No scroll, no zoom, fast taps still register.</li>
<li><em>Behind the scenes: animations run on the GPU, placement uses a jittered grid, and static assets get cache-busted on deploy.</em></li>
</ul>
<h2>1.0.0 ("Opening Tab")</h2>
<p>Monday, May 25, 2026</p>
<ul>
<li>A bar regular and his friends love playing Tensies, the dice game. One night, a few rounds deep and drinks in, he thought it'd be great to play anywhere, even when you forget the dice. So he started having Claude build the game, sketched the first board himself, and kept tinkering from his barstool between rounds.</li>
<li>Ten dice, one target number, fastest to lock all ten wins. Simple rules, good trash talk.</li>
<li>Multiplayer over WebSockets. Create a game, share the code, roll against your friends live.</li>
<li>Your opponent sits up top, your dice down below, right where your thumbs are. 🍺</li>
<li><em>Behind the scenes: the git history starts here because he forgot to git init until the game already worked.</em></li>
</ul>
<div class="menu-changelog-footer">
  <p class="menu-changelog-footer-lead">Still scrolling? Either you're into the nerdy bits or just doomscrolling between rounds.</p>
  <p>Tensies got built at the bar, and it stays open like one — anybody can wander in. The code's all there if you want to see how it works or check that the rolls are fair. We tested it the way we play it: friends crowded around one bar, or thousands of miles apart, everybody rolling at once and having a blast.</p>
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
