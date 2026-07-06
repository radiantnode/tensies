# The Fable 5 Review — Tensies

*Written 2026-07-05 by Claude Fable 5, at Michael's request, after six weeks of Tensies being built with Claude Opus 4.6–4.8 (and lately, me).*

## What this is

A full outside-in review of the project: the code, the architecture, the security posture, the game itself, the git history, and — because you asked — the way you and Claude have been working together. I ran six deep, independent review passes (backend/distributed-systems, security, frontend, gameplay math, project history, and your session transcripts + memories) and read the load-bearing files myself. Everything below is verified against the actual code or the actual transcripts; nothing is vibes.

## The files

| File | What's in it |
|---|---|
| [01-technical-soundness.md](01-technical-soundness.md) | The backend and distributed-systems review. Two real bugs, several concerns, a lot of earned praise. |
| [02-security.md](02-security.md) | Security posture, WebAuthn/JWT/reconnect-token analysis, findings with exploit scenarios. |
| [03-frontend.md](03-frontend.md) | The no-framework frontend: architecture, CSS layers, the animation state machine, one genuine markup bug, and the strict-JS claim that doesn't hold. |
| [04-gameplay.md](04-gameplay.md) | The actual math of a round (E[rolls] = 16.56), skill vs luck, why `delayed_broadcast` is a game-feel decision, and five concrete design ideas. |
| [05-history.md](05-history.md) | The story: 643 commits in 42 days, sixteen eras, two full rewrites, the winner-overlay saga, and the 19,136-line soundboard commit. |
| [06-collaboration.md](06-collaboration.md) | How you work with Claude, from the transcripts: 1,706 messages, 125 "restart"s, the trust arc from co-pilot to dispatcher. |
| [07-observations-and-advice.md](07-observations-and-advice.md) | Cross-cutting observations, anecdotes, the priority fix list, and honest advice. |
| [08-post-review-fixes.md](08-post-review-fixes.md) | What was actually fixed (commit links to PR #58), production rollout notes, things to watch, and a reflection on the feedback→fix loop. |

## The general review

Tensies is the best solo hobby project I have reviewed, and I don't say that to flatter — I say it because the evidence is unusual and specific.

**The hard parts were built once and left alone.** `server/gamestore.py` has been touched 4 times since the June 1 Redis migration. `fanout.py`, twice. `game.py` — the pure core — 9 times in six weeks. Meanwhile `overlays.css` was touched 52 times and `index.html` 95 times. That churn profile is exactly what a healthy codebase looks like: the distributed-systems foundation was designed carefully, verified with real multi-instance tests, and then trusted, while the feel was sanded continuously. Most projects have the inverse profile, and it kills them.

**The reasoning is written down next to the code, and it's almost always true.** The codebase's comments don't describe what the next line does; they record measured facts ("observed at 1153ms and 759ms instead of the full ~3s"), rejected alternatives ("4096 would buy ~3 dB of bin SNR but its 85 ms window never fits inside the 70 ms separator slot"), and load-bearing invariants (the paused-branch ordering in `showFor`, the "first Math.random consumer" pin). I checked the claims against the code repeatedly across six passes. They held, with exactly one exception — the "strict-checked JS" claim, which is currently 31 `tsc` errors from being true. That one exception is itself informative: it's the only invariant in the repo with no enforcement mechanism behind it. Everything that's enforced (pixel harness, Lua CAS, test-game suite) stayed true; the one thing on the honor system drifted. There's a lesson there, and it's in file 07.

**The engineering taste is consistently right-sized.** No framework, but keyed reconciliation where it matters. No ORM, but parameterized SQL everywhere. No Kubernetes, but genuinely correct multi-instance operation over Redis with idempotent timers and a reaper backstop. The one contended write in the whole game — who won the round — is an atomic Lua compare-and-set, and the design note explaining why *nothing else* needs one is accurate. When the project needed something exotic (provably fair dice, acoustic code transfer), it built the simple version of the exotic thing rather than the exotic version of a simple thing.

**Where it actually falls short:** the review found two real backend bugs (both in the multi-instance backstop layer — the reaper defeats the post-resume reconnect grace, and `games:index` leaks capacity forever when a game TTL-expires), one real frontend markup bug (a missing `>` that eats the score styling on profile pages), a latent XSS trap that will spring the day profile editing ships, an unauthenticated `legacy_pid` stat-transfer that two independent review passes flagged, and a gameplay fairness gap where `prefers-reduced-motion` roughly doubles your win rate. The full ranked list is in file 07. None of it is structural. All of it is fixable in an afternoon or two.

**And the game is good.** The math says a round is a fast, generous start that decays into a lone-die coin-flip grind 91.5% of the time — which is precisely the screaming-at-the-bar tension curve you'd want, arrived at (I suspect) by feel rather than by math. The math also says the game has no match-level arc at all, and file 04 has concrete, small-diff ideas about that.

## How this review was conducted

Six independent review passes ran in parallel, each reading the relevant code/history/transcripts in full and verifying every claim before reporting. I then read `game.py`, `broadcast.py`, `audio-share.js`, and the changelog myself, cross-checked the passes against each other, and wrote these files. Findings that two passes reached independently (there were several) are flagged where they occur — those are the ones to trust most.
