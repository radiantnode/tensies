// <nav-menu> — the slide-down menu (about + "What's New" changelog) reachable
// from the hamburger on landing/join/lobby. Light DOM; the host IS #nav-menu so
// menu.css and the body:has(#nav-menu.open) selectors apply. Toggled by the
// bubbling `menu-toggle` event from <app-header>. The changelog body is baked
// HTML (the changelog skill regenerates it).
import { updateScrollFades } from '../util.js';
import { backButtonHTML } from '../title-row.js';
const CHANGELOG = `<p>Pull up a stool. Newest stuff up top.</p>
<h2>1.6.0 ("High Roller")</h2>
<p>Sunday, May 31, 2026</p>
<ul>
<li>The whole app got a warm makeover. Wood, leather, amber light from the landing screen to the game board.</li>
<li>Fixed the round targets going backwards. The game always started at 1 and counted up. It just... wasn't doing that.</li>
<li>Joined players have their own "Fellow Bar Rats" section in the lobby.</li>
<li>The player list scrolls, and Start Game stays pinned at the bottom. No more hunting for it.</li>
<li>The Back button became a leather pill chip. It was basically invisible before.</li>
<li>Dice look more realistic now, lit to match the bar background.</li>
<li>Win a round and the dice fly toward you in 3D, hover and glow, your name comes up in warm gold, and a timer counts down to the next round. 🎲</li>
<li>Lose one and two cracked dice show up. Hard to miss.</li>
<li>Added a menu to the landing, join, and lobby screens with a quick about blurb, a Beer link, and a "See What's New" panel.</li>
<li>The Send Message invite button got a solid icon.</li>
<li><em>Behind the scenes: we swapped in a self-hosted font so everything looks consistent no matter whose phone you're on.</em></li>
</ul>
<h2>1.5.0 ("Last Call")</h2>
<p>Friday, May 30, 2026</p>
<ul>
<li>The host can pause now. Bar run, bathroom break, whoever's buying the next one. ⏸️</li>
<li>Nobody gets dropped while the game's paused. Come back whenever.</li>
<li>The game holds for up to an hour, so a dead phone won't end the night.</li>
<li>Reconnecting requires a token now. Your seat is yours, not whoever wanders back first.</li>
<li><em>Behind the scenes: better dashboards help us see how each game plays out, so things keep getting fairer.</em></li>
</ul>
<h2>1.4.0 ("Happy Hour")</h2>
<p>Thursday, May 29, 2026</p>
<ul>
<li>The in-game menu is live. Tap the hamburger to get to game options. 🍔</li>
<li>Reconnect window doubled to a full minute. The game waits for you.</li>
<li>Screen transitions got a bit smoother.</li>
<li><em>Behind the scenes: we stress-tested multiplayer with a crowd and fixed what broke.</em></li>
</ul>
<h2>1.3.0 ("On the Rocks")</h2>
<p>Wednesday, May 28, 2026</p>
<ul>
<li>Your dice remember where they landed. Refresh or reconnect and they're right there. 🎲</li>
<li>The loading screen is one smooth experience now, not a pile of overlapping dialogs.</li>
<li>Twice as many random name options when you join.</li>
<li>Fixed the winner overlay getting stuck when a late roll sneaked in during the celebration.</li>
<li>Fixed error messages showing up on the wrong screen.</li>
<li><em>Behind the scenes: we rebuilt the codebase structure and started tracking every roll. Games should get more reliable from here.</em></li>
</ul>
<h2>1.2.0 ("Hold My Drink")</h2>
<p>Tuesday, May 27, 2026</p>
<ul>
<li>Lose your connection? You've got 30 seconds to come back. You'll land on a reconnecting screen and pick up right where you left off.</li>
<li>The game link shows a real preview when you share it now.</li>
<li>Fixed a freeze when your re-roll landed on the exact same numbers as before. Spooky little bug. 👻</li>
<li>Fixed dice tearing mid-animation.</li>
<li>Fixed join errors showing up on the wrong screen.</li>
<li>The header got a dice mark, the text warmed up, and progress bars animate live now.</li>
</ul>
<h2>1.1.0 ("House Rules")</h2>
<p>Monday, May 26, 2026</p>
<ul>
<li>Tensies has its own logo and favicon now. A red die, obviously. 🎲</li>
<li>Rolls are decided by the server, not your phone. No hardware advantage.</li>
</ul>
<h2>1.0.0 ("Opening Tab")</h2>
<p>Sunday, May 25, 2026</p>
<ul>
<li>A bar regular and his friends love playing Tensies. One night, a few rounds deep, he figured the game should work anywhere, even when you forget the dice. So he started building it with Claude, sketched the board himself, and has been tinkering from his barstool ever since. 🍺</li>
<li>The dice gather up, shake, and scatter with a smooth face reveal.</li>
<li>Your opponent's progress bar is right there in front of you. The trash talk writes itself.</li>
<li>Invite friends by link or text. One tap and they're in.</li>
<li>Works on iOS. No accidental zoom, no scroll hijack.</li>
<li>Warm wood background, up to five players.</li>
<li><em>Behind the scenes: the git history starts here because he forgot to run git init until the game already worked.</em></li>
</ul>`;

class NavMenu extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.id = 'nav-menu';
    this.className = 'game-menu';
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
        </div>
      </nav>
      <div class="menu-changelog-panel">
        <div class="menu-changelog-header">
          <h2 class="menu-changelog-heading">See What's New</h2>
          <button type="button" class="menu-changelog-back-btn btn-back">${backButtonHTML}</button>
        </div>
        <div class="menu-changelog-body">${CHANGELOG}</div>
      </div>`;

    this._body = this.querySelector('.menu-changelog-body');
    this._body.addEventListener('scroll', () => this.updateFades(), { passive: true });

    this._onMenuToggle = () => this.toggle();
    this._onKeydown = (e) => { if (e.key === 'Escape' && this.menuOpen()) this.close(); };
    document.addEventListener('menu-toggle', this._onMenuToggle);
    document.addEventListener('keydown', this._onKeydown);

    this.querySelector('.menu-whats-new-btn').addEventListener('click', () => {
      this.classList.add('show-changelog');
      this._body.scrollTop = 0;
      requestAnimationFrame(() => this.updateFades());
    });
    this.querySelector('.menu-changelog-back-btn').addEventListener('click', () => {
      this.classList.remove('show-changelog');
    });
  }

  disconnectedCallback() {
    document.removeEventListener('menu-toggle', this._onMenuToggle);
    document.removeEventListener('keydown', this._onKeydown);
  }

  menuOpen() { return this.classList.contains('open'); }

  toggle() { this.menuOpen() ? this.close() : this.open(); }

  open() {
    this.classList.add('open');
    this.setAttribute('aria-hidden', 'false');
    this.syncButtons(true);
  }

  close() {
    this.classList.remove('open', 'show-changelog');
    this.setAttribute('aria-hidden', 'true');
    this.syncButtons(false);
  }

  // Reflect open state on whichever pre-game hamburger triggered it.
  syncButtons(open) {
    document.querySelectorAll('.app-header .game-menu-btn').forEach((b) => {
      b.classList.toggle('open', open);
      b.setAttribute('aria-expanded', String(open));
      b.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  updateFades() { updateScrollFades(this._body); }
}
customElements.define('nav-menu', NavMenu);
