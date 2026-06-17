# What's New in Tensies

Pull up a stool. Newest stuff up top.

## 1.15.0 ("Last Call")

Wednesday, June 17, 2026

- The host can end the game from the menu. First tap says "Tap to confirm," second tap sends everyone home.
- When a game ends, both players see a scoreboard overlay with avatars, round wins, and a gold ring on whoever's ahead. Hit "Bummer!" to get back to the landing. 🎲
- Profile recent games got some polish. Better spacing, cleaner score glow.
- _Behind the scenes: the game-ended state persists through refresh so you don't lose the scoreboard if your phone hiccups._

## 1.14.1 ("Coaster Notes")

Tuesday, June 16, 2026

- _Behind the scenes: collected outside feedback and updated the status tracker. Nothing player-facing, just listening._

## 1.14.0 ("The Regulars")

Monday, June 15, 2026

- Your profile page is live at `/@username`. Lifetime stats, recent games, win rate, best time.
- Recent games show who you played, who won, and how fast. Stacked avatars, gold glow on the winner. Solo games don't show up.
- A gradient shimmer runs across the stat cards when the profile first loads. Once, then it's done. ✨
- The username pill in the header links straight to your profile from the landing and lobby.
- Fixed a bug where `total_games` was stuck at zero. Backfilled from actual game history.
- _Behind the scenes: data-repair scripts and prod config fixes keep the numbers honest._

## 1.13.0 ("Wristband Night")

Sunday, June 14, 2026

- Signed-in players see their username pill next to the hamburger on every screen, in-game included.
- The changelog scrolls as one page now, same as the menu panel.
- iOS standalone screens fill edge-to-edge at the bottom, and nothing bleeds through behind the status bar. 📱
- _Behind the scenes: the README got some hero screenshots for GitHub._

## 1.12.0 ("Backstage Pass")

Saturday, June 13, 2026

- Passkey sign-up is here. Tap, scan your face or fingerprint, done. Anonymous stats carry over and you get a vanity URL. 🔑
- The onboarding screen shows your profile card, vanity link, and stat history. Survives a refresh.
- Signed-in players skip the name field on landing. You're already you.
- The soundboard shipped as a standalone tool for field-testing audio share. It went out for 6 sessions and 744 tests across beaches, bars, and a pool.
- Lobby Share and Play buttons sit side-by-side with more room around Start.
- The landing dice logo wiggles when you arrive. Primary buttons picked up a shimmer sweep.
- Player list shows both YOU and HOST badges, and you're always sorted to the top.
- _Behind the scenes: pixel baselines updated for the new auth and lobby states, and all the soundboard data is in the repo._

## 1.11.0 ("Jukebox")

Friday, June 12, 2026

- Tensies installs to your home screen. Launches standalone, no browser chrome.
- The lobby Share button opens AirDrop, Messages, WhatsApp, whatever your phone offers. SMS fallback still works.
- Experimental: the lobby "Play" button chirps your game code through the speaker. A friend taps "Listen" on the join screen and their mic picks it up. Works best when it's not too loud. 🔊
- Turn your phone sideways and you'll get a nudge to rotate back. Portrait game.
- _Behind the scenes: the audio share got another round of tuning for louder transmission and better error correction._

## 1.10.0 ("Fresh Coat")

Thursday, June 11, 2026

- The whole frontend got rebuilt from scratch. Layered CSS, typed JS modules, one concern per file. Every screen was pixel-verified against the original at zero diff. If you spot anything different, that's a bug.
- Fixed the winner overlay closing early when an opponent's roll echo snuck in during the celebration.
- Dice scatter into place before the board paints, so there's no blank flash.
- The loading overlay holds until dice are rendered, then dissolves.
- Safari stopped flattening the 3D dice during screen transitions. 🎲
- _Behind the scenes: the rewrite means changes land without quietly breaking something three files away._

## 1.9.2 ("Bar Back")

Wednesday, June 10, 2026

- _Behind the scenes: documentation cleanup, test tooling sharpened, and the groundwork laid for the frontend rebuild that shipped the next day._

## 1.9.1 ("Garnish")

Monday, June 8, 2026

- The winner overlay pops right after the scatter reveal. You don't sit there staring at the board anymore.
- Prod gets a real asset pipeline. One bundled, minified JS file instead of a dozen loose modules. Faster cold load. ⚡
- _Behind the scenes: nginx handles static files so the app server just runs the game._

## 1.9.0 ("Open Mic")

Sunday, June 7, 2026

- Join URLs are shorter: `tensies.app/ABCD` instead of `tensies.app/?join=ABCD`. Old links still work.
- Fixed the winner overlay flashing away when a broadcast landed mid-reveal. It stays put until the countdown finishes now.
- Strict CSP and HSTS on every response. Your browser won't load anything we didn't serve. 🔒
- The nav menu stopped flashing on the loading screen.
- _Behind the scenes: abuse limits read the real client IP behind a proxy, and metrics require auth in dev too._

## 1.8.0 ("Vacation Pour")

Monday, June 1, 2026

- Game state lives in Redis now. The server can run as multiple instances behind a load balancer, no sticky sessions needed. Your game keeps going if one instance restarts.
- A reaper cleans up abandoned games and publishes the active count across instances.
- Security pass: Starlette and h11 bumped for CVEs, lockfile pinned, Docker image runs non-root.
- The frontend was rebuilt as web components. Each screen is its own element. The loading screen paints before JS even runs. Same design, better wiring. 🔧
- _Behind the scenes: a pixel-regression harness verified every view at zero diff. 25 views, all green._

## 1.7.0 ("Open Bar")

Sunday, May 31, 2026

- Everything got warmer. Landing, lobby, join, board, winner, loser. It all feels like the same bar now.
- Dice look real. Soft edges, lit from the same direction as the wood underneath.
- The winner overlay is something to see. A 3D die flies at you, your name glows in gold, and a countdown bar ticks to the next round.
- Losers get a cracked die. Black and broken. 💔
- The roll button looks like a leather coaster sitting on the bartop.
- Nav menu slides in from the hamburger with an About section and a "What's New" changelog (hi).
- Round target goes 1, 2, 3, 4, 5, 6. Ascending, the way you'd count.
- _Behind the scenes: Inter is self-hosted for consistent type across phones, and the scroll fades on the player list took some real CSS._

## 1.6.0 ("Saturday Sipper")

Saturday, May 30, 2026

- The host can pause the game. Good for a bar run, a bathroom break, or settling who's buying the next round. ⏸️
- Non-host players see a "waiting for host" overlay while paused. The board stays live underneath.
- If the host disappears, another connected player gets promoted.
- Paused games survive up to an hour. If nobody returns, the game ends on its own.
- Reconnect tokens work now. Drop and come back, the server knows it's you.
- The pause menu has a countdown, connected-player count, and the resume toggle.
- _Behind the scenes: telemetry dashboards picked up a luck balance chart, per-game event logs, and a luckiest-players leaderboard._

## 1.5.0 ("Back Booth")

Friday, May 29, 2026

- Multiplayer got a stress test. A headless driver spins up hundreds of games looking for leaks and race conditions. It found one. Fixed. 🧪
- The test harness runs two isolated browser profiles so each player keeps their own identity.
- _Behind the scenes: two SQL bugs in the telemetry pipeline were caught and fixed during the first automated run._

## 1.4.0 ("Double Shot")

Thursday, May 28, 2026

- Dice stay put when you refresh or your phone naps. Scatter positions are saved. 🎲
- A unified loading screen replaces the old disconnect and reconnect dialogs. 600ms minimum so it doesn't blink in and out.
- The winner overlay stopped sticking around when a stray roll queued during the celebration.
- Telemetry is running. Rolls, wins, games, all flowing into Postgres and Grafana.
- The server, CSS, and JS each got split into proper packages. Same game, cleaner foundation.
- _Behind the scenes: cache-busting covers the full ES module import graph, not just the entry scripts._

## 1.3.0 ("Whiskey Neat")

Wednesday, May 27, 2026

- Fixed a freeze when your re-roll landed on the exact same numbers. Rare, but it locked the whole game up.
- Other players' dice update in sync with the roller's reveal animation now. You won't see the result before the shake finishes.
- If your phone drops the connection, you get 30 seconds to come back. A reconnecting overlay holds your spot. 🔌
- The dice logo landed in the game header, overlapping the wordmark.
- Warmer in-game text, animated progress bars, bar background shifted to a better focal point.
- _Behind the scenes: join errors route to the right screen now, and a dice-tearing fix freezes the transform before clearing the animation._

## 1.2.0 ("Pint Glass")

Tuesday, May 26, 2026

- Dice rolls are server-authoritative. Everyone sees the same result.
- The dice logo and favicon give Tensies its own face in the browser tab. 🎲
- _Behind the scenes: the fairness engine is quiet but real._

## 1.1.0 ("First Round")

Monday, May 25, 2026

- Invite friends with a tap. Share a link or fire off a text. 📲
- Dice physics: gather, shake, scatter, and they never pile on top of each other. Matched dice lock in.
- The board looks like a bartop. Warm wood photo, soft shadows, lit from the top left.
- Players bar fits five, the join screen is its own page, and random names fill in so nobody has to think.
- iOS plays nice. No scroll, no zoom, fast taps still register.
- _Behind the scenes: animations run on the GPU, placement uses a jittered grid, and static assets get cache-busted on deploy._

## 1.0.0 ("Opening Tab")

Monday, May 25, 2026

A bar regular and his friends love playing Tensies, the dice game. One night, a few rounds deep and drinks in, he thought it'd be great to play anywhere, even when you forget the dice. So he started having Claude build the game, sketched the first board himself, and kept tinkering from his barstool between rounds.

- Ten dice, one target number, fastest to lock all ten wins. Simple rules, good trash talk.
- Multiplayer over WebSockets. Create a game, share the code, roll against your friends live.
- Your opponent sits up top, your dice down below, right where your thumbs are. 🍺

_Behind the scenes: the git history starts here because he forgot to `git init` until the game already worked._
