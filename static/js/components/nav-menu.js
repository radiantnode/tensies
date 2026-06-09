// <nav-menu> — the slide-down menu (about + "What's New" changelog) reachable
// from the hamburger on landing/join/lobby. Light DOM; the host IS #nav-menu so
// menu.css and the body:has(#nav-menu.open) selectors apply. Toggled by the
// bubbling `menu-toggle` event from <app-header>. The changelog body is baked
// HTML (the changelog skill regenerates it).
import { updateScrollFades } from '../util.js';
import { backButtonHTML } from '../title-row.js';
const CHANGELOG = `<p>Pull up a stool. Newest stuff up top.</p>
<h2>1.9.0 ("Speed Round")</h2>
<p>Sunday, June 8, 2026</p>
<ul>
<li>The game loads faster now. Everything gets bundled down and compressed before it hits your phone, so the wait before the first round is shorter. 🚀</li>
<li>The bar background photo got slimmed down too, converted to a format that cuts the file size without changing how it looks.</li>
<li>Your winner overlay pops up the moment your last die settles now, not a beat after.</li>
<li><em>Behind the scenes: every file gets fingerprinted and cached forever, so once you've loaded the game once, coming back is near-instant.</em></li>
</ul>
<h2>1.8.0 ("Savor the Win")</h2>
<p>Saturday, June 7, 2026</p>
<ul>
<li>Fixed a maddening one. Every so often your win screen would blink and vanish while everyone else's stuck around just fine. Now your victory lap holds the full three seconds, like it should. 🎲</li>
<li>You can now join a game by going straight to the code link. Clean URL, no extra text at the end.</li>
<li>Locked the doors a little tighter, so the game behaves on real networks and only the right people can wander into the back room.</li>
<li><em>Behind the scenes: the frontend got rebuilt from the ground up using proper components. Same game, cleaner bones.</em></li>
</ul>
<h2>1.7.0 ("Open Bar")</h2>
<p>Sunday, June 1, 2026</p>
<ul>
<li>The game can spread across a whole row of servers now. A big crowd can pile in and nobody gets bumped at the door. Bring the whole bar. 🍻</li>
<li>Any server can pick up any game, so if one hiccups, your round just keeps rolling.</li>
<li>Built this whole "bring the whole bar" upgrade from a beach chair in Cap Cana, Dominican Republic, ducking back to the pool between edits.</li>
<li><em>Behind the scenes: moved every game onto a shared brain so matches stay fast and fair no matter how many people show up.</em></li>
</ul>
<h2>1.6.0 ("High Roller")</h2>
<p>Sunday, May 31, 2026</p>
<ul>
<li>Gave the whole place a warm new look. The landing, the lobby, the board, all redone to feel like your favorite dim-lit watering hole.</li>
<li>The winner screen got redone properly. A 3D die flies in at you, your name comes up in gold, and a countdown ticks to the next round.</li>
<li>Lose the round? You get your own screen now too, complete with dramatically shattered dice. 💔</li>
<li>The target counts up now: 1, 2, 3, 4, 5, 6, then back around.</li>
<li>Added a menu with a "See What's New" panel, so you can read these very notes without leaving the game.</li>
</ul>
<h2>1.5.0 ("Last Call")</h2>
<p>Friday, May 30, 2026</p>
<ul>
<li>Whoever's hosting can pause the game. Perfect for a bar run, a bathroom break, or sorting out who's buying the next round. ⏸️</li>
<li>Paused games hang on for up to an hour, so a phone going dark mid-round won't end the night.</li>
<li>If the host wanders off, someone still in their seat quietly takes over instead of the game freezing up.</li>
<li>Reconnecting now uses a secure token so the server knows it's actually you coming back.</li>
<li><em>Behind the scenes: built a backstage view of every game so we can keep matches fair and catch trouble early.</em></li>
</ul>
<h2>1.4.0 ("Happy Hour")</h2>
<p>Thursday, May 29, 2026</p>
<ul>
<li>Added the start of an in-game menu, the little hamburger button that opens up your options.</li>
<li>Reconnect window doubled: you now have a full minute to get back before the game drops you. 🔌</li>
<li><em>Behind the scenes: built a stress-test rig that crams in hundreds of pretend players, so the real ones never end up waiting.</em></li>
</ul>
<h2>1.3.0 ("On the Rocks")</h2>
<p>Wednesday, May 28, 2026</p>
<ul>
<li>Your dice stay put exactly where they landed, even if you refresh or your phone dozes off. 🎲</li>
<li>Connecting feels smoother. One clean loading screen instead of jarring pop-ups when you join or come back.</li>
<li>Random names get dreamed up right on your phone now, with a lot more goofy combos to go around.</li>
<li>Squashed a winner screen that sometimes overstayed its welcome.</li>
<li><em>Behind the scenes: reorganized the guts of the game so new stuff lands faster and breaks less.</em></li>
</ul>
<h2>1.2.0 ("Hold My Drink")</h2>
<p>Tuesday, May 27, 2026</p>
<ul>
<li>Drop off and come right back. Lose your signal and you get a grace period to slide back into your seat.</li>
<li>Fixed a sneaky freeze when your re-roll landed on the exact same numbers. Spooky, but no longer sticky. 👻</li>
<li>Nobody sees your dice change until your roll animation finishes, so there's no peeking early.</li>
<li>Cleaned up dice that could tear or smear in the middle of a roll.</li>
</ul>
<h2>1.1.0 ("House Rules")</h2>
<p>Monday, May 26, 2026</p>
<ul>
<li>Tensies got its own dice logo and favicon, so the browser tab finally looks the part. 🎲</li>
<li>Moved the dice rolls over to the server, so everyone's looking at the same honest roll.</li>
</ul>
<h2>1.0.0 ("Opening Tab")</h2>
<p>Sunday, May 25, 2026</p>
<ul>
<li>A bar regular and his friends love playing Tensies, the dice game. One night, a few heated rounds in and drinks down, he figured it'd be great to play anywhere, even on the nights you forget to bring the dice. So he started building it with Claude, sketched the very first board himself, and kept tinkering from his barstool between rounds. 🍺</li>
<li>Share a link or fire off a quick text to get your friends in the game.</li>
<li>The dice have real rolling physics. They gather, shake, scatter across the wood, and settle.</li>
<li>Matched dice stay locked. Only the leftovers re-roll, just like the real thing.</li>
<li><em>Behind the scenes: the only reason this whole version is one giant first commit is that he forgot to start tracking the code until the game already worked.</em></li>
</ul>
<div class="menu-changelog-footer">
  <p class="menu-changelog-footer-lead">Still scrolling? Either you're into the nerdy bits or just doomscrolling between rounds.</p>
  <p>Tensies got built at the bar, and it stays open like one — anybody can wander in. The code's all there if you want to see how it works or check that the rolls are fair. We tested it the way we play it: friends crowded around one bar, or thousands of miles apart, everybody rolling at once and having a blast.</p>
  <a class="menu-changelog-ghlink" href="https://github.com/radiantnode/tensies" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
    View on GitHub
  </a>
</div>`;

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

    this._onMenuToggle = () => {
      if (document.querySelector('#game.active')) return;
      this.toggle();
    };
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

  syncButtons(open) {
    document.querySelector('app-header')?.setOpen(open);
  }

  updateFades() { updateScrollFades(this._body); }
}
customElements.define('nav-menu', NavMenu);
