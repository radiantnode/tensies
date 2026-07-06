# Getting the Most from Claude — Skills, Prompts, Hooks & Niceties

*Written 2026-07-05 by Claude Fable 5. You asked how to make Tensies the best it
can be while getting the most out of Claude — and, most of all, to learn. This is
the honest answer, drawn from the 65 sessions and 1,706 messages analyzed in
[06-collaboration.md](06-collaboration.md), the fix loop in
[08-post-review-fixes.md](08-post-review-fixes.md), and this very conversation.*

Everything here has a **working example** in [`examples/`](examples/) — real
hooks, skills, templates, and scripts, not sketches. Install notes are in
[examples/README.md](examples/README.md).

The organizing idea: **you already know the right habits — they're in your memory
files and your best prompts. The gap is that habits live in your head and have to
be re-remembered each session, by both of us. The move is to convert habits into
*machinery* — hooks that enforce, skills that encode, context that's injected —
so the good behavior happens by default instead of by recall.**

---

## 1. Help me be more efficient

**The restart tax is already gone — at the root.** The review found 125 bare
"restart" messages across six weeks. The fixes branch made dev recompute
cache-busted assets on file change ([08](08-post-review-fixes.md) §9), so static
edits now show on reload with no `restart web`. That single change retires the
biggest time sink in the corpus. Nothing to configure — it's in the code.

**Lint at edit time, not at CI time.** [`fast-check.sh`](examples/hooks/fast-check.sh)
runs `ruff` on the Python file the instant it's edited and, on failure, feeds the
error straight back so I fix it that turn. The whole "strict JS drifted to 31 tsc
errors" problem was the absence of exactly this loop; the fixes branch added the
CI gate, and this hook pulls the feedback even earlier.

**Encode the ship workflow.** [`skills/ship`](examples/skills/ship/SKILL.md)
turns "make a PR" into a fixed sequence: feature branch → lint → commit with your
trailer → push → PR → wait for CI → stop at green. You've run this workflow
dozens of times and specified it dozens of times; the skill means you specify it
once, ever.

**A status line that answers before you ask.**
[`statusline.sh`](examples/scripts/statusline.sh) keeps `model · branch* ↑2 ·
🎲 9d · dev:●` under the prompt. The `🎲 9d` — days since the last full
`/test-game` — is the sleeper: it makes "we haven't done a real test pass in over
a week" impossible to forget before a merge.

## 2. Help me ask fewer repeat questions

Most repeat questions are re-establishing state, and state can be *injected*
instead of *asked*.

**Start every session oriented.**
[`session-catchup.sh`](examples/hooks/session-catchup.sh) (a `SessionStart` hook)
prints the branch, uncommitted count, unpushed commits, last test-run, and open
PRs into my context before your first message. That's the bulk of "wait, where
were we" — answered for free, every session. This is the highest-leverage single
hook for your stated goal.

**Declare the verification tier once, up front.** Both moments that drew
profanity in the transcripts were the same mismatch: harness/screenshots when you
wanted the live browser. The [kickoff template](examples/prompts/kickoff.md) has a
one-line tier declaration; the [CLAUDE.md addition](examples/CLAUDE-additions.md)
makes "declare the tier for design work" a standing rule. Say it once at the top
and the repeat correction never happens.

**Let memory carry the durable facts.** Your memory files are already good — 9 of
14 are hard-won rules. The [CLAUDE.md addition](examples/CLAUDE-additions.md) on
memory hygiene asks me to *write* a memory when a task turns up something durable
and non-obvious (without being asked), and to *verify* a memory's file/flag
references still exist before acting on them (several predate two rewrites). That
keeps the recall layer growing and trustworthy.

## 3. Help me make fewer mistakes

**Make the un-doable un-doable.** [`protect-main.sh`](examples/hooks/protect-main.sh)
blocks any commit/push while on `main`. "main is branch-protected" is a rule I
have to remember; this makes it a rule the machine enforces — a whole class of
mistake becomes impossible rather than merely discouraged.

**Surface the invariant at the moment of the edit.**
[`invariant-guard.sh`](examples/hooks/invariant-guard.sh) watches the paths
CLAUDE.md flags as "load-bearing and easy to half-remember" — `broadcast.py`,
`fanout.py`, `gamestore.py`, `reaper.py`, the roll FSM, `state.js`'s RNG seed —
and injects the specific invariant for that file right before I edit it. This is
the working-agreement rule "re-read the invariant before touching it," automated
and targeted. It's exactly the terrain the review's two real backend bugs lived
in (the recovery layer); a nudge there is worth more than a nudge anywhere else.

**Two failed fixes → diff the environment.** The [`debug-loop`
skill](examples/skills/debug-loop/SKILL.md) encodes the lesson from the
Safari-tearing and phone-vs-simulator spirals: after two failed attempts, stop
and build an explicit table of what differs between working and broken
environments before trying again. Paired with the [bug-report
template](examples/prompts/bug-report.md)'s "only happens when" block, it turns
the multi-attempt spiral into a one-shot fix — the way the prod-only CSS bug
resolved the instant you led with the discriminator.

**Prod-smoke frontend work.** Dev and prod serve assets differently; bugs hide in
the gap. The [CLAUDE.md addition](examples/CLAUDE-additions.md) makes a 60-second
prod boot part of "done" for `static/` changes — the quick version of
`/test-game`'s prod pass.

## 4. Help me remember more details

- **`session-catchup.sh`** injects the project's live state each session (above).
- **`invariant-guard.sh`** recalls the *right* invariant at the *right* file,
  so the load-bearing details don't rely on either of us holding them in working
  memory.
- **Memory hygiene rule** keeps the durable facts accreting and verified.
- **The status line** keeps branch, dirty state, and test-age always visible.

Together these move "details I have to remember" into "details the environment
reminds me of" — which is the only version that survives a long session.

## 5. Niceties (a little creativity, as requested)

- **Bar-themed codename generator.**
  [`codename.py`](examples/scripts/codename.py) reads `CHANGELOG.md`, skips the
  31 names already used, and proposes fresh on-brand ones ("Designated Roller,"
  "Bottle Service," "Cheers to That"). Deterministic — no RNG, so it's
  sandbox-safe and repeatable. A tiny tax on the changelog skill, gone.
- **The `🎲 Nd` test-age badge** in the status line — a quiet conscience for the
  test suite.
- **A `debug-loop` that names Tensies' actual failure smells** (prod-only,
  Safari-only, multi-instance-only, real-phone-only) so the environment diff
  starts from the axes that have actually bitten this project.
- **Worth considering next:** a `PreCompact` hook that snapshots the current
  task's open threads to a scratch file before context is summarized (so nothing
  in-flight is lost across a compaction); a `/loop`-driven "babysit-PRs" that
  watches CI on open PRs and pings you when one goes red or green; and a
  Grafana-annotation hook that marks each deploy on the telemetry timeline so
  "did that spike start at the 1.24 deploy?" answers itself.

## What I'd actually do first

If you adopt three things this week, make them:

1. **`protect-main.sh`** — converts your most-stated rule into an impossibility.
2. **`session-catchup.sh`** — kills most of the repeat "what's the state" turns.
3. **The verification-tier line in your kickoffs** — retires the one mismatch
   that reliably frustrated you.

Everything else is additive. The through-line, and the thing most worth
internalizing: **you've already discovered the right way to work with me — the
evidence is that your correction rate *fell* over six weeks even as you delegated
bigger and bigger chunks. What's left isn't learning new habits; it's giving the
habits you already have a machine to live in, so neither of us has to remember
them.** That's the whole game.

*— Fable 5*
