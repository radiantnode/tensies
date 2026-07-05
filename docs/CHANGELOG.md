# What's New in Tensies

Pull up a stool. Newest stuff up top.

## 1.18.0 ("Cherry on Top")

Wednesday, June 24, 2026

- The roll button is a big floating circle now. Easier to find, easier to tap.
- When it's not your turn, the button pulses with a rotating glow so you know it's alive. 🫧
- Fresh app icons everywhere, so Tensies looks right on your home screen and share sheet.
- _Behind the scenes: tightened tap targets and scoped visual effects to keep the board clean._

## 1.17.1 ("Rim Salt")

Tuesday, June 23, 2026

- Share links look better. When you text someone a Tensies link, the preview card actually does its job.
- Fixed the share icon on iOS so it shows up where it belongs. 📱
- _Behind the scenes: tidied up how pages present themselves to search engines and social previews._

## 1.17.0 ("Pocket Pour")

Sunday, June 21, 2026

- An animated walkthrough shows you how to add Tensies to your home screen, step by step. 🏠

## 1.16.1 ("Well Drink")

Saturday, June 20, 2026

- Fixed a bug where the standings on your profile showed players in the wrong order. Your wins are your wins. 🏆
- _Behind the scenes: bumped every dependency, added automated security scanning, set up a CI gate._

## 1.16.0 ("The Group Chat")

Friday, June 19, 2026

- When a game ends, you land on the game's detail page instead of a throwaway overlay. Your scoreboard sticks around.
- Got a Discord server? Tensies can post game updates there: who joined, who won, round by round.
- There's a /verify command in Discord too, so anyone can check that the dice were fair without leaving the chat. 🎲

## 1.15.0 ("House Rules")

Thursday, June 18, 2026

- Your profile has a bio and location field now.
- Every roll is backed by a distributed randomness beacon (drand), which means you can mathematically prove the dice weren't rigged. Not that you'd accuse your friends of anything. 🛡️
- Each game has its own page at /games/CODE with a Roll Trust section. Tap the shield to see the cryptographic proof.
- _Behind the scenes: the randomness verification runs end to end, from the beacon to the roll to the proof page._

## 1.14.0 ("Closing Time")

Wednesday, June 17, 2026

- Hosts can end the game. When it's over, everyone sees a scoreboard with final standings, avatars, and bragging rights. 🍻
- The game-ended screen survives a refresh, so you can't lose your receipts.
- _Behind the scenes: tuned profile recent games to count everyone who actually showed up._

## 1.13.1 ("Napkin Notes")

Tuesday, June 16, 2026

- _Behind the scenes: reviewed outside feedback on the codebase, sharpened a few things based on what held up._

## 1.13.0 ("Bar Card")

Monday, June 15, 2026

- You've got a public profile at /@yourusername with your stats, avatar, and recent games. Show it off or don't. 🪪
- Your username pill on the landing and lobby links straight to your profile.
- Signing in works everywhere now, including prod.
- _Behind the scenes: wrote data repair scripts to backfill stats for players who were rolling before accounts existed._

## 1.12.0 ("Regular's Tab")

Sunday, June 14, 2026

- You can create an account with a passkey. No passwords, no email, just your fingerprint or face. Your stats carry over from anonymous games. 🔑
- Once signed in, your name shows up in a pill in the header.
- The changelog scrolls as one smooth page now instead of fighting with the menu panel.
- Fixed a gap at the bottom of the screen on iOS when running from the home screen.

## 1.11.0 ("Jukebox")

Saturday, June 13, 2026

- The dice on the landing screen wiggle. They're happy to see you. 🎲
- Buttons have a shimmer sweep that catches the light. Looks good in a dim bar.
- Share and Play sit side by side in the lobby so inviting friends is faster.
- Player badges (YOU, HOST) both show up now, and you're always sorted to the top.
- _Behind the scenes: built a standalone soundboard tool for field-testing the audio code share across different phones._

## 1.10.0 ("On Tap")

Friday, June 12, 2026

- Tensies is installable. Add it to your home screen and it launches full screen, like a real app. 📲
- The invite button uses your phone's native share sheet, so you can text, AirDrop, whatever.
- Turn your phone sideways and you'll see a "rotate your phone" screen instead of a sideways mess.
- Experimental: the lobby has a Play button that chirps your game code as audio, and a Listen button that decodes it. Hold your phones close.

## 1.9.0 ("Same Round, New Glass")

Thursday, June 11, 2026

- Fixed a bug where the winner overlay could flash away if another player's roll came in at the wrong moment.
- Dice land in their scattered positions before the board paints, so they don't snap into place after the fact.
- Safari users, the 3D dice stay 3D during screen transitions now. They were going flat. 🧊
- The loading screen holds until your dice are actually rendered, then dissolves.
- _Behind the scenes: rebuilt the entire frontend from scratch with stricter code organization. Every view was pixel-verified against the original._

## 1.8.1 ("Bar Back")

Wednesday, June 10, 2026

- _Behind the scenes: overhauled dev tooling and session bootstrapping. Pinned browser versions for consistent test results._

## 1.8.0 ("Quick Pour")

Monday, June 8, 2026

- The winner overlay pops up right after the dice scatter instead of waiting for a stale animation. Faster bragging rights. 👑
- _Behind the scenes: added a build pipeline that bundles, minifies, and fingerprints every asset. Prod loads are leaner._

## 1.7.0 ("Bouncer")

Sunday, June 7, 2026

- Fixed a bug where the winner overlay would flash away if a broadcast landed mid-reveal. Your moment of glory stays put.
- Join links are cleaner. tensies.app/ABCD instead of tensies.app/?join=ABCD. 🔗
- _Behind the scenes: strict security headers (CSP, HSTS), nginx in front for prod, metrics endpoints locked down._

## 1.6.0 ("Open Bar")

Monday, June 1, 2026

- Games can run across multiple servers now, sharing one Redis backend. Tensies can handle a packed house. 🍺
- Security got a tune-up: patched dependencies, locked down the container, added abuse guards.
- The frontend was rewritten into web components, pixel-identical to what you know. Same look, better architecture.
- _Behind the scenes: all game state lives in Redis now so any server can pick up any game. Built from a barstool in Cap Cana, Dominican Republic._

## 1.5.0 ("Happy Hour")

Sunday, May 31, 2026

- Everything looks warmer. The landing page, the lobby, the buttons, the fonts, all of it got redecorated.
- The dice are properly 3D now, lit to match the bar. They look like real dice on real wood.
- Losers see cracked dice on the round-end screen. Winners get a glowing 3D die flying at them with their name in gold. You earned it. 💀
- There's a nav menu now (hamburger on the landing page) with an About section and a What's New panel.
- Rounds count up (1, 2, 3, 4, 5, 6, repeat) instead of down. Feels more natural.
- _Behind the scenes: self-hosted the Inter font, rebuilt overlays and status elements to match the warm aesthetic._

## 1.4.0 ("Last Call")

Saturday, May 30, 2026

- Hosts can pause the game. Perfect for a bar run, a bathroom break, or settling who's buying the next round. Everyone else sees a "waiting for the host" screen while the board stays live underneath. ⏸️
- If the host's phone dies during a pause, another player gets promoted so the crew isn't stuck. If nobody comes back for an hour, the game wraps itself up.
- Reconnect uses a private token now, so nobody can hijack your seat.
- _Behind the scenes: tuned the dashboards and started tracking more per game to keep matches fair._

## 1.3.0 ("Cocktail Menu")

Friday, May 29, 2026

- There's an in-game menu now. Tap the hamburger to open it. It's the skeleton for bigger things, but it's there. 🍔
- _Behind the scenes: built out analytics dashboards and the test harness._

## 1.2.0 ("Coaster")

Thursday, May 28, 2026

- Your dice stay put now, even if you refresh or your phone naps. 🛋️
- There's a proper loading screen instead of the old disconnect/reconnect dialogs. It tells you what's happening.
- Fixed a bug where the winner overlay could stick around and block the next round.
- _Behind the scenes: split the codebase into modules, added a telemetry pipeline, started tracking game events._

## 1.1.0 ("Designated Driver")

Wednesday, May 27, 2026

- If your phone drops the connection, you've got 30 seconds to get back in. A little overlay lets you know it's trying. 🔌
- Other players see the dice change at the right moment now, synced with the roller's animation instead of spoiling the reveal.
- Fixed a freeze when your re-roll landed on the exact same numbers. Spooky, but gone.
- The game header got a dice logo, warmer text, and animated progress bars.
- Tensies link previews look good now. OG tags and a proper card image.
- _Behind the scenes: dice rolls are server-authoritative, so nobody can cheat from the client side._

## 1.0.1 ("Garnish")

Tuesday, May 26, 2026

- Tensies has a logo. A pair of dice, as the favicon and app icon. 🎲
- _Behind the scenes: moved dice rolling to the server so every roll is legit._

## 1.0.0 ("First Round")

Monday, May 25, 2026

- A bar regular and his friends love playing Tensies, the dice game. One night, a few heated rounds deep and drinks in, he thought it'd be great to play anywhere, even when you forget the dice. So he started having Claude build the game, sketched the very first game board himself, and kept tinkering on it from his barstool, chatting with Claude between rounds.
- The whole game was already built before anyone remembered to type git init. By the time the first commit landed, you could create a game, invite friends with a link or a text, roll your dice with physics and animations, and watch your opponents in real time. Ten dice, one target, first to lock them all wins the round.
- iOS friendly from the start. No scroll, no zoom, rapid taps all register. Five players fit at the bar at once. 🍺
- _Behind the scenes: the git history starts at "Initial commit" but the game was already a whole thing. Classic "I'll set up version control later" energy._
