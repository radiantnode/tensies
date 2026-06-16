# What's New in Tensies

Pull up a stool. Newest stuff up top.

## 1.15.0 ("The Regulars")

Monday, June 15, 2026

- Your profile page is live. Hit `/@username` to see lifetime stats, recent games, win rate, best time. Show it off or don't.
- Recent games on your profile show who you played, who won, how fast, with stacked avatars and a gold glow on the winner. Solo games don't show up.
- A gradient shimmer runs across the stat cards when the profile first loads. Once, then it's done. ✨
- The username pill in the header links to your profile from the landing and lobby. One tap to your stats.
- Fixed a bug where `total_games` was stuck at zero. Backfilled everyone's count from the actual game history.
- _Behind the scenes: data-repair scripts and prod config fixes keep the stats honest._

## 1.14.0 ("Wristband Night")

Sunday, June 14, 2026

- Signed-in players see their username pill next to the hamburger on every screen, in-game included.
- The changelog scrolls as one page, same as the menu panel. No more nested scrolling.
- iOS standalone users: screens fill edge-to-edge at the bottom, and nothing bleeds through behind the status bar. 📱
- _Behind the scenes: the README picked up some hero screenshots for GitHub._

## 1.13.0 ("VIP List")

Saturday, June 13, 2026

- Passkey sign-up is here. Tap, scan your face or fingerprint, done. Your anonymous stats carry over and you get a vanity URL. 🔑
- The onboarding screen shows your profile card, vanity link, and stats. Survives a refresh.
- Signed-in players skip the name field on the landing page. You're already you.
- Lobby Share and Play buttons sit side-by-side, with more room around Start.
- The landing dice logo wiggles when you arrive. Primary buttons picked up a shimmer sweep. Little things.
- Player list shows both YOU and HOST badges. You're always sorted to the top.
- _Behind the scenes: pixel baselines updated for the new auth and lobby states._

## 1.12.0 ("Karaoke Night")

Saturday, June 13, 2026

- The soundboard is a standalone tool for field-testing audio share. Tap through every voice the browser offers, record what you hear, export diagnostics. It went out for 6 sessions and 744 tests across beaches, bars, and a pool. 🎤
- _Behind the scenes: all the soundboard data and analysis are in the repo if you want to see what actually works when you chirp a game code through a phone speaker._

## 1.11.0 ("Jukebox")

Friday, June 12, 2026

- Tensies installs to your home screen. Launches standalone, no browser chrome.
- The lobby Share button opens AirDrop, Messages, WhatsApp, whatever your phone has. The SMS fallback is still there.
- Experimental: the lobby "Play" button chirps your game code through the speaker. A friend on the join screen taps "Listen" and their mic picks it up. Works best when it's not too loud. 🔊
- Turn your phone sideways and you'll get a nudge to rotate back. Portrait game.
- _Behind the scenes: the audio share got another round of tuning, louder transmission and better error correction to stretch the range._

## 1.10.0 ("Last Call")

Thursday, June 11, 2026

- The frontend got rebuilt from scratch: layered CSS, typed JS modules, one concern per file. Every screen was pixel-verified against the original at zero diff. If you spot anything different, that's a bug.
- Fixed the winner overlay closing early when an opponent's roll echo snuck in during the celebration.
- Dice scatter into place before the board paints, so there's no flash of nothing.
- The loading overlay holds until dice are rendered, then dissolves. No blank-board flicker.
- Safari: 3D dice no longer flatten during screen transitions. 🎲
- _Behind the scenes: the rewrite means future changes land without breaking something three files away._

## 1.9.1 ("Garnish")

Monday, June 8, 2026

- The winner overlay pops right after the scatter reveal. No extra beat of staring at the board.
- Prod gets a real asset pipeline: one bundled, minified file instead of a dozen loose modules. Faster first load. ⚡
- _Behind the scenes: nginx handles static files so the app server just runs the game._

## 1.9.0 ("Open Mic")

Sunday, June 7, 2026

- Join URLs are shorter: `tensies.app/ABCD` instead of `tensies.app/?join=ABCD`. Old links still work.
- Fixed the winner overlay flashing away when a broadcast landed mid-reveal. It stays put until the countdown finishes.
- Strict CSP and HSTS on every response. Your browser won't load anything we didn't put there. 🔒
- The nav menu stopped flashing on the loading screen.
- _Behind the scenes: abuse limits read the real client IP behind a proxy, and metrics endpoints require auth in dev too._

## 1.8.0 ("Vacation Pour")

Monday, June 1, 2026

- Game state lives in Redis. The server runs as multiple instances behind a load balancer, no sticky sessions. Your game keeps going if one instance restarts.
- A reaper sweeps up abandoned games and publishes the active count across instances.
- Security audit: Starlette and h11 bumped for CVEs, lockfile pinned, Docker image runs non-root.
- The frontend was rebuilt as web components. Each screen is its own element, the HTML shell is thin, and the loading screen paints before JS runs. Same design, new wiring. 🔧
- _Behind the scenes: a pixel-regression harness verified every view at zero diff before and after. 25 views, two viewports, all green._

## 1.7.0 ("Open Bar")

Sunday, May 31, 2026

- Everything got warmer. Landing, lobby, join, board, winner, loser: it all feels like the same bar.
- Dice look real. Soft edges, lit from the same direction as the wood underneath.
- The winner overlay is something to see. A 3D die flies at you, your name glows in gold, a countdown bar ticks to the next round.
- Losers get a cracked die. Black and broken. 💔
- The roll button looks like a leather coaster sitting on the bartop.
- Nav menu slides in from the hamburger. It has an About section and a "What's New" changelog (hi).
- Round target goes 1, 2, 3, 4, 5, 6. Ascending, the way you'd count.
- _Behind the scenes: Inter is self-hosted for consistent type across phones, and the player-list scroll fades took some real CSS work._

## 1.6.0 ("Saturday Sipper")

Saturday, May 30, 2026

- The host can pause the game. Good for a bar run, a bathroom break, or figuring out who's buying. ⏸️
- Non-host players see a "waiting for host" overlay while paused. The board stays live underneath so dice keep their places.
- If the host vanishes, another connected player gets promoted automatically.
- Paused games last up to an hour. If nobody comes back, the game ends on its own.
- Reconnect tokens: if your connection drops and you come back, the server recognizes you. No duplicate ghosts in the player list.
- The pause menu has a countdown, a connected-player count, and the resume toggle.
- _Behind the scenes: telemetry dashboards picked up a luck balance chart, per-game event logs, and a luckiest-players leaderboard._

## 1.5.0 ("Back Booth")

Friday, May 29, 2026

- Multiplayer got a stress test: a headless driver spins up hundreds of games to find leaks and race conditions. It found one. Fixed. 🧪
- The test harness runs two isolated browser profiles so each player has their own identity.
- _Behind the scenes: two SQL bugs in the telemetry pipeline were caught and fixed during the first automated run._

## 1.4.0 ("Double Shot")

Thursday, May 28, 2026

- Dice stay put when you refresh or your phone naps. Scatter positions are saved. 🎲
- A single loading screen replaces the old disconnect/reconnect dialogs. 600ms minimum so it doesn't blink in and out.
- The winner overlay no longer sticks around when a stray roll queues up during the celebration.
- Telemetry pipeline is running: rolls, wins, games, all flowing into Postgres and Grafana.
- The server, CSS, and JS each got split into proper packages. Nothing changed for you, but it made everything after this possible.
- _Behind the scenes: cache-busting covers the full module import graph, not just the entry scripts._

## 1.3.0 ("Whiskey Neat")

Wednesday, May 27, 2026

- Fixed a freeze when your re-roll landed on the exact same numbers. Rare, but it locked the game up.
- Other players' dice update in sync with the roller's reveal animation. No spoilers before the shake finishes.
- If your phone drops the connection, you get 30 seconds to come back. A reconnecting overlay holds your spot. 🔌
- The dice logo landed in the game header, overlapping the wordmark.
- Warmer in-game text, animated progress bars, and the bar background shifted to a better spot.
- _Behind the scenes: join errors show on the right screen, and a dice-tearing fix freezes the transform before clearing the animation._

## 1.2.0 ("Pint Glass")

Tuesday, May 26, 2026

- Dice rolls are server-authoritative. Everyone sees the same result.
- The dice logo and favicon give Tensies its own face in the browser tab. 🎲
- _Behind the scenes: the fairness engine got a quiet but real upgrade._

## 1.1.0 ("First Round")

Monday, May 25, 2026

- Invite friends with a tap. Share a link or send a text. 📲
- Dice physics: gather, shake, scatter, and they don't pile on top of each other. Matched dice lock in.
- The board looks like a bartop. Warm wood photo, soft shadows, lit from the top left.
- Players bar fits five, the join screen is separate, and random names fill in so nobody has to think.
- iOS plays nice: no scroll, no zoom, fast taps still register.
- _Behind the scenes: animations run on the GPU, placement uses a jittered grid, and static assets get cache-busted on deploy._

## 1.0.0 ("Opening Tab")

Monday, May 25, 2026

A bar regular and his friends love playing Tensies, the dice game. One night, a few rounds deep and drinks in, he thought it'd be great to play anywhere, even when you forget the dice. So he started having Claude build the game, sketched the first board himself, and kept tinkering from his barstool between rounds.

- Ten dice, one target number, fastest to lock all ten wins. Simple rules, good trash talk.
- Multiplayer over WebSockets: create a game, share the code, roll against your friends live.
- Your opponent sits up top, your dice down below, right where your thumbs are. 🍺

_Behind the scenes: the git history starts here because he forgot to `git init` until the game already worked._
