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
<h2>2.1.2 ("Elbow Room")</h2>
<p>Sunday, August 23, 2026</p>
<ul>
<li>Your loose dice now get the whole board to land on, and they know to stay off the pint glass, off the mat, and off the ROLL coin.</li>
<li>The mat of locked dice scooted toward the right edge so the open board is a good bit roomier.</li>
<li>Locked dice got their breathing room back. They were touching, and nobody likes that. 🎲</li>
</ul>
<h2>2.1.1 ("Quiet Hour")</h2>
<p>Friday, August 21, 2026</p>
<ul>
<li>If your profile photo is slow to turn up, the app asks once and waits politely instead of pestering the server a couple hundred times. 🤫</li>
<li><em>Behind the scenes: our test rig learned to leave the live game alone, so a test run can never knock the real bar offline again.</em></li>
</ul>
<h2>2.1.0 ("Open Door")</h2>
<p>Thursday, August 20, 2026</p>
<ul>
<li>Every screen scrolls like a normal page now, with the header riding along at the top. Only the game board stays bolted down, because dice need a steady surface. 🪵</li>
<li>What's New has its own page with its own link. You can share it, and swiping back works the way it does everywhere else.</li>
<li>The scoreboard bar got a heavier pour so it reads clearly over the dice.</li>
<li>Your phone always checks for the newest version, so nobody gets stuck playing last night's build.</li>
<li><em>Behind the scenes: the whole roll, reveal, and celebrate sequence was rebuilt as one clean engine, so the odd freezes we kept chasing one at a time simply cannot happen now.</em></li>
</ul>
<h2>2.0.0 ("Brass &amp; Enamel")</h2>
<p>Wednesday, August 19, 2026</p>
<ul>
<li>Tensies got a full redesign. New type, a brass ROLL coin with the dice mark engraved on it, an enamel target die, an oxblood mat for your locked dice, and a round-winner medallion. Every screen got the treatment. ✨</li>
<li>The video backgrounds were regraded to match, and the app icon no longer sits on a white square on Android.</li>
<li>Error messages are cream when you slipped up and amber when the house is saying no.</li>
<li>The frosted glass fades in instead of popping into place, even on iPhones, which were the stubborn ones.</li>
</ul>
<h2>1.29.0 ("Big Screen")</h2>
<p>Monday, August 17, 2026</p>
<ul>
<li>When Tensies is up on the bar's wall display it plays the 4K video, so it looks as sharp up there as it does on your phone. 📺</li>
</ul>
<h2>1.28.1 ("Settled Dice")</h2>
<p>Saturday, August 1, 2026</p>
<ul>
<li>Fixed locked dice hopping over to fill a new slot when a fresh die joined the mat. They sit still now. 🧘</li>
</ul>
<h2>1.28.0 ("Round Trip")</h2>
<p>Saturday, July 18, 2026</p>
<ul>
<li>The target number climbs 1 to 6 and then walks back down 5, 4, 3, 2, 1 before heading up again, so it never jumps straight from six to one. 🔁</li>
</ul>
<h2>1.27.0 ("Second Wind")</h2>
<p>Monday, July 13, 2026</p>
<ul>
<li>If your phone misses the moment a round rolls over, the board catches itself up on the next update instead of sitting there confused. 🫣</li>
</ul>
<h2>1.26.2 ("The Usual")</h2>
<p>Saturday, July 11, 2026</p>
<ul>
<li>Signed in? The landing page greets you by name now, like a regular. 🍻</li>
</ul>
<h2>1.26.1 ("House Regular")</h2>
<p>Friday, July 10, 2026</p>
<ul>
<li>The lobby stamp got a little medallion showing where you checked in, and it stretches the full width of the screen. 📍</li>
</ul>
<h2>1.26.0 ("New Digs")</h2>
<p>Thursday, July 9, 2026</p>
<ul>
<li>A new landing page. The buttons sit down where your thumb already is, and it greets you by the time of day, so it knows when you've wandered in late.</li>
<li>Joining is a quick sheet that slides up from the bottom, and the Join button shows a game code scrambling itself like a slot machine. 🎰</li>
<li>The Nearby button on the landing page is a tiny live radar.</li>
<li>Fixed locked dice stacking past ten during a reveal, and fixed the menus breaking if you tapped too fast.</li>
<li><em>Behind the scenes: nearby searches got leaner so the radar stays quick even when the bar is busy.</em></li>
</ul>
<h2>1.25.0 ("Gold Leaf")</h2>
<p>Wednesday, July 8, 2026</p>
<ul>
<li>The Tensies wordmark and the big buttons went gold with a brushed-metal finish. 🥇</li>
<li>The places sheet is flatter and calmer, and the lobby's QR stamp shows up without a flicker.</li>
<li><em>Behind the scenes: we started keeping track of where people check in, so we can see which kinds of spots Tensies nights happen at.</em></li>
</ul>
<h2>1.24.0 ("Hand Stamp")</h2>
<p>Tuesday, July 7, 2026</p>
<ul>
<li>The lobby's game code is now a vintage QR stamp. Tap it to blow it up for the person across the bar, or hit Copy Link. 🎟️</li>
<li>The check-in sheet slides up from the bottom, tucks neatly above the keyboard, and closes when you tap outside it.</li>
<li>Nearby places lean toward bars, pubs, and the kind of spots people gather, and the list refreshes as the host wanders.</li>
</ul>
<h2>1.23.0 ("Bar Crawl")</h2>
<p>Monday, July 6, 2026</p>
<ul>
<li>Nearby Games: a real radar that shows games being hosted around you, with the host's face on each blip and a list underneath. Point your phone and the compass lines it up. 🧭</li>
<li>Hosts can check in to the bar they're at, with real photos of the place, so friends can find the game by where it's happening.</li>
<li>Sharing your location asks first, with the fine print spelled out, and remembers your answer.</li>
<li>The lobby's Share, Play, and Share Location buttons are three round coins with captions, and the link is right there to copy.</li>
</ul>
<h2>1.22.0 ("Founding Rollers")</h2>
<p>Sunday, July 5, 2026</p>
<ul>
<li>One sign-in button does both jobs: new here, it signs you up; back again, it signs you in. Capital letters in your username no longer matter.</li>
<li>Early players get a "Founding Roller" badge on their profile. You were here first and now it says so. 🏅</li>
<li>We had Claude's new Fable 5 model walk the whole bar with a clipboard, and fixed everything it wrote up. The review came back: "I would drink at this bar." <a href="https://github.com/radiantnode/tensies/blob/main/docs/fable5-review/README.md" target="_blank" rel="noopener noreferrer">Read the review yourself</a>.</li>
<li>Fixed a gap where a fast tapper could squeeze in an extra roll. Everyone rolls at the same pace now.</li>
<li><em>Behind the scenes: paused games and dropped players are watched more carefully, so an abandoned game gets cleaned up exactly once and a resumed one picks up right where it left off.</em></li>
</ul>
<h2>1.21.1 ("House Cleaning")</h2>
<p>Saturday, July 4, 2026</p>
<ul>
<li>The app checks for a fresh version on every open, so you never play a stale build. 🧹</li>
<li><em>Behind the scenes: a tidy-up day. Old leftovers swept out so the app stays light and quick.</em></li>
</ul>
<h2>1.21.0 ("Fresh Coat")</h2>
<p>Friday, July 3, 2026</p>
<ul>
<li>The loading screen has tumbling dice instead of a plain bar, and tells you whether it's creating or joining your game. ⏳</li>
<li>Moving between your profile, a game's detail page, and the bar is smooth and the Back button actually goes back.</li>
<li>The lobby roster animates as friends arrive and leave, and the host tag is a plain gold label.</li>
<li>The Add-to-Home-Screen guide sits centered and matches the rest of the app.</li>
</ul>
<h2>1.20.0 ("Back Booth")</h2>
<p>Thursday, July 2, 2026</p>
<ul>
<li>There's a Back button in the lobby. Leave and the roster updates for everyone right away instead of keeping a ghost in your seat. 🪑</li>
<li>The lobby tells you whether you're hosting or waiting, shows friends' profile photos, and nudges a solo host to invite people.</li>
<li>Refreshing mid-game puts you right back on the board.</li>
</ul>
<h2>1.19.1 ("One More Round")</h2>
<p>Wednesday, July 1, 2026</p>
<ul>
<li>The intro video plays again on your second game, the landing video comes back when you leave one, and the menu closes itself when the game ends. 🎬</li>
</ul>
<h2>1.19.0 ("Opening Credits")</h2>
<p>Tuesday, June 30, 2026</p>
<ul>
<li>The game opens with a little video intro, and the landing page has a living background. Pretty cinematic for a dice game. 🍿</li>
</ul>
<h2>1.18.0 ("Fresh Ice")</h2>
<p>Wednesday, June 24, 2026</p>
<ul>
<li>The ROLL button is a big round coin floating over the board, and it glows slowly while it waits for your turn. 🔴</li>
<li>A new set of app icons, crisp at every size.</li>
</ul>
<h2>1.17.1 ("Nightcap")</h2>
<p>Tuesday, June 23, 2026</p>
<ul>
<li>Links you share show a proper preview, the iOS share icon is fixed, and the install guide sits centered. 🌙</li>
</ul>
<h2>1.17.0 ("Take It Home")</h2>
<p>Sunday, June 21, 2026</p>
<ul>
<li>An animated walkthrough shows you how to put Tensies on your home screen so it opens like a real app. 📲</li>
</ul>
<h2>1.16.1 ("Last Orders")</h2>
<p>Saturday, June 20, 2026</p>
<ul>
<li>Fixed the avatars on your recent games showing in the wrong order. Winners first. 🥈</li>
<li><em>Behind the scenes: we wrote down how to report a security problem and tightened a few bolts so your games stay yours.</em></li>
</ul>
<h2>1.16.0 ("Round the Room")</h2>
<p>Friday, June 19, 2026</p>
<ul>
<li>When the host calls it, everyone lands on the game's detail page with the final standings, instead of a pop-up.</li>
<li>Tensies can post game updates to a Discord channel, and a /verify command there checks a game's rolls for you. 📣</li>
</ul>
<h2>1.15.0 ("Provably Fair Pour")</h2>
<p>Thursday, June 18, 2026</p>
<ul>
<li>Roll Trust: every roll can be drawn from a public randomness beacon that nobody, not even us, can tip. Each game page wears a shield and you can check the math yourself. 🛡️</li>
<li>Every game gets its own page with the rolls, the standings, and the trust verdict.</li>
<li>Profiles can carry a bio and a location.</li>
</ul>
<h2>1.14.0 ("Calling It")</h2>
<p>Wednesday, June 17, 2026</p>
<ul>
<li>Hosts can End Game from the menu. Everyone sees the final scoreboard with faces, and it sticks around through a refresh. 🏁</li>
<li>Your profile's recent games show the right head count.</li>
</ul>
<h2>1.13.0 ("Name on the Door")</h2>
<p>Monday, June 15, 2026</p>
<ul>
<li>Everyone signed in gets a public profile page at /@yourname, with your stats, your photo, and your recent games with who won.</li>
<li>Tap your name in the header to jump to your profile. 🚪</li>
<li>Fixed the /join link and a few signed-in hiccups.</li>
</ul>
<h2>1.12.0 ("Signed In")</h2>
<p>Sunday, June 14, 2026</p>
<ul>
<li>When you're signed in, the landing page skips the name box and your username rides in the header, on the board too.</li>
<li>Installed on an iPhone, the app fills the screen edge to edge with no bleed at the top or bottom. 📱</li>
<li>Refresh during sign-up and you pick up where you left off.</li>
</ul>
<h2>1.11.0 ("Karaoke Night")</h2>
<p>Saturday, June 13, 2026</p>
<ul>
<li>Accounts arrived. Sign up with a passkey (Face ID, fingerprint, whatever your phone does), and your stats from before come along for the ride.</li>
<li>The landing dice wiggle, the big buttons shimmer, and the lobby sorts you to the top with a YOU badge.</li>
<li>A soundboard tool for testing the chirpy code share in real rooms. We took it to actual bars. For science. 🎤</li>
</ul>
<h2>1.10.0 ("Pocket Pour")</h2>
<p>Friday, June 12, 2026</p>
<ul>
<li>Add Tensies to your home screen and it runs full screen like a real app.</li>
<li>The lobby's Share button opens your phone's share sheet, Tensies icon and all.</li>
<li>Turn your phone sideways and it politely asks you to turn it back.</li>
<li>Play a code out loud: the lobby chirps the game code as a little tune and a friend's phone listens for it. Works surprisingly well over bar noise. 🔊</li>
</ul>
<h2>1.9.2 ("Steady Hands")</h2>
<p>Thursday, June 11, 2026</p>
<ul>
<li>The winner screen stays up even when a friend rolls late, the dice are in place before the board shows, and Safari stops mangling the 3-D dice mid-transition. 🧊</li>
</ul>
<h2>1.9.1 ("Tuning Fork")</h2>
<p>Wednesday, June 10, 2026</p>
<ul>
<li>Nothing you'd spot from your stool today, but the glass got a polish. 🧽</li>
<li><em>Behind the scenes: we rebuilt the front of the app again, pixel for pixel identical, so every future change lands cleaner and faster.</em></li>
</ul>
<h2>1.9.0 ("Instant Replay")</h2>
<p>Monday, June 8, 2026</p>
<ul>
<li>The winner screen shows up the instant your last die lands. You used to have to wait for the dice to shuffle over first. 🏆</li>
<li><em>Behind the scenes: the app is bundled and trimmed before it reaches you, so it loads quicker on a bar's shaky wifi.</em></li>
</ul>
<h2>1.8.0 ("Clean Pour")</h2>
<p>Sunday, June 7, 2026</p>
<ul>
<li>Join links are short and clean: just the site and the code. 🔗</li>
<li>Fixed the winner screen blinking away when a friend's roll landed mid-celebration.</li>
<li><em>Behind the scenes: Tensies can now run on several servers at once behind one door, so a busy night never slows the dice.</em></li>
</ul>
<h2>1.7.0 ("Round on the House")</h2>
<p>Monday, June 1, 2026</p>
<ul>
<li>The loading screen appears the instant you open the app, before anything else has even woken up. ☕</li>
<li><em>Behind the scenes: game state moved to shared memory so any server can host any game, and the whole front end was rebuilt and checked against the old one pixel by pixel.</em></li>
</ul>
<h2>1.6.0 ("Top Shelf")</h2>
<p>Sunday, May 31, 2026</p>
<ul>
<li>A warm bar look across the app: leather pills, wood, a glowing round label, and dice lit to match the room.</li>
<li>A proper winner screen with a big shiny die, your name, and a countdown to the next round. Lose, and you get a cracked die instead. Sorry. 💔</li>
<li>A menu on the landing, join, and lobby screens, with an About blurb and this very What's New.</li>
<li>The target now climbs 1, 2, 3, 4, 5, 6 instead of counting down.</li>
<li>Fellow Bar Rats get their own section in the lobby, Start Game stays pinned, and Send Message has a proper icon.</li>
</ul>
<h2>1.5.0 ("Last Call")</h2>
<p>Saturday, May 30, 2026</p>
<ul>
<li>Whoever's hosting can pause the game. Bar run, bathroom break, or settling who's buying the next round. Everyone else sees a waiting screen, the dice stay put, and a paused game survives a phone going dark for up to an hour.</li>
<li>Your seat is held with a private token, so nobody can slip into your spot while you're reconnecting.</li>
<li>This changelog exists now. Hi. 👋</li>
</ul>
<h2>1.4.0 ("Happy Hour")</h2>
<p>Friday, May 29, 2026</p>
<ul>
<li>A hamburger menu on the game board. Empty for now, but the door's open. 🍔</li>
<li>Screen swaps don't stutter when you're already where you're headed.</li>
<li><em>Behind the scenes: we ran the game with a crowd of fake players and doubled the reconnect grace, so a busy night stays smooth.</em></li>
</ul>
<h2>1.3.0 ("On the Rocks")</h2>
<p>Thursday, May 28, 2026</p>
<ul>
<li>Your dice stay where they landed, even if you refresh or your phone naps. 😴</li>
<li>One loading screen for connecting and reconnecting alike. It hangs around a beat so it doesn't flicker at you.</li>
<li>Fixed the winner screen getting stuck, and fixed dice lumping together on a fresh game.</li>
<li>Twice as many random names to be assigned.</li>
<li><em>Behind the scenes: we started keeping score on every game so we can spot what makes nights fun and keep the dice fair.</em></li>
</ul>
<h2>1.2.0 ("Plugged In")</h2>
<p>Wednesday, May 27, 2026</p>
<ul>
<li>Lose signal and you get 30 seconds to get back in before the game gives up your seat.</li>
<li>Fixed a freeze when your re-roll landed on the exact same numbers. Spooky, but no longer sticky. 👻</li>
<li>Nobody sees your new dice until your roll animation finishes.</li>
<li>Share a link and it shows a proper Tensies preview card.</li>
</ul>
<h2>1.1.0 ("Making a Mark")</h2>
<p>Tuesday, May 26, 2026</p>
<ul>
<li>Tensies has a logo now, a pair of dice, and it's on the tab icon too.</li>
<li>The house rolls the dice. Your phone just shows them, so nobody can sweet-talk their own. 🎩</li>
</ul>
<h2>1.0.0 ("Opening Tab")</h2>
<p>Monday, May 25, 2026</p>
<ul>
<li>A bar regular and his friends love Tensies, the dice game. One night, a few heated rounds deep and drinks in, he figured it'd be great to play anywhere, even when somebody forgets the dice.</li>
<li>So he sketched the first board himself and started having Claude build it, tinkering from his barstool between rounds.</li>
<li>Ten dice and a target number. First to lock all ten wins. Roll with friends on your phones, invite them by link or text, and watch their progress live.</li>
<li>Dice that gather, shake, and scatter like the real thing, on a warm wood bar top, and it all works on an iPhone without the page wiggling around. 🍺</li>
<li><em>Behind the scenes: the history starts here because he forgot to git init until the game already worked. Classic.</em></li>
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
