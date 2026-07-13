// @ts-check
import { isSignedIn, getAuthUser, signOut } from '../auth.js';
import { getPlatform, openGuide } from '../a2hs.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { makeMenuToggle } from '../menu-toggle.js';
import { showSignin } from '../router.js';
import { updateScrollFades } from '../scroll-fades.js';

// Phone-with-plus glyph for the "Add to Home Screen" entry.
const A2HS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7.5v5M9.5 10h5"/></svg>`;

// Baked changelog HTML — content, not code; the changelog skill regenerates it.
const CHANGELOG = `<p>Pull up a stool. Newest stuff up top.</p>
<h2>1.28.0 ("House Regular")</h2>
<p>Friday, July 10, 2026</p>
<ul>
<li>Check in at your spot and your game stamp earns a badge for it, a little "Checked In" mark with the place's name stamped right on. Everyone in the game sees it, host or not. 🍺</li>
<li>Tried to hop back into a game that already wrapped? No more scary "Connection failed." It just says the game's gone and sends you home.</li>
<li>The roll button quit throwing that annoying iOS text-select menu every time you mashed it mid-round.</li>
<li><em>Behind the scenes: we pulled in the latest updates for the parts under the hood, so the app stays quick and secure.</em></li>
</ul>
<h2>1.27.0 ("New Digs")</h2>
<p>Thursday, July 9, 2026</p>
<ul>
<li>We gave the landing a proper makeover. New layout down low where your thumb lives, a greeting that knows whether it's morning or last call, and headings in a classier serif.</li>
<li>Joining a game pops up as a little slide-up sheet now instead of a whole new screen. The Join button even shuffles a fake code just for the fun of it. 🎲</li>
<li>The Nearby Games radar reads cleaner: a nicer compass button, and the sweep glides in smooth instead of stuttering on the way up.</li>
<li>Menus ease in now, and hammering the menu button won't break it anymore.</li>
<li><em>Behind the scenes: we combed every screen pixel by pixel and swatted a sneaky randomness bug, so the dice always scatter fair.</em></li>
</ul>
<h2>1.26.0 ("Gold Leaf")</h2>
<p>Wednesday, July 8, 2026</p>
<ul>
<li>The Tensies name up top went gold, the dice got a little bigger, and the main buttons picked up the same gold with a brushed-metal sheen. ✨</li>
<li><em>Behind the scenes: we're paying closer attention to where games get played, so Nearby keeps getting sharper about the crowd.</em></li>
</ul>
<h2>1.25.0 ("Hand Stamp")</h2>
<p>Tuesday, July 7, 2026</p>
<ul>
<li>Your game code sits in the lobby as an old-timey stamp now. Tap it and it blows up huge, so someone across the bar can scan it and hop in.</li>
<li>Checking in to a spot got smoother. Search for a place, glance at its photo, and the sheet tucks up neat above your keyboard.</li>
<li>Nearby is one clean flow now: pick your spot, and you're on the map. 📍</li>
</ul>
<h2>1.24.0 ("Bar Crawl")</h2>
<p>Monday, July 6, 2026</p>
<ul>
<li>You can find games happening right around you now. A radar plots them by direction and distance, with a compass that spins as you turn. 📡</li>
<li>Hosts can check a game in to a real place, your bar say, so friends nearby can spot it and wander over.</li>
<li>Every blip wears the host's face, and a tap drops you straight into their game.</li>
<li><em>Behind the scenes: your exact spot never leaves your phone. Friends only ever see rough distance and direction.</em></li>
</ul>
<h2>1.23.0 ("Regular's Tab")</h2>
<p>Sunday, July 5, 2026</p>
<ul>
<li>We had Claude's new Fable 5 model walk the whole bar with a clipboard, and fixed everything it wrote up. The review came back: "I would drink at this bar." <a href="https://github.com/radiantnode/tensies/blob/main/docs/fable5-review/README.md" target="_blank" rel="noopener noreferrer">Read the review yourself</a>. ⭐</li>
<li>The sign-in button pulls double duty now: same button whether you're making a new account or getting back into an old one. Type your name and go.</li>
<li>Your username isn't picky about capitals anymore. "MikeD" and "miked" get you the same seat.</li>
<li>If you were here early, your profile wears a "Founding Roller" badge. You were rolling before it was cool. 😎</li>
<li>The scoreboard up top got a cleaner coat of frost, and the little progress bars slide up instead of snapping.</li>
</ul>
<h2>1.22.1 ("House Cleaning")</h2>
<p>Saturday, July 4, 2026</p>
<ul>
<li>Fresh code reaches your phone faster now, so you're never stuck on a stale version between rounds. ⚡</li>
<li><em>Behind the scenes: swept out a pile of unused styling and old art so the app stays light and quick to load.</em></li>
</ul>
<h2>1.22.0 ("Loaded Dice")</h2>
<p>Friday, July 3, 2026</p>
<ul>
<li>The loading screen got a fun little tumbling-dice animation while you wait, and it tells you whether you're creating or joining. 🎲</li>
<li>The lobby list breathes now: players slide in and out as folks come and go instead of just popping.</li>
<li>Smoother trips in and out of profiles and past-game pages, no jarring jumps.</li>
<li>The Add-to-Home-Screen guide sits dead center and matches the rest of the app.</li>
</ul>
<h2>1.21.0 ("Bar Tab")</h2>
<p>Thursday, July 2, 2026</p>
<ul>
<li>Changed your mind in the lobby? There's a Back button now, and leaving drops you right away so everyone else sees the roster update instantly. 🚪</li>
<li>The lobby shows your account picture next to your name, and the title tells you if you're hosting or joining.</li>
<li>Rolling solo? A little hint nudges you to invite friends or just play on your own.</li>
</ul>
<h2>1.20.1 ("One More Round")</h2>
<p>Wednesday, July 1, 2026</p>
<ul>
<li>Fixed the intro video refusing to play again on your second game of the night. Encore granted. 🎬</li>
<li>The menu tidies itself away when a game ends, and the background stops jumping around during the intro.</li>
</ul>
<h2>1.20.0 ("Opening Credits")</h2>
<p>Tuesday, June 30, 2026</p>
<ul>
<li>Games now kick off with a short video intro, and there's moving video behind the landing screen too. A little showtime before the dice fly. 🎬</li>
</ul>
<h2>1.19.0 ("Fresh Coat")</h2>
<p>Wednesday, June 24, 2026</p>
<ul>
<li>The Roll button is now a big round floating button that's way easier to thumb mid-round, with a glowing pulse while you wait your turn. 👆</li>
<li>New app icons across the board, so Tensies looks sharp on your home screen.</li>
<li><em>Behind the scenes: tidied up the styling so things stay snappy and consistent.</em></li>
</ul>
<h2>1.18.0 ("Word of Mouth")</h2>
<p>Tuesday, June 23, 2026</p>
<ul>
<li>Share a Tensies link and it now shows a proper preview with the right icon, so your invite looks good in the group chat. 🔗</li>
<li>Fixed the icon that showed up when you shared to the iOS share sheet.</li>
</ul>
<h2>1.17.1 ("Nightcap")</h2>
<p>Monday, June 22, 2026</p>
<ul>
<li><em>Behind the scenes: routine housekeeping to keep the plumbing current and safe.</em></li>
</ul>
<h2>1.17.0 ("Take It Home")</h2>
<p>Sunday, June 21, 2026</p>
<ul>
<li>Added a friendly walkthrough that shows you exactly how to add Tensies to your phone's home screen, so it launches like a real app. 📱</li>
</ul>
<h2>1.16.1 ("Last Orders")</h2>
<p>Saturday, June 20, 2026</p>
<ul>
<li>Rounded up a batch of small security and dependency updates, plus a fix so your profile's recent games line up in the right order. 🔒</li>
<li><em>Behind the scenes: added a security policy and automated checks so problems get caught before they reach you.</em></li>
</ul>
<h2>1.16.0 ("Round the Room")</h2>
<p>Friday, June 19, 2026</p>
<ul>
<li>When a game wraps, you get whisked straight to that game's page with the final scoreboard.</li>
<li>Optional Discord notifications can now announce your games, and there's a Discord command to double-check any roll was fair. 🔌</li>
</ul>
<h2>1.15.0 ("Provably Fair Pour")</h2>
<p>Thursday, June 18, 2026</p>
<ul>
<li>Every roll can now be proven fair. Tensies pulls its randomness from a public, tamper-proof beacon, and each finished game has a page where anyone can check the dice were legit. 🔐</li>
<li>Profiles gained a bio and a location, so the crew knows who's who.</li>
</ul>
<h2>1.14.0 ("Calling It")</h2>
<p>Wednesday, June 17, 2026</p>
<ul>
<li>Hosts can now End Game whenever they want, and everyone gets a clean final scoreboard with pictures and win counts. Perfect for when the food shows up. 🍔</li>
</ul>
<h2>1.13.1 ("Booth Talk")</h2>
<p>Tuesday, June 16, 2026</p>
<ul>
<li><em>Behind the scenes: gathered outside feedback and worked through it so the game keeps getting sharper.</em></li>
</ul>
<h2>1.13.0 ("Name on the Door")</h2>
<p>Monday, June 15, 2026</p>
<ul>
<li>You've got a real profile now, living at your own /@username, with your stats and a photo.</li>
<li>Your win counts and history carry over onto your account, so your bragging rights are official. 🏆</li>
</ul>
<h2>1.12.0 ("Signed In")</h2>
<p>Sunday, June 14, 2026</p>
<ul>
<li>Once you're signed in, Tensies remembers you: your name shows up in the header and the sign-in bits get out of your way. 👋</li>
<li>Nicer fit on iPhones, with the app filling the whole screen instead of leaving awkward gaps at the bottom.</li>
</ul>
<h2>1.11.0 ("Karaoke Night")</h2>
<p>Saturday, June 13, 2026</p>
<ul>
<li>Forgot the game code and don't feel like typing? One phone can chirp the code out loud and another can listen and grab it. Yes, really. 🔊</li>
<li>The landing dice give a playful little wiggle, buttons got a subtle shine, and the lobby shows who's you and who's hosting at a glance.</li>
</ul>
<h2>1.10.0 ("Pocket Pour")</h2>
<p>Friday, June 12, 2026</p>
<ul>
<li>You can install Tensies to your home screen now and it opens like a real app, full screen, no browser bars. 📲</li>
<li>Sharing an invite got easier with your phone's built-in share sheet.</li>
</ul>
<h2>1.9.2 ("Steady Hands")</h2>
<p>Thursday, June 11, 2026</p>
<ul>
<li>Squashed a few gremlins: the winner screen no longer flickers away too soon, the dice land in place before the board shows up, and 3-D dice stopped looking flat on iPhones. 🐛</li>
<li>The loading screen now waits for the dice to be ready, then melts away smoothly.</li>
</ul>
<h2>1.9.1 ("Tuning Fork")</h2>
<p>Wednesday, June 10, 2026</p>
<ul>
<li><em>Behind the scenes: rebuilt the app's insides from a clean slate so new stuff is easier to add without changing a thing you see or feel.</em></li>
</ul>
<h2>1.9.0 ("Instant Replay")</h2>
<p>Monday, June 8, 2026</p>
<ul>
<li>The winner screen pops up the moment the winning dice land, no more waiting around for it. 🏆</li>
<li><em>Behind the scenes: your phone downloads less and loads faster now, thanks to leaner packed-up files and a lighter background image.</em></li>
</ul>
<h2>1.8.0 ("Clean Pour")</h2>
<p>Sunday, June 7, 2026</p>
<ul>
<li>Invite links are prettier and simpler now (just /yourcode), so they're easy to read out or paste.</li>
<li>Fixed the winner screen vanishing when someone else's roll landed at the same moment. ⏸️</li>
<li><em>Behind the scenes: tightened up security so the app stays safe out on the open web.</em></li>
</ul>
<h2>1.7.0 ("Round on the House")</h2>
<p>Monday, June 1, 2026</p>
<ul>
<li><em>Behind the scenes: rebuilt the engine so loads of games can run at once, anywhere, and stay fast even with a full house. Boring to build, but you feel it on a busy night.</em></li>
</ul>
<h2>1.6.0 ("Top Shelf")</h2>
<p>Sunday, May 31, 2026</p>
<ul>
<li>Big visual glow-up: a warm, cozy bar look across the landing, lobby, and board, with dice that actually look lit by the room.</li>
<li>The winner screen got the star treatment, dice flying in toward you and the winner's name in gold. Lose a round and your dice crack in half. Ouch. 💔</li>
<li>Menus tucked into a tidy nav so About and What's New are a tap away.</li>
</ul>
<h2>1.5.0 ("Last Call")</h2>
<p>Saturday, May 30, 2026</p>
<ul>
<li>Whoever's hosting can pause the game now. Great for a bar run, a bathroom break, or sorting out who's buying the next round. ⏸️</li>
<li>Paused games hang on for up to an hour, so your phone taking a nap won't end the night. And if the host wanders off, someone else picks up the reins.</li>
<li>Slip back into your seat cleanly if you drop, right where you left off.</li>
</ul>
<h2>1.4.0 ("Happy Hour")</h2>
<p>Friday, May 29, 2026</p>
<ul>
<li>Tapped a hamburger menu into the game so more controls have a home. 🕹️</li>
<li><em>Behind the scenes: built the tools to watch games live and keep everything running smooth and fair.</em></li>
</ul>
<h2>1.3.0 ("On the Rocks")</h2>
<p>Thursday, May 28, 2026</p>
<ul>
<li>Your scattered dice stay exactly where they were, even after a refresh or your phone dozing off. 🎲</li>
<li>A smooth single loading screen replaced the old jumble of disconnect and reconnect popups.</li>
<li>Fixed the winner screen hanging around longer than it should.</li>
</ul>
<h2>1.2.0 ("Plugged In")</h2>
<p>Wednesday, May 27, 2026</p>
<ul>
<li>Lost your connection mid-game? You'll slide right back in where you left off. 🔌</li>
<li>Share links look good now, with a proper preview card when you drop one in a chat.</li>
<li>Fixed a sneaky freeze when your re-roll landed on the exact same numbers. Spooky, but no longer sticky.</li>
</ul>
<h2>1.1.0 ("Making a Mark")</h2>
<p>Tuesday, May 26, 2026</p>
<ul>
<li>Tensies got its own dice logo and favicon, so it's easy to spot. 🎲</li>
<li>Rolls are called by the server now, keeping everyone's dice honest and in sync.</li>
</ul>
<h2>1.0.0 ("Opening Tab")</h2>
<p>Monday, May 25, 2026</p>
<ul>
<li>A bar regular and his friends love playing Tensies, the dice game. One night, a few heated rounds deep and drinks in, he figured it'd be great to play anywhere, even when nobody remembered to bring the dice. So he started having Claude build the game, sketched the very first board himself on the spot, and kept tinkering from his barstool between rounds.</li>
<li>Roll ten dice, match the target number, keep the ones that hit, and re-roll the rest until all ten land. First to lock all ten takes the round.</li>
<li>Play with your whole crew in real time, watch each other's progress live, and invite friends with a tap or a text. 🍺</li>
<li><em>Behind the scenes: the git history only starts here because he forgot to run git init until the game already worked. Whoops.</em></li>
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
          <h2 class="screen-title menu-about-heading">Built at the bar because you don't have to go home but you can't stay there.</h2>
          <p class="menu-about-body">My name's Michael. Over 20 years of making computers do things for businesses, people, and fun, and <strong>Tensies</strong> is squarely in the fun column. I wanted to build something cool while I picked up a few new tricks and passed along what I learned (usually by breaking it first). The real game gets played at the bar, with real dice, the good heavy kind. This is the version for when you forget yours, or the bar closes and reminds you that you do, in fact, have a home to go to: ten dice each, one target number, everybody rolling at once and racing to lock all ten first.</p>
          <p class="menu-about-body">For a bar game, it's wildly over-engineered, in the best way. I built it to be secure and to hold up under anything, using the same industry standards I'd trust for serious work. I work on it in my spare time, a little at home, a little at the bar, a little in Cap Cana with a drink in reach. The code's all out in the open, if you want to see how it works. Pull up a stool.</p>
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
          <button type="button" class="menu-changelog-back-btn btn-back">${BACK_BUTTON_HTML}</button>
          <h2 class="screen-title has-back">What's New on Tensies</h2>
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
