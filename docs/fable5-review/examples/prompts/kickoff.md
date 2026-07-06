# Kickoff prompt template

Copy, fill the slots, delete the guidance. The point is to front-load the four
things that, when missing, cost the most turns: the *vision*, the *fence*, the
*verification tier*, and whether to *plan first*. Your best real prompts already
do this (the drand and onboarding kickoffs); this just makes it repeatable.

```
I want to <one-sentence outcome — what a player/user can do that they couldn't>.

Vision / feel: <what "really nice" means here; references if any>

Constraints:
- <hard requirements — e.g. "strictly WebAuthn", "no new dependencies",
  "keep the design EXACTLY", "must be verifiable/replayable">
- Put it behind <ENV_FLAG> so I can toggle it. [omit if N/A]

Scope fence: touch only <files/areas>. Do NOT change <the WS protocol / the
pause state machine / the design / …>. If an adjacent file looks relevant, ask
before crossing the fence.

Verification tier for THIS task:
- [ ] I'm watching the browser — iterate live, no harness, no screenshots until I say "locked"
- [ ] Spot-check in the open MCP browser at 390×844
- [ ] Multiplayer: two isolated clients
- [ ] Re-baseline the pixel harness (design is FINAL)
- [ ] Full /test-game before merge

Branch: create <type>/<slug> before starting.
Planning: [ ] enter plan mode and ask me implementation questions first
          [ ] just go — this is small
```

## Why each slot earns its place

- **Outcome first** keeps the work anchored to a user-visible result, not a
  mechanism.
- **Scope fence** is the single highest-value line — "stay inside this fence
  even if an adjacent file looks relevant" prevents the scope-creep that drew
  the sharpest corrections in the transcripts.
- **Verification tier up front** is the fix for the two moments that drew
  profanity: both were the harness/screenshots being used when you wanted the
  live browser. Declaring the tier once, at the top, replaces two angry
  corrections and a memory file.
- **Plan toggle** lets you get plan-mode rigor on the big stuff (where it paid
  off — drand, WebAuthn, Redis) and skip the ceremony on the small stuff.
```
```
