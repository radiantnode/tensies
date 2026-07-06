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
<h2>1.23.0 ("Five Stars")</h2>
<p>Sunday, July 5, 2026</p>
<ul>
<li>We had Claude's new Fable 5 model walk the whole bar with a clipboard, and fixed everything it wrote up. The review came back: "I would drink at this bar." <a href="https://github.com/radiantnode/tensies/blob/main/docs/fable5-review/README.md" target="_blank" rel="noopener noreferrer">Read the review yourself</a>. ⭐</li>
<li>One button now handles both sign in and sign up, and usernames stopped caring about capital letters. Type it however you like, you're in.</li>
<li>Early adopters get a "Founding Roller" designation on their profile. You were here before it was cool. 🏅</li>
<li>We tightened roll fairness so nobody can squeeze in a sneaky extra roll, and your seat comes back cleanly after the host resumes from a pause.</li>
<li>The sign-in screen got a gold-glow avatar, and it stopped borrowing other people's profile photos.</li>
</ul>
<h2>1.22.1 ("Restock")</h2>
<p>Saturday, July 4, 2026</p>
<ul>
<li>Updates now reach your phone without you force-refreshing anything. New stuff just shows up. ✨</li>
<li><em>Behind the scenes: a holiday-weekend deep clean so the game stays fast and the next round of features lands safely.</em></li>
</ul>
<h2>1.22.0 ("Smooth Pour")</h2>
<p>Friday, July 3, 2026</p>
<ul>
<li>The loading screen got a glow-up: two little hopping dice and a friendly "Creating game" or "Joining game" so you know what's happening. 🎲</li>
<li>Moving between your profile, game recaps, and the bar is smoother now. Fewer jumps, more glide.</li>
<li>The lobby roster animates as friends arrive and leave, instead of popping in like they were teleported.</li>
</ul>
<h2>1.21.0 ("Irish Exit")</h2>
<p>Thursday, July 2, 2026</p>
<ul>
<li>The lobby has a Back button now, and when you duck out, everyone's roster updates right away instead of leaving a ghost in your seat. 👻</li>
<li>Your account photo shows up next to your name in the lobby, so the crew knows who's actually in.</li>
<li>Hosting alone? The lobby now nudges you: invite friends or play solo. Both are respectable.</li>
</ul>
<h2>1.20.1 ("Second Take")</h2>
<p>Wednesday, July 1, 2026</p>
<ul>
<li>The game-start intro plays properly on your second game of the night, not just the first. 🍿</li>
<li>The menu closes itself when the game ends, and the background stays steady during the intro handoff.</li>
</ul>
<h2>1.20.0 ("Opening Credits")</h2>
<p>Tuesday, June 30, 2026</p>
<ul>
<li>Starting a game now kicks off with a little video intro, and the bar behind the menus moves. The place feels alive before you even roll. 🎬</li>
</ul>
<h2>1.19.0 ("The Coaster")</h2>
<p>Wednesday, June 24, 2026</p>
<ul>
<li>The roll button is now a big round button floating right where your thumb wants it, with a glowing ring while it waits for your moment. 🛎️</li>
<li>Fresh app icons everywhere, from your home screen to the browser tab.</li>
</ul>
<h2>1.18.1 ("Word of Mouth")</h2>
<p>Tuesday, June 23, 2026</p>
<ul>
<li>Sharing a link to a game or a profile now shows the right preview card for that page instead of a generic one. 🖼️</li>
<li>We fixed the iOS share icon and centered the install walkthrough. Small stuff, but you'd have noticed.</li>
</ul>
<h2>1.18.0 ("House Key")</h2>
<p>Sunday, June 21, 2026</p>
<ul>
<li>A new animated walkthrough shows you exactly how to put Tensies on your home screen, with a little phone that acts out every step for you. 📲</li>
</ul>
<h2>1.17.1 ("Bouncer")</h2>
<p>Saturday, June 20, 2026</p>
<ul>
<li>Profile recap avatars now line up in actual standings order. Bragging rights, correctly sorted. 🥇</li>
<li><em>Behind the scenes: a security once-over and a stack of freshened-up parts, so the door stays locked and the lights stay on.</em></li>
</ul>
<h2>1.17.0 ("Group Chat")</h2>
<p>Friday, June 19, 2026</p>
<ul>
<li>When the game ends, everyone lands on the recap page together: final standings, stats, the works.</li>
<li>Tensies can now post game updates to your Discord server, and a /verify command lets anyone check a roll right from chat. 💬</li>
</ul>
<h2>1.16.0 ("Fair Shake")</h2>
<p>Thursday, June 18, 2026</p>
<ul>
<li>Every roll can now be publicly verified. The dice answer to a worldwide randomness beacon, not to us, and every finished game gets a recap page with a Roll Trust badge proving it. 🛡️</li>
<li>Your profile can carry a bio and a location now. Tell the world which barstool is yours.</li>
</ul>
<h2>1.15.0 ("Closing Time")</h2>
<p>Wednesday, June 17, 2026</p>
<ul>
<li>The host can end the game now, and everyone gets a final scoreboard with names, faces, and win counts. Perfect for settling who buys the next round. 🍻</li>
<li>That scoreboard survives a refresh, so the evidence doesn't vanish.</li>
</ul>
<h2>1.14.0 ("Wall of Fame")</h2>
<p>Monday, June 15, 2026</p>
<ul>
<li>You've got a public profile page now at tensies.app/@yourname, with your stats and your recent games, wins and losses alike. 🏆</li>
<li>We fixed a few stat counts so your record reflects what actually happened at the bar.</li>
</ul>
<h2>1.13.0 ("Regulars")</h2>
<p>Sunday, June 14, 2026</p>
<ul>
<li>Signed in? The game greets you like a regular: your name up in the header, and you never type it again. 🥃</li>
<li>Home-screen mode now fills the whole iPhone screen properly, edge to edge.</li>
</ul>
<h2>1.12.0 ("Karaoke Night")</h2>
<p>Saturday, June 13, 2026</p>
<ul>
<li>Accounts are here. Sign up with a passkey, skip the password entirely, and your stats follow you from game to game. 🔑</li>
<li>The landing dice do a happy wiggle, the buttons got a shimmer, and the lobby sorts you to the top with proper YOU and HOST badges.</li>
<li><em>Behind the scenes: we took the code-singing feature on a field trip and tested it on a pile of real phones, so it works in more places.</em></li>
</ul>
<h2>1.11.0 ("Jukebox")</h2>
<p>Friday, June 12, 2026</p>
<ul>
<li>Add Tensies to your home screen and it launches full-screen like a real app.</li>
<li>Your phone can now sing the game code to a friend's phone. One taps Play, the other taps Listen, and the code travels by sound while everyone else in the bar wonders what that noise was. 🎶</li>
<li>The invite button opens your phone's share sheet now, and phones held sideways get a polite "turn me upright" screen.</li>
</ul>
<h2>1.10.0 ("Steady Hands")</h2>
<p>Thursday, June 11, 2026</p>
<ul>
<li>The winner celebration stopped blinking away when an eager friend rolls mid-cheer. Enjoy your moment. 🎉</li>
<li>Dice land in their spots before the board appears, and they keep their 3D look on every phone.</li>
<li>The loading screen holds until your dice are truly ready, then dissolves away.</li>
</ul>
<h2>1.9.1 ("Wipe Down")</h2>
<p>Wednesday, June 10, 2026</p>
<ul>
<li>Nothing new to tap today. We spent the day wiping down the bar and sharpening our tools so future rounds land quicker and safer. 🧽</li>
</ul>
<h2>1.9.0 ("Quick Pour")</h2>
<p>Monday, June 8, 2026</p>
<ul>
<li>The game loads noticeably faster now. Less waiting, more rolling. ⚡</li>
<li>The winner screen appears the instant your winning roll settles, without the awkward pause while it thinks about it.</li>
</ul>
<h2>1.8.0 ("Side Door")</h2>
<p>Sunday, June 7, 2026</p>
<ul>
<li>Invite links are short and clean now: tensies.app/ABCDE. Easier to shout across a noisy bar. 🔗</li>
<li>Fixed the winner screen flashing away early when someone's roll landed at just the wrong moment.</li>
<li><em>Behind the scenes: we tightened the locks and beefed up the plumbing so the game holds up under a crowd.</em></li>
</ul>
<h2>1.7.0 ("Open Bar")</h2>
<p>Monday, June 1, 2026</p>
<ul>
<li>The game runs on sturdier rails now: a busy night with lots of groups playing won't wobble anyone's dice. 💪</li>
<li><em>Behind the scenes: this round was poured from a beach bar in the Dominican Republic. The plumbing got a full rebuild so Tensies can seat everyone who shows up.</em></li>
</ul>
<h2>1.6.0 ("Fresh Varnish")</h2>
<p>Sunday, May 31, 2026</p>
<ul>
<li>The whole place got a warm makeover: landing page, lobby, and game board share one cozy bar-top look now.</li>
<li>The dice look real, lit to match the room, and the round target die matches too.</li>
<li>We rebuilt the winner screen from scratch, complete with a countdown to the next round. And if you lose, you get broken dice. Motivation. 💔</li>
<li>Round targets climb 1 through 6 now instead of counting down. It just feels right.</li>
<li>There's a menu with an About page and this very changelog inside the app.</li>
</ul>
<h2>1.5.0 ("Last Call")</h2>
<p>Saturday, May 30, 2026</p>
<ul>
<li>Whoever's hosting can pause the game. Bathroom break, food run, or a rules debate that needs settling: the dice will wait. ⏸️</li>
<li>Paused games stay alive for up to an hour, even if phones go to sleep. Come back and pick up right where you left off.</li>
<li>Your seat is held with a claim ticket now. If you drop, only your phone can take your spot back.</li>
</ul>
<h2>1.4.0 ("Secret Menu")</h2>
<p>Friday, May 29, 2026</p>
<ul>
<li>There's an in-game menu now, tucked behind the little hamburger button. It starts humble, but big things are coming to it. 🍔</li>
<li><em>Behind the scenes: we built better ways to watch games in action, so we catch the weird stuff before you do.</em></li>
</ul>
<h2>1.3.0 ("Saved Seats")</h2>
<p>Thursday, May 28, 2026</p>
<ul>
<li>Your dice stay exactly where they landed, even if you refresh or your phone naps mid-game. 😴</li>
<li>One clean loading screen covers connecting and reconnecting now, instead of a pile of pop-ups.</li>
<li>Fixed the winner screen getting stuck when someone rolled at just the wrong moment.</li>
<li><em>Behind the scenes: we started keeping much better notes on every game, so rounds keep getting smoother and fairer.</em></li>
</ul>
<h2>1.2.0 ("Hold My Drink")</h2>
<p>Wednesday, May 27, 2026</p>
<ul>
<li>Phone went to sleep mid-game? You get a grace window now to slip back into your seat like nothing happened. 🔌</li>
<li>Your friends see your roll land exactly when you do. No more spoilers from a fast phone across the bar.</li>
<li>Fixed a sneaky freeze when a re-roll landed on the exact same numbers. Spooky, but no longer sticky.</li>
<li>Dropping a Tensies link in the group chat shows a proper preview card now.</li>
</ul>
<h2>1.1.0 ("House Rules")</h2>
<p>Tuesday, May 26, 2026</p>
<ul>
<li>Tensies has a face now: a proper dice logo and a favicon for your browser tab.</li>
<li>All rolls happen behind the bar now, on the server, so nobody can sneak loaded dice into the game. 🕵️</li>
</ul>
<h2>1.0.0 ("First Pour")</h2>
<p>Monday, May 25, 2026</p>
<ul>
<li>A bar regular and his friends love playing Tensies, the dice game. One night, a few heated rounds deep, he thought: this should live on our phones, for the nights someone forgets the dice. 🍺</li>
<li>So he sketched the very first board himself, started having Claude build it, and has kept tinkering from his barstool ever since, chatting with Claude between rounds.</li>
<li>By the end of that first day it was already a real game: live multiplayer, dice with actual physics, invite-by-text, and a warm wood bar-top to roll on.</li>
<li><em>Behind the scenes: the history starts with the game already built because he forgot to run git init until it worked. We've all been there.</em></li>
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
          <h2 class="menu-about-heading">Built at the bar because you don't have to go home but you can't stay there.</h2>
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
