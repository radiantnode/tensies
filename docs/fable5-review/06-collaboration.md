# How You Work With Claude

*Based on all 14 memory files and 70 session transcripts (2026-05-31 → 2026-07-05; 65 with user activity, ~1,706 user messages). Quotes are your actual words. Two memory files reference late-May sessions whose transcripts no longer exist.*

## The headline

You treat Claude like a team member you onboard once, not a tool you re-instruct forever — and it visibly compounds. Correction density fell over six weeks even as delegation size grew from "make the text smaller" to "triage every Dependabot PR end-to-end." Nine of your fourteen memory files are feedback rules distilled from a moment of friction, each written so the friction never recurs. That habit is rarer than you'd think, and it's the single biggest reason this project moved as fast as it did.

## Prompting style: vision-dictation up front, telegrams thereafter

Your style is strongly bimodal. Feature kickoffs are detailed and directive — vision, constraints, branch discipline, and often an explicit demand for planning:

> "I want to implement drand into tensies. I want it to be robust, durable, and most of all verifiable. this is a big one. create a new branch for this. enter plan mode. ask me implementation questions. i also want this feature on a ENABLE_DRAND_ROLLING environment variable so I can turn it on and off. plan it out thoroughly." *(06-19)*

> "I want to start working on user onboarding. I want it to be really nice. Create a new branch for this before we begin. … I will dictate the vision. I want to use strictly webauthn for this." *(06-14)*

Your best prompts pre-empt entire debugging cycles by supplying the *process*, not just the goal:

> "I've done a lot of css work in this branch. before i ship it i want to make sure there isn't any redundant or unused css. please investigate. work methodically, use the before / after harnesses for pixel verification. ask me to approve changes as you go." *(07-04)*

> "there is a new css bug. on the lobby screen the back button doesn't clear the waiting for players header. … find the exact change and why it caused it and what the fix is" — followed by the discriminating clue: "the bug only happens with the prod build." *(07-05)*

And when you're precise, you're surgically precise — this one is a patch written in English:

> "Still trying to fix the topbar background. I've been messing in chrome. Do this exactly: For game-topbar ONLY. Do not effect other views. 1. .topbar-title-row — remove the background and filter. 2. .players-bar — remove the background and filter. 3. .game-topbar — add background: var(--color-panel); and backdrop-filter: blur(8px);" *(07-05)*

Once work is underway, messages collapse to 2–8 words: "restart", "commit and push", "closer", "a little more", "merge it". The flip-counter session (06-25) has 15+ consecutive one-liners. The vague ones are almost all in this mode — "no the other one", "its already there.", "move the text up more above the button" — fine when the context is one element, costly when it isn't.

## Corrections: fast, blunt, systematized

~57 corrective messages across 24 of 65 sessions (~37% contain at least one), with a visible escalation ladder: mild redirect → repetition → all-caps or expletive. All four profanity-bearing messages in the corpus are about the same two themes — verification-tool mismatch and scope creep:

> "i said vertically aligned not horizontal. don't change the fucking app-header." *(06-09)*
> "stop fucking running nginx on the host" *(06-09 — this predates the Docker-first rule in your global CLAUDE.md; that rule plainly descends from moments like this)*
> "stop with the fucking harnesses" *(07-03)*
> "stop rebaselining." *(07-05 — the same lesson resurfacing two days later)*

**Recurring frustration #1: the restart.** The dev server hashes assets at startup, so every static edit needs `docker compose restart web`. The corpus contains **125 bare "restart" messages** (including "restsrt", "restartt", "resstart"), with eleven consecutive in one session (06-24). This persisted for a month *despite* a memory file explicitly encoding the rule — because the memory fixed Claude's behavior, not the root cause. More in [07-observations-and-advice.md](07-observations-and-advice.md).

**Recurring frustration #2: heavyweight verification for lightweight questions.** "dont take screenshots. i will verify. its too slow." *(06-24)*; "restart the server. no screenshot." *(06-16)*. Both profanity incidents above are the same category.

What's genuinely unusual: you convert every frustration into infrastructure. Don't-rebaseline-mid-iteration, use-the-open-browser, isolate-multiplayer-profiles, verify-Firefox-fallback, update-TESTS.md — each memory file is a correction that happened once and then became law.

## Trust evolution: co-pilot → dispatcher

- **Early June (rewrite era):** heavy plan-mode use and interrogation of the plan itself — "Does this mean you will render app-header twice? Why can't you just place it at the root of the app so its usable everywhere?" *(06-09)*. ExitPlanMode appears in 11 sessions, clustered June 7–19; "plan it / plan mode" appears in 21 messages.
- **Mid June:** big delegations with checkpoints — drand (plan mode, design Q&A, four confirmed decisions), WebAuthn onboarding, the end-game rework.
- **Late June–July:** whole-pipeline delegation with almost no ceremony: "Look through all the frontend CSS and clean it up… work methodically" → "create a new pr" → "merge it" *(06-24 — three messages, total)*. The Dependabot triage prompt *(06-20)* is a numbered six-step operating procedure. By July 1 you're firing templated remote jobs ("Same two steps again: (1) git pull… (2) docker compose restart web and confirm health") from another device while building the video intro.
- **Skills as a trust mechanism:** 15+ distinct slash commands (`/changelog` ×15, `/test-game` ×5, `/frontend-rewrite` ×3, `/storyteller`, `/graphify`…). You invest in improving Claude itself — "I'm trying to improve you via skills to rewrite the entire frontend but KEEP the current design exactly." *(06-10)* — and you route Claude's output through *other models'* reviews (a security audit, Gemini, a JS review, a docs review) and paste them back for calibrated triage, formalized as the `review-feedback` skill. Adversarial cross-checking is rare discipline for a solo dev.

## Verification culture: "reproduce it so you can see for yourself"

Verification is the house religion, and you taught it explicitly:

> "Please reproduce the bug so you can see for yourself." *(06-12)*
> "play another game with 3 players. one authenticated. 3 rounds. everyone rolls to win. watch the server logs, check telemetry, check everything for accuracy." *(06-19)*

Your verification scenarios are effectively executable acceptance tests — named users, round counts, which logs to watch. And the discipline is *tiered*, with each tier learned through friction: pixel harness only for locked designs; the open MCP browser for spot-checks; two isolated Playwright profiles for multiplayer (after the shared-localStorage false bug); Firefox for the no-View-Transitions branch (you rejected a commit on 06-11 until Firefox was checked); real speaker→mic decoding for audio share ("don't do silent. use the microphone and speakers to do a real test", 06-13). The overlay-flash memory shows you pushing measurement sophistication: not "did the overlay open" but "how many milliseconds did it stay open." You even optimized Claude's own test loop: "i don't want you having to restart a game every time…" *(06-24)*.

## The fun

The project has a bar-night soul because you feed it. You volunteered the Cap Cana lore for the changelog *(06-07)*. You co-designed an SVG bar-top blueprint ("make the suds on the beer mug bigger and better proportioned", 06-08). The audio-share pitch was pure product instinct: "I want the game to have a memorable melody. … Like 'hey what's that sound?'. 'Oh, I'm playing TENSIES!'" *(06-13)*. You ask open-ended creative questions ("can you think of anything cool to do with tensies?" → "yes do the top 5.", 07-03), stage transcripts for TikTok, and hand out compact praise: "perfect", "Found it!", "it looks good". You also police the voice — the "don't name the voice" memory came from you flagging "A friendly log of everything that's changed" as an AI tell. You were right.

## Where it worked best / where it broke down

**Best:** (a) plan-gated big features — drand, WebAuthn, the Redis migration — where you answered design questions up front and then got out of the way; (b) process-scripted delegations (Dependabot triage, CSS dedup with approval checkpoints); (c) bug hunts where you supplied the discriminating clue ("only happens with the prod build").

**Breakdowns:** (a) the Safari a2hs "tearing" spiral *(06-21)*: "still happening" ×3 → "rervert all your changes" → "do some research. it seems to only happen in safari." — the Safari-only fact arrived four attempts in; (b) the real-phone-vs-simulator background bug *(06-14)*: four failed fixes, then "stop" — and *you* solved it: "I think i know what the proplem is. the background image is not long enough. do you agree?"; (c) the verification-tool mismatch, the only theme that drew profanity twice; (d) blind spots Claude couldn't see (cloudflared on another host, iOS-simulator-only behavior) where turn-by-turn relay of observations was slow.

The pattern in every breakdown: the missing ingredient was an *environment fact* only you could observe, disclosed after the failed attempts instead of before. The pattern in every success: process or constraints stated up front.

## Stats

| Metric | Value |
|---|---|
| Transcripts / with user activity | 70 / 65 |
| User messages | ~1,706 (median session ~11; max 210) |
| Sessions with ≥1 correction | ~24 (37%); ~57 corrective messages |
| Bare "restart" messages | 125 (incl. typos; 11 consecutive in one session) |
| Profanity-bearing messages | 4 (all verification/scope frustration) |
| "Plan it / plan mode" requests | 21 messages; ExitPlanMode in 11 sessions |
| Distinct slash commands | 15+ |
| Memory files / feedback-rules | 14 / 9 |
| External reviews triaged | ≥4 |
