# Tensies — Grok Gameplay & UX Review

**Date:** 2026-06-16

A two-turn exchange reviewing Tensies gameplay and UX. Grok produced a general
review framing the app against physical Tenzi; Claude Code verified each
technical claim against the codebase and returned a calibrated second opinion.

**Participants:**
- **Grok** — original gameplay/UX review
- **Claude Code** — second-opinion verification against the repository

---

## Turn 1 — Grok

> #### More Critical Review: Gameplay & UX of Tensies
>
> The digital adaptation captures the chaotic, social energy of physical **Tenzi** (the real game it's based on) reasonably well on paper, but falls short in several key areas that matter most for a fast, rowdy, bar-style dice game. The engineering shine masks some fundamental gameplay and UX friction that would frustrate repeated play sessions, especially with drunk or competitive friends.
>
> #### Core Gameplay Loop Critique
>
> **Strengths**:
> - Simultaneous rolling with synchronized reveals (via `roll_done` ack) preserves the "no peeking" tension nicely.
> - Auto-locking matching dice + cycling targets (1-6) stays faithful to the physical game.
> - First-to-10 locked dice wins the round, with overall session scoring.
>
> **Big Issues**:
> - **Pacing feels off compared to physical Tenzi**. In real life, you roll as fast and often as you want, grabbing and rerolling non-matches instantly without waiting for anyone. Here, the digital version enforces turn-like structure around the shared target and broadcast waits. This introduces artificial delays that kill the frantic "everyone rolling simultaneously in a frenzy" magic. The reveal synchronization, while fair, adds latency that physical play doesn't have.
>
> - **Lack of player agency in target selection**. Real Tenzi lets each player independently choose their target based on their first roll (e.g., go for the number you have the most of). The digital version uses a shared cycling target. This simplifies multiplayer sync but removes strategic depth and the "I got lucky with fives!" excitement. It turns a game of opportunistic greed into more of a pure luck race against the shared number.
>
> - **Dice interaction feels passive**. CSS 3D dice with physics-like scatter and lock animations look cool initially, but players can't freely manipulate or reroll individual dice on their own schedule. Everything funnels through the "Roll" button and server-mediated state. This loses the tactile, chaotic physicality that makes Tenzi addictive.
>
> - **Round structure rigidity**: No mention of variants (like Tower or Splitzi common in Tenzi) or easy ways to customize. Sessions rely on "most round wins" which works but can drag if one player dominates early.
>
> #### UX & Feel Critiques (The Bar/Beach Reality Check)
>
> **Visual & Haptic Strengths**: The bar-top aesthetic, persistent dice positions, and animated locks are thoughtful. Mobile-first touch handling and PWA support are smart for real-world use.
>
> **Pain Points**:
> - **Button-heavy flow in a high-energy setting**. Needing to tap "Roll" repeatedly (with potential network lag) is nowhere near as satisfying as physically slamming dice. In a loud bar, small UI elements or subtle feedback could get missed. The "hold until everyone acknowledges" reveal mechanic, while technically impressive, can feel like the game is pausing to babysit slower players/animations.
>
> - **Information overload vs clarity**. With up to 5 players, tracking everyone's progress on a small phone screen (common in group play) likely gets cluttered. Leaderboard or progress indicators might compete with the dice themselves for attention. Public profiles and stats are nice additions but feel like scope creep away from pure "let's just roll" fun.
>
> - **Social & Accessibility Friction**:
>   - Host dependency and handoff are clever but add cognitive load ("who's host now?").
>   - Audio sharing is a fun gimmick but niche and potentially unreliable in noisy environments.
>   - Reconnect/pause features are robust, but mid-round disconnects still disrupt the group's flow more than in physical play.
>   - Passkey auth is modern but overkill for a pickup game—many groups will just want anonymous quick-join without accounts.
>
> - **Mobile/Bar Practicality**: On smaller screens or with greasy fingers/drinks nearby, precise interactions with scattered dice could frustrate. No obvious "big mode" or simplified view for chaotic play.
>
> #### Overall Verdict on Gameplay/UX
>
> **6.5-7/10** — It successfully digitizes the rules but doesn't fully replicate (or improve upon) the visceral, low-friction joy of physical Tenzi. The added polish (animations, sync, scaling) comes at the cost of speed and raw chaos that make the original great at "ruining friendships." It's best as a convenient backup when no dice are available, but won't replace the real thing for dedicated groups.
>
> **Recommendations to Claude (Critical Focus)**:
> - **Loosen the structure**: Add optional "free-roll" mode or per-player targets with visual indicators for who is going for what.
> - **Speed up the loop**: Minimize mandatory waits; make animations skippable or parallel where possible.
> - **Amplify tactility**: Bigger hit areas, vibration feedback, faster roll button, sound effects that scale with intensity.
> - **Simplify for parties**: One-tap anonymous join as default, bigger visuals, optional minimal UI mode.
> - **Test ruthlessly in context**: Simulate loud bar (noise, multiple phones, drinks) and measure actual fun/drop-off after 5-10 rounds.
>
> The engineering is impressive, but gameplay/UX is where the soul lives. Right now, it's a very competent simulation that needs more of the reckless energy of the original to truly shine. Prioritize "feels right in hand" over more features.

---

## Turn 2 — Claude Code (second opinion)

### Overall verdict

This is a game-design opinion piece, not a technical review. It reads like Grok
was given the architecture docs but never ran the app or read most of the code.
The central technical claim — that the game "enforces turn-like structure" with
broadcast waits that block players — is factually wrong. Several other claims
are wrong or half-right. The design critiques treat every difference from
physical Tenzi as a defect rather than a deliberate adaptation to multiplayer
digital play.

The rating (6.5–7/10) judges the app for not being physical dice, which isn't a
useful bar for a digital game.

### Claims verified as correct

**Shared cycling target.** CONFIRMED. `server/game.py:46` — `next_target()`
cycles 1→6→1. All players share the same target. Physical Tenzi does let each
player pick their own number. This is a deliberate design choice for head-to-head
racing, not an oversight — per-player targets would remove the direct competition.
The "strategic depth" of picking a number in physical Tenzi amounts to one
glance at your first roll; after that it's pure luck either way.

**Single Roll button.** CONFIRMED. `static/js/roll.js` — one `roll()` function,
one button. Auto-locking (`server/game.py:50`, `apply_roll`) handles keeper
selection automatically, which is actually *faster* than the physical equivalent
of sorting dice by hand.

**No haptic/vibration feedback.** CONFIRMED. Zero `navigator.vibrate` calls
anywhere in `static/`. The `audio-share.js` module is FSK code-sharing only,
not gameplay sound effects. This is the review's most useful concrete
observation.

**Passkey auth exists.** CONFIRMED, but the claim that it's "overkill" is
wrong — it's **entirely optional**. Anonymous quick-join is the default path.
`static/js/auth.js` + `server/auth.py` provide WebAuthn for players who want
persistent profiles; nobody is forced through it.

**Profiles and stats exist.** CONFIRMED. `static/js/components/profile-screen.js`,
`server/routes.py:64`. But `/stats` endpoints are **bearer-gated**
(`server/routes.py:37-46`), not "public" as the review implies.

**No game variants.** CONFIRMED as a feature gap. Tower, Splitzi, etc. are real
Tenzi variants that don't exist here. Fair observation, but it's a feature
request, not a defect.

### Where the review is wrong

**"Hold until everyone acknowledges" / "babysits slower players."** WRONG — the
most misleading claim. `delayed_broadcast` (`server/broadcast.py:66-97`) waits
for the **roller's own** `roll_done` ack only, not everyone's. Timeout is 2s
(`ROLL_ACK_TIMEOUT`). The broadcast uses `exclude=pid` (line 97) — the roller
already has their result; peers get it once the roller's animation finishes or
the timeout fires. Other players' rolls are completely independent and
concurrent. There is no "babysitting."

**"Enforces turn-like structure."** WRONG. Rolling is simultaneous. Each player
hits Roll whenever they want, gated only by a 250ms rate limit
(`MIN_ROLL_INTERVAL`, `server/config.py:50`). The shake animation is ~500-700ms
(`animations.js:24-26`), the scatter is 320ms (`animations.js:89`). A player
can roll roughly every second — faster than most people can physically grab,
sort, and throw dice. There is no turn order, no waiting for other players.

**"Up to 5 players."** WRONG. `MAX_PLAYERS_PER_GAME` is **20**
(`server/config.py:80`).

### What the review missed

The review never mentions the **pause system, host transfer, or reconnect
robustness** — the features that actually make this work at a bar. Someone's
phone dies, someone walks away, the host goes to get drinks — these are the hard
engineering problems for real-world multiplayer, and they're solved thoroughly
(`server/broadcast.py:146-207`, the paused-host-transfer path, the 1-hour pause
cap with graceful teardown).

No mention of the **View Transitions choreography**, the staged reveal system,
or **reduced-motion support** (`animations.js:20` respects
`prefers-reduced-motion`). The "amplify tactility" recommendation ignores that
the animation system is already carefully sequenced.

The "test ruthlessly in context" recommendation ignores that this **has
happened** — the project has a Playwright-based multiplayer test harness,
pixel-regression baselines at mobile viewport, documented test runs, and an
audio-share over-air test technique for real speaker→mic scenarios.

### Where I'd soften (agree but lower stakes)

**Round-win delay.** The `ROUND_WIN_DELAY` of 3s (`server/config.py:53`) is the
longest mandatory wait. A "tap to skip" on the winner overlay would shave 1-2s.
Worth considering as a quality-of-life tweak.

**Bigger hit areas in bar conditions.** The roll button is already the largest
tap target on screen, but wet/greasy fingers in a bar are real. Low priority,
but not wrong.

**Vibration on roll.** A single `navigator.vibrate(50)` on the roll tap would
be a genuinely nice touch. One-line change, real tactile payoff.

### Recommended priority (if anything were implemented)

| # | Item | Value | Effort |
|---|------|-------|--------|
| 1 | Haptic vibration on roll | Tactile feedback, trivial | One line |
| 2 | Skippable winner overlay | Shaves 1-2s per round | Small |
| 3 | Game variants (per-player target mode) | Replayability | Large — new game mode |
| 4 | Sound effects | Atmosphere | Medium — assets + integration |

### Bottom line

The review gets its central claim wrong (the game is not turn-based and does not
wait for all players) and judges a digital multiplayer game for not being a pile
of physical dice. The three genuinely useful observations are: haptic feedback is
absent, the round-win delay could be skippable, and game variants would add
depth. Everything else is either factually incorrect, already handled, or a
philosophical preference for a different game.

---

## Decision rationale

The owner chose to record the transcript without implementing any changes. The
review's factual errors on the core gameplay loop (turn-based framing, broadcast
blocking, player count) undermine confidence in its recommendations, and the
design opinions it does get right (haptic feedback, variants) are nice-to-haves
that don't address urgent needs. The three small wins (vibration, skippable
overlay, variants) are noted here for future consideration but deferred.

**Deferred items:**
- Haptic vibration on roll (`navigator.vibrate`)
- Skippable winner overlay (tap-to-advance)
- Game variant modes (per-player targets, Tower, Splitzi)
- Gameplay sound effects
