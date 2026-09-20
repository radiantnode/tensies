// @ts-check
import './app-header.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { navigate } from '../router.js';

/*
 * <changelog-screen> — "What's New" as its OWN routed page (/changelog),
 * promoted out of the nav menu on 2026-08-20 (owner-directed): a 9,700px
 * scrolling document with its own header, back affordance and scroll
 * position is a page, not a menu panel — the menu overlay needed seven
 * patches to impersonate one. The visible chrome is the locked changelog
 * comp's (nav scrim over the photograph, back chip, Besley title, die-pip
 * bullets); only the CONTAINER changed. Flows in doc-scroll like the
 * profile; browser back / edge-swipe work naturally and the page is
 * deep-linkable.
 */

const CHANGELOG = `<p>Pull up a stool. Newest stuff up top.</p>
<h2>2.1.3 ("Unstuck")</h2>
<p>Friday, September 18, 2026</p>
<ul>
<li>Joined with a code or a link and then found the ROLL coin ignoring you? Fixed. Two guests hit that at Dog Haus and the whole game sat there waiting on a refresh. The Join sheet now gets out of the way the second you're in. 🚪</li>
</ul>
<h2>2.1.2 ("Mind the Glass")</h2>
<p>Sunday, August 23, 2026</p>
<ul>
<li>Your loose dice can land anywhere on the board now, and they know to stay off the pint glass, off the mat, and off the ROLL coin.</li>
<li>The mat of locked dice scooted toward the right edge, so there's more open board to play on.</li>
<li>Locked dice got their breathing room back. They were touching. Nobody likes that. 🎲</li>
<li>On iPhones with Safari's bars showing, dice sometimes ended up parked on the coaster. They keep to the board now.</li>
</ul>
<h2>2.1.1 ("Easy, Tiger")</h2>
<p>Friday, August 21, 2026</p>
<ul>
<li>If your profile photo is slow to turn up, the app asks once and waits a minute instead of pestering the server a couple hundred times. 🤫</li>
<li><em>Behind the scenes: our test rig learned to keep its hands off the live game, so a test run can't knock the real bar offline again.</em></li>
</ul>
<h2>2.1.0 ("Open Floor")</h2>
<p>Thursday, August 20, 2026</p>
<ul>
<li>Every screen scrolls like a normal page now, with the header riding along at the top. Only the game board stays bolted down, because dice need a steady surface. 🪵</li>
<li>What's New has its own page and its own link. Share it if you like, and swiping back works the way it does everywhere else.</li>
<li>The scoreboard bar got a heavier pour, so it reads clearly over the dice.</li>
<li>Your phone always checks for the newest version, so nobody's stuck playing last night's build.</li>
<li><em>Behind the scenes: the whole roll, reveal, and celebrate sequence was rebuilt as one clean engine, so the odd freezes we kept chasing one at a time simply can't happen anymore.</em></li>
</ul>
<h2>2.0.0 ("Top Shelf")</h2>
<p>Wednesday, August 19, 2026</p>
<ul>
<li>Tensies got a full redesign. New type, a brass ROLL coin with the dice mark engraved on it, an enamel target die, an oxblood mat for your locked dice, and a medallion for whoever takes the round. Every screen got the treatment. ✨</li>
<li>The video backgrounds were regraded to match, and the app icon no longer sits on a white square on Android.</li>
<li>Error messages are cream when you slipped up and amber when the house is saying no.</li>
<li>The frosted glass fades in instead of popping into place, even on iPhones, which were the stubborn ones.</li>
</ul>
<h2>1.24.1 ("Stay Put")</h2>
<p>Saturday, August 1, 2026</p>
<ul>
<li>Locked dice quit shuffling around on the mat when a new one joins the row. What lands, stays. 📌</li>
</ul>
<h2>1.24.0 ("Round Trip")</h2>
<p>Saturday, July 18, 2026</p>
<ul>
<li>The target climbs 1 through 6 and then walks back down, 5, 4, 3, 2, 1, and up again. No more jumping from six straight back to one. 🔁</li>
</ul>
<h2>1.23.2 ("Caught Up")</h2>
<p>Monday, July 13, 2026</p>
<ul>
<li>If your phone blinked at the wrong moment and missed the round changing over, your board could end up with last round's dice still locked and the new ones piling on top. It catches up on your very next roll now, or the moment anyone else rolls. 🔌</li>
</ul>
<h2>1.23.1 ("The Usual")</h2>
<p>Saturday, July 11, 2026</p>
<ul>
<li>Signed in? The landing greets you by name, in the same time-of-day voice as everyone else. 👋</li>
<li>The Create Game button got a little more space to breathe when you're signed in.</li>
</ul>
<h2>1.23.0 ("Rubber Stamp")</h2>
<p>Friday, July 10, 2026</p>
<ul>
<li>Checked in to a place? The lobby stamp wears a CHECKED IN cachet over the venue name now, slammed on like the real thing. 🏷️</li>
<li>The stamp got wider. It fills the screen, and the QR scans easier from across the bar.</li>
</ul>
<h2>1.22.0 ("Front of House")</h2>
<p>Thursday, July 9, 2026</p>
<ul>
<li>The landing page got redone. Everything sits in the bottom half where your thumb lives, and it greets you by the time of day.</li>
<li>Join is a slide-up sheet now, and the Join button shows a live scrambling game code while it waits for yours.</li>
<li>The Nearby button on the landing has a tiny live radar in it, so you can see whether there's anything around before you tap.</li>
<li>Fixed locked dice stacking past ten during the reveal. That's one too many for a game called Tensies. 🔟</li>
<li>New headline type and a rewritten About page. The menus fade in instead of sliding, and rapid tapping can't wedge them anymore.</li>
<li>Turning your phone sideways no longer inflates the menu text.</li>
</ul>
<h2>1.21.1 ("Golden Hour")</h2>
<p>Wednesday, July 8, 2026</p>
<ul>
<li>The header wordmark went gold with bigger dice, and the main button followed with a subtle brushed-metal finish. ✨</li>
<li>The lobby QR stamp arrives with the game now, so it doesn't flicker in a beat late.</li>
<li>The places sheet got flatter chrome and a plain list.</li>
<li><em>Behind the scenes: we started keeping count of where people check in, so we can see which kinds of places Tensies gets played at and make those nights better.</em></li>
</ul>
<h2>1.21.0 ("Postage Paid")</h2>
<p>Tuesday, July 7, 2026</p>
<ul>
<li>The plain code box in the lobby is a vintage postage stamp now, with your game code as the serial and a real QR to scan. Tap it to enlarge, or hit Copy Link. 📬</li>
<li>The check-in picker slides up from the bottom like a proper sheet, docks above the iOS keyboard, and closes when you tap outside it.</li>
<li>Nearby places prefer bars, restaurants, and other spots where people actually gather, and they refresh as the host moves.</li>
<li>Sharing your location and checking in are one flow now instead of two switches.</li>
</ul>
<h2>1.20.0 ("Around the Corner")</h2>
<p>Monday, July 6, 2026</p>
<ul>
<li>Nearby Games. Hosts can share their lobby with anyone close by, and players see it on a compass-aligned radar and tap to join. Nobody has to type a code or squint at someone else's screen. 📡</li>
<li>Hosts can check the game in to a place, picked from a list of nearby venues with photos and a search box. The game then shows up on the radar right at the bar.</li>
<li>Nearby is opt-in, with a confirm dialog and plain-English fine print about what gets shared. Your exact spot never does.</li>
<li>Lobby buttons are three tidy circles now, Share, Play, and Share Location, with captions so nobody has to guess.</li>
</ul>
<h2>1.19.0 ("Founding Rollers")</h2>
<p>Sunday, July 5, 2026</p>
<ul>
<li>Early adopters get a Founding Roller banner on their profile. You were here first, and now it says so in gold. ⭐</li>
<li>One Sign In / Sign Up button. Tap it, and if you don't have an account yet, it just makes you one. Usernames keep the capitals you typed but aren't picky about them when you sign in.</li>
<li>The scoreboard's progress bars glide instead of snapping.</li>
<li>A rejected roll, a dropped frame, or a quick second tap on End Game can't leave a button stuck spinning anymore.</li>
<li><em>Behind the scenes: an outside review found two ways a tinkered-with phone could out-roll an honest one, and both are closed. Everyone rolls at the same pace now.</em></li>
</ul>
<h2>1.18.2 ("Wipe Down")</h2>
<p>Saturday, July 4, 2026</p>
<ul>
<li>Your phone grabs the freshest version of the app every time it opens, so an update never gets stuck behind an old copy. 🧽</li>
<li><em>Behind the scenes: a big tidy-up of the paperwork and some dead weight in the styles, so the next round of features lands faster.</em></li>
</ul>
<h2>1.18.1 ("Shaking the Cup")</h2>
<p>Friday, July 3, 2026</p>
<ul>
<li>The loading screen shakes a little cup of dice now, and it tells you what it's doing: Creating game, Joining game. 🥤</li>
<li>Players sliding into the lobby animate in, and the HOST badge is a plain gold label.</li>
<li>Moving between your profile, a game's detail page, and back is smoother, and the Back button behaves every time.</li>
</ul>
<h2>1.18.0 ("Back Door")</h2>
<p>Thursday, July 2, 2026</p>
<ul>
<li>The lobby has a Back button. Tap it and you're out immediately, and everyone else's roster updates at once. 🚪</li>
<li>The lobby title tells you whether you're hosting or waiting, and a host sitting alone gets a nudge to invite friends.</li>
<li>Signed-in players show their account avatar in the lobby list.</li>
<li>Refreshing mid-game drops you right back onto the board.</li>
</ul>
<h2>1.17.1 ("Second Showing")</h2>
<p>Wednesday, July 1, 2026</p>
<ul>
<li>The intro video plays again for your second game of the night, not just the first.</li>
<li>If the video ever stalls, the board comes up anyway. Nobody waits on a movie. 🎬</li>
<li>The landing video picks back up when you leave a game, and the in-game menu closes itself when the game ends.</li>
</ul>
<h2>1.17.0 ("Neon Sign")</h2>
<p>Tuesday, June 30, 2026</p>
<ul>
<li>Tensies has a video background on the landing now, and a short intro rolls when the host starts the game. The lights go down and the dice come out. 🎥</li>
</ul>
<h2>1.16.0 ("Fresh Coaster")</h2>
<p>Wednesday, June 24, 2026</p>
<ul>
<li>The ROLL button is a big round coaster now, floating over the board with a glow that spins while you wait your turn. The tap target is bigger than it looks, on purpose. 🔘</li>
<li>Fresh app icons at every size, so the one on your home screen matches the one in the share sheet.</li>
</ul>
<h2>1.15.1 ("Business Card")</h2>
<p>Tuesday, June 23, 2026</p>
<ul>
<li>Sharing a link to Tensies, or to someone's profile, shows the right title and picture in the preview. 🪪</li>
<li>Fixed the iOS share icon and the splash screen when you launch from your home screen.</li>
</ul>
<h2>1.15.0 ("Reserved Stool")</h2>
<p>Sunday, June 21, 2026</p>
<ul>
<li>Tensies can walk you through adding it to your home screen, with an animated little phone showing each tap. On iPhone it shows the Share-sheet route, since Apple won't ask for you. 📱</li>
</ul>
<h2>1.14.1 ("Bouncer")</h2>
<p>Saturday, June 20, 2026</p>
<ul>
<li>Recent games on your profile show the avatars in the order people actually finished. 🥇</li>
<li><em>Behind the scenes: a security once-over, a published way to report anything sketchy, and a lot of fresh ingredients in the kitchen.</em></li>
</ul>
<h2>1.14.0 ("Cash Out")</h2>
<p>Friday, June 19, 2026</p>
<ul>
<li>When the host ends a game, everyone lands on that game's own page with the final standings, instead of a pop-up you can lose. A one-time "Game ended" note says why you're there. 🧾</li>
<li><em>Behind the scenes: we get a live card for every game as it happens, so we can keep an eye on a busy night without hovering over your shoulder.</em></li>
</ul>
<h2>1.13.0 ("Straight Dice")</h2>
<p>Thursday, June 18, 2026</p>
<ul>
<li>Provably fair rolls. Every roll can be drawn from a public randomness beacon that nobody, including us, can steer, and any game can be checked after the fact.</li>
<li>Every finished game has its own page with the rolls and rounds, and a Roll Trust shield when the math checks out. There's a learn-more link if you want to go down that hole. 🛡️</li>
<li>Profiles can carry a bio and a location now.</li>
</ul>
<h2>1.12.0 ("Settle Up")</h2>
<p>Wednesday, June 17, 2026</p>
<ul>
<li>Hosts can End Game from the menu, with a tap-to-confirm so a stray thumb can't do it. Everyone gets the final scoreboard with avatars, and it survives a refresh. 💸</li>
<li>Your profile shows recent games even when only one person rolled, and your opponents' avatars sit next to each one.</li>
<li>Fixed signed-in players sometimes getting a game credited to a stranger instead of their own account.</li>
</ul>
<h2>1.11.0 ("Wall of Fame")</h2>
<p>Monday, June 15, 2026</p>
<ul>
<li>Everyone with an account gets a public profile page: stats, avatar, and recent games with who you played. Tap your name in the header to get there. 🏆</li>
<li>Fixed a wrong turn on the join link, and a username that took a second to show up after signing in.</li>
<li>Win and round counts on profiles count everybody who played now, not just the winner.</li>
</ul>
<h2>1.10.1 ("Name on the Tab")</h2>
<p>Sunday, June 14, 2026</p>
<ul>
<li>Signed in? Your name sits in the header now, on the landing and on the board, and the name box gets out of your way. 🏷️</li>
<li>On iPhones launched from the home screen, the app fills right down to the bottom edge and nothing bleeds through the status bar.</li>
<li>The What's New page scrolls as one long page instead of a box inside a box.</li>
</ul>
<h2>1.10.0 ("Open a Tab")</h2>
<p>Saturday, June 13, 2026</p>
<ul>
<li>You can make an account now with a passkey. There's no password and no email, just your face or your fingerprint. Your stats from every game you already played come along with you. 🔑</li>
<li>The landing dice wiggle, the main buttons catch the light, and the lobby shows both your YOU and HOST badges with you sorted to the top.</li>
<li><em>Behind the scenes: we built a little soundboard to test the audio code share in real bars, and we've been out there doing exactly that.</em></li>
</ul>
<h2>1.9.0 ("Bar Whistle")</h2>
<p>Friday, June 12, 2026</p>
<ul>
<li>You can add Tensies to your home screen and it launches full screen like a real app.</li>
<li>The lobby's Play button chirps your game code out loud, and a friend's Listen button hears it and fills the code in. Experimental, a little bit magic, and it works best without the jukebox blaring. 🐦</li>
<li>The invite button uses your phone's share sheet, with the Tensies icon on it.</li>
<li>Turn your phone sideways and you get a polite ask to turn it back. Tensies is a portrait game.</li>
</ul>
<h2>1.8.2 ("Steady Hands")</h2>
<p>Thursday, June 11, 2026</p>
<ul>
<li>The round-winner screen stays up until it's done, even when someone else is still rolling. 🎯</li>
<li>Dice land in their spots before the board shows up, so nothing hops into place after the fact.</li>
<li>Fixed 3-D dice looking mangled on iPhones during screen changes, and the loading screen waits for the dice before it dissolves.</li>
</ul>
<h2>1.8.1 ("Deep Clean")</h2>
<p>Wednesday, June 10, 2026</p>
<ul>
<li>Nothing new to press today. The kitchen was closed for a scrub. 🧹</li>
<li><em>Behind the scenes: we started rebuilding every screen from a blank sheet, checking each one pixel for pixel against the old, so the app gets easier to improve without changing a thing you see.</em></li>
</ul>
<h2>1.8.0 ("Speed Rail")</h2>
<p>Monday, June 8, 2026</p>
<ul>
<li>Win a round and the celebration pops the moment your last die lands, instead of after the dice finish sliding to the mat.</li>
<li>The app loads faster. Everything is bundled and cached now, and the bar-top background lost a lot of weight. ⚡</li>
</ul>
<h2>1.7.0 ("Skip the Line")</h2>
<p>Sunday, June 7, 2026</p>
<ul>
<li>Join links are shorter and cleaner: just the site and the code. 🔗</li>
<li>Fixed the winner screen flashing away when someone else's roll landed mid-celebration.</li>
<li>Fixed reconnecting after a dropped signal, and a menu that flashed during loading.</li>
<li>What's New has a View on GitHub link at the bottom for the curious.</li>
<li><em>Behind the scenes: a locked front door, and the bar can run on several servers at once now, so a big night never slows anyone down.</em></li>
</ul>
<h2>1.6.1 ("New Kegs")</h2>
<p>Monday, June 1, 2026</p>
<ul>
<li>Busy nights are handled. The bar can seat a crowd across several servers now and nobody waits on a slow round. 🍻</li>
<li><em>Behind the scenes: the doors got extra locks, and the whole front end was rebuilt and verified pixel for pixel against the old one. You should notice nothing, which is the point.</em></li>
</ul>
<h2>1.6.0 ("Fresh Coat")</h2>
<p>Sunday, May 31, 2026</p>
<ul>
<li>The whole app got the warm bar treatment: leather pills, a glowing round marker, dice lit to match the bar top, and a lobby that calls your friends Fellow Bar Rats.</li>
<li>The round-winner screen was redone from scratch, with the dice logo flying in, the winner's name in gold, and a countdown to the next round. Lose the round and you get cracked dice. Rough. 💔</li>
<li>A menu on every pre-game screen with an About blurb and this very changelog.</li>
<li>The target climbs 1 through 6 now instead of counting down.</li>
</ul>
<h2>1.5.0 ("Last Call")</h2>
<p>Saturday, May 30, 2026</p>
<ul>
<li>Hosts can pause the game. Perfect for a bar run, a bathroom break, or settling who's buying the next round. ⏸️ Everyone else sees a waiting screen, and a paused game stays alive for up to an hour.</li>
<li>A host who wanders off during a pause hands the keys to someone still there, and a round won right as the pause hit isn't lost.</li>
<li>Only you can reclaim your seat after a drop. Nobody can slide into your spot by guessing.</li>
</ul>
<h2>1.4.0 ("Menu's Up")</h2>
<p>Friday, May 29, 2026</p>
<ul>
<li>The game board has a menu now. Tap the hamburger and it slides in. 🍔</li>
<li>Your seat is held for a full minute if your phone drops, up from thirty seconds.</li>
<li>Screens skip the needless little transition when nothing changed.</li>
<li><em>Behind the scenes: we can watch a whole night of games unfold on a dashboard now, which is how we find the stuff worth fixing.</em></li>
</ul>
<h2>1.3.0 ("Save My Seat")</h2>
<p>Thursday, May 28, 2026</p>
<ul>
<li>Your dice stay where they landed, even if you refresh or your phone naps. 😴</li>
<li>One loading screen for everything, whether you're connecting, reconnecting, or waiting on a friend, so you always know what's going on.</li>
<li>Twice as many random player names to get stuck with.</li>
<li>Fixed dice piling into one lump on a fresh game, and a winner screen that wouldn't go away.</li>
</ul>
<h2>1.2.0 ("Hold My Drink")</h2>
<p>Wednesday, May 27, 2026</p>
<ul>
<li>Lose signal, drop your phone, take a call. You've got thirty seconds to get back and your seat is waiting.</li>
<li>Your friends don't see your new dice until your own reveal has finished, so nobody spoils the roll.</li>
<li>Fixed a sneaky freeze when your re-roll landed on the exact same numbers. Spooky, but no longer sticky. 👻</li>
<li>Sending a Tensies link shows a proper preview card, and the dice mark sits in the game header now.</li>
</ul>
<h2>1.1.0 ("House Dice")</h2>
<p>Tuesday, May 26, 2026</p>
<ul>
<li>Tensies has a logo now, and an icon in your browser tab.</li>
<li>The house rolls the dice. Every roll comes from the server, so nobody's phone gets to argue about the numbers. 🎲</li>
</ul>
<h2>1.0.0 ("First Pour")</h2>
<p>Monday, May 25, 2026</p>
<ul>
<li>A bar regular and his friends love Tensies, the dice game. One night, a few heated rounds deep, he thought it'd be great to play anywhere, even when somebody forgot the dice.</li>
<li>So he started having Claude build it, sketched the very first game board himself, and has kept tinkering from his barstool, chatting with Claude between rounds.</li>
<li>Day one already had the goods: ten dice that gather, shake, and scatter like the real thing, a bar-top background, everybody's progress up top, and inviting friends by link or text.</li>
<li>Random player names if you can't be bothered to type one. Own it. 🍺</li>
<li><em>Behind the scenes: the history starts here only because he forgot to git init until the game already worked. Classic.</em></li>
</ul>
<div class="menu-changelog-footer">
  <p class="menu-changelog-footer-lead">Still scrolling? Either you're into the nerdy bits or just doomscrolling between rounds.</p>
  <p>Tensies got built at the bar, and it stays open like one. Anybody can wander in. The code's all there if you want to see how it works or check that the rolls are fair.</p>
  <a class="menu-changelog-ghlink" href="https://github.com/radiantnode/tensies" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
    View on GitHub
  </a>
</div>`;

export class ChangelogScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'changelog';
    this.className = 'screen changelog-screen';
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body changelog-body-stack">
        <div class="menu-changelog-header">
          <button type="button" class="menu-changelog-back-btn btn-back">${BACK_BUTTON_HTML}</button>
          <h1 class="menu-changelog-title">What&rsquo;s New</h1>
        </div>
        <div class="menu-changelog-body">${CHANGELOG}</div>
      </div>`;

    this.#reshapeChangelog();

    /** @type {HTMLElement} */ (this.querySelector('.menu-changelog-back-btn'))
      .addEventListener('click', () => {
        // In-app arrivals have history state from our pushState; a direct
        // load does not — go home instead of leaving the site.
        if (history.state) history.back();
        else navigate('/', { replace: true });
      });
  }

  /**
   * Restructure the baked changelog HTML onto the locked system: the version
   * is NOT a heading — it joins the date on the legend line where metadata
   * belongs; the release NAME is the heading (changelog.json). The generator
   * keeps emitting `<h2>1.31.0 ("Round Trip")</h2><p>date</p>` and this
   * reshapes it, so the changelog skill needs no change.
   */
  #reshapeChangelog() {
    const body = /** @type {HTMLElement | null} */ (this.querySelector('.menu-changelog-body'));
    if (!body) return;
    for (const h2 of Array.from(body.querySelectorAll('h2'))) {
      const m = (h2.textContent ?? '').match(/^([\d.]+)\s*\("?(.+?)"?\)$/);
      const dateP = h2.nextElementSibling;
      if (!m || !dateP || dateP.tagName !== 'P') continue;
      const legend = document.createElement('p');
      legend.className = 'menu-rel-legend';
      const v = document.createElement('b');
      v.textContent = m[1];
      legend.append(v, ` · ${dateP.textContent}`);
      const name = document.createElement('p');
      name.className = 'menu-rel-name';
      name.textContent = m[2];
      h2.replaceWith(legend);
      dateP.replaceWith(name);
      legend.after(name);
    }
    // The intro line is the lede.
    const first = body.querySelector('p');
    if (first && !first.className) first.className = 'menu-changelog-lede';
  }
}

customElements.define('changelog-screen', ChangelogScreen);
