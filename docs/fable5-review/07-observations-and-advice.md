# Observations, Anecdotes & Advice

## The priority fix list

Everything actionable from files 01–04, ranked by my judgment of (impact × likelihood ÷ effort):

| # | Fix | Where | Effort |
|---|---|---|---|
| 1 | `SREM` orphaned codes from `games:index` in the reaper | `server/reaper.py:49-52` | 1 line |
| 2 | Re-stamp `disconnected_at_ms` on pause resume | `server/ws.py:398-406` | ~3 lines |
| 3 | Add a `tsc --noEmit` job to CI and fix the 31 errors (declare `gameJustEnded`, add `auth_ok` to `types.js`) | `.github/workflows/ci.yml`, `static/js/` | an afternoon |
| 4 | Close the recent-game template's missing `>` | `profile-screen.js:246` | 1 char |
| 5 | Guard `legacy_pid`: reject pids that are an existing `users.id` or already-claimed `users.legacy_pid` (+ unique index); open claiming of unclaimed anonymous pids stays, per decision | `server/auth.py:246-252` | small |
| 6 | Escape/`textContent` the profile & game-detail interpolations — **before** any profile-edit feature | `profile-screen.js`, `game-detail-screen.js` | small |
| 7 | Raise `MIN_ROLL_INTERVAL` to ~1.0 s + floor the reduced-motion roll cycle | `config.py`, `animations.js` | small |
| 8 | Client-side deadline on `tryReveal` polling + surface in-game error frames | `animations.js:183`, `net.js:357` | small |
| 9 | Reaper: run host-handover for paused games; CAS the pause-cap ending | `reaper.py`, `broadcast.py` | medium |
| 10 | Rate-limit `/auth/*`, de-oracle the 404/409 responses | `server/auth.py` | small |
| 11 | Exempt `.menu-item` from the touch guard's second-tap swallow (End Game tap-to-confirm) | `touch.js:22-27` | small |
| 12 | Guard the lobby list's `appendChild` like the players bar | `lobby-screen.js:144` | small |

Items 1, 2, 4 are the "do these while the coffee brews" tier. Item 3 is the highest-leverage process fix in the repo (see below).

## The one lesson I'd frame and hang on the wall

Across six review passes, **every claim in this repo backed by an enforcement mechanism turned out to be true, and the single claim on the honor system turned out to be false.**

- "Pixel-identical rewrite" — enforced by the harness at `maxDiffPixels: 0`. True.
- "Only one contended write" — enforced by Lua CAS. True.
- "Never await on the telemetry path" — enforced by `emit()` being sync. True.
- "All frames go through `send()`" — enforced by there being no other send site. True.
- "Strict-checked JS" — enforced by… nothing. CI never runs `tsc`. **31 errors.**

You already know this lesson — it's why the pixel harness exists — but the type checker slipped through the gap between knowing it and applying it everywhere. The general rule: when you write a claim into CLAUDE.md, ask "what breaks CI if this stops being true?" If the answer is nothing, either add the mechanism or soften the claim.

## Cross-cutting observations

**Two independent passes found the same hole.** The security review and the backend review each independently flagged the unauthenticated `legacy_pid` transfer, with the same observation: pids are broadcast to every co-player in `state_msg`, which is *the exact leak* the reconnect-token design note in `game.py` warns about. The repo literally contains the correct threat analysis — the auth path just didn't apply it. When your own documentation predicts your bug, that's a good sign about the documentation.

**Accessibility settings are gameplay settings.** `prefers-reduced-motion` skips the shake and roughly doubles the win rate (04, finding 1); the touch guard trades WCAG pinch-zoom for roll responsiveness; the reduced-motion dice-loader pose is carefully preserved. Three different subsystems each made an accessibility/gameplay trade-off independently. They're individually defensible; nobody has looked at them *as a set*. Worth an hour someday.

**The backstop layer is where the bugs live.** Both real backend bugs and two of the concerns are in the reaper/recovery paths — code that only runs when an instance dies or a pause expires. That's not sloppiness; it's the universal law that the code exercised least rots first. Your test-game suite exercises the happy paths and known bug classes brilliantly; nothing exercises "instance dies mid-pause." A chaos step in /test-game (kill one of the three instances mid-game, assert recovery) would cover the exact terrain where all the remaining bugs are hiding.

**The delayed_broadcast ack is doing quiet double duty.** It's documented as an animation-sync mechanism, but the gameplay analysis shows it's also the thing that *creates* photo-finish drama (everyone races a one-beat-stale view, and the CAS resolves the truth). If you ever redesign it, know that you'd be touching game feel, not just plumbing.

## Anecdotes I collected along the way

- **The origin footnote.** The 1.0.0 changelog admits the git history "only starts here because he forgot to run git init until the game already worked. Whoops." The initial commit is a *working multiplayer game* with an 800-line index.html and the original napkin sketch checked in as `resources/Sketch.pdf`.
- **Commit `6f6f6f6`.** During the May 31 four-commit icon indecision (simplify → restore → revert the restore → line-art), the line-art commit drew the hash `6f6f6f6`. The odds of a seven-character repeating hex prefix are about 1 in 17 million. It's the repo's lucky roll.
- **The vacation release identity crisis.** The week-of-June-1 release — Redis migration, security audit, a full frontend rewrite, shipped from a resort in Cap Cana — was released as 1.7.0 "Open Bar" (so says the project memory). The changelog now calls 1.7.0 "Round on the House" — a later regeneration renamed it. The memory file is the only surviving witness to the original name. Somewhere a bar-themed release name was lost to a deterministic re-roll, which feels thematically on-brand.
- **HANDOFF.md, the mayfly.** Created for "session teleport" and removed the same day (June 19). Lifespan: hours.
- **`fe05786 skills: rename skill.md → SKILL.md so project skills actually load`** — the entire project-skills system was silently not loading until June 10. Everything before that was done the hard way without anyone noticing.
- **SECURITY.md, humbled twice:** added, then "Make SECURITY.md realistic for a hobby project," then "Humanize SECURITY.md prose." A one-file arc of ambition meeting self-awareness.
- **The soundboard verdicts.** The 744-test audio field study concluded that `portamento-dream` "sounds like a synthesizer falling asleep" and that steel-drum decoded 8 of 36 attempts. The winning transmission voice was… the plain sine wave the feature launched with. Sometimes you run 744 tests to learn you were right the first time — and SONIC-BRAND.md's actual conclusion (don't make the *data* catchy; bookend it with a fixed mnemonic) was worth the trip.
- **Test logs with teeth.** The May 30 run set `PAUSE_MAX=8s` and genuinely waited for the abandonment watchdog to kill a live game. The June 8 log documents its own regression honestly — the "show winner sooner" improvement *widened* the flash race and FAILed step 22. Logs that record their author's mistakes are the only logs worth keeping.
- **Grok, refuted.** Of the three outside AI reviews, ChatGPT's scored real hits (reconnect tokens shipped same-day; stats semantics fixed with commit links), Gemini's was "mostly accurate" but got the grace period wrong, and Grok's 6.5–7/10 review claimed the game "enforces turn-like structure" — the verification pass concluded it "reads like Grok was given the architecture docs but never ran the app." Outcome column: "no code changes." The feedback system's verify-before-trusting design earned its keep that day.
- **Best microcopy in the repo:** "Click to copy or show your friends or don't." And the lobby roster went from "Other Bar Rats" to "Fellow Bar Rats" in one minute flat — the right call; *fellow* is warmer.
- **125 restarts.** Eleven consecutive "restart" messages in one session, plus the typo variants "restsrt," "restartt," and "resstart" — a tiny archaeology of late-night iteration. Which brings me to the advice.

## Advice

**1. Kill the restart, at the root.** The single largest friction source in six weeks of transcripts — 125 messages — exists because `server/assets.py` hashes static files at import time, so static edits need a process restart in dev. You wrote a memory file telling Claude to restart proactively; that fixed the symptom and the "restart" messages kept coming anyway. Fix the cause instead: in dev mode (`FRONTEND_DIST` unset), compute the hash from file mtimes per-request (or just use mtime *as* the version param). It's a ~20-line change to a file that already isolates all the hashing logic, it only affects dev, and it deletes an entire category of turn. This is the 30-minute fix with the highest quality-of-life return in the whole repo.

**2. State the verification tier in the kickoff prompt.** Both profanity incidents were tier mismatches — the harness or screenshots used when you wanted the open browser. You already invented the tiers; the memories encode them; but a single sentence up front ("iterate with me watching the browser; no harness until I say locked") sets the contract before the first mistake instead of after the second. You started doing this in July ("we'll worry about baselines later"). Keep doing it.

**3. After two failed fixes, demand an environment diff.** The Safari-tearing and phone-vs-simulator spirals each burned 3–5 attempts before the discriminating fact surfaced (Safari-only; the background image was too short; cloudflared lived on another host) — and in one of them, *you* found the bug, not Claude. The July prod-CSS bug shows the fixed version of this: you led with "the bug only happens with the prod build" and it resolved immediately. Make it a house rule: two failed fixes → stop → enumerate everything that differs between working and broken environments before attempt three. Consider adding it to CLAUDE.md's working agreement; it fits right next to "ask one sharp question."

**4. Give micro-iteration referents.** "no the other one" and "its already there" occasionally burn a turn on the wrong element. You demonstrably know how to be surgical (the topbar "Do this exactly" message); a quoted string or selector costs three seconds and never misses. Only worth it when there's more than one plausible referent on screen — which is exactly when the terse version fails.

**5. Add a prod-bundle smoke to frontend merges.** Several bugs (the prod-only CSS bug, auth.css missing from the bundle) surfaced days after their cause because dev serves raw modules and prod serves the esbuild bundle. The CI already builds the bundle; have the frontend-branch ritual include one prod-mode boot + screenshot, and this class dies. (/test-game does it — but /test-game is a 15-minute ceremony you rightly reserve for releases; this needs the 60-second version.)

**6. Point the review discipline at the neglected corner.** You review pixels obsessively, run external audits, and triage other models' feedback — but the reaper/recovery layer has never had a hostile eye on it until now, and that's where both real bugs were. One /code-review pass scoped to "what happens when an instance dies at the worst possible moment" per quarter would be cheap insurance.

## Closing

Six weeks, 643 commits, two rewrites, thirty-one bar-named releases, one acoustic modem, zero tests in the conventional sense and yet more *verification* than most production teams manage. The codebase says what it does, does what it says, and keeps the receipts. The bugs I found live in the code that runs least; the claims I checked held everywhere they were enforced; and the game underneath it all has a tension curve most designers would need three playtests to find on purpose.

It's a good bar. I'd drink there.

*— Fable 5*
