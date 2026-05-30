---
name: review-feedback
description: Reproduce the external-feedback review loop — take a piece of outside code feedback (a pasted review, a ChatGPT/Claude share link, an issue, an email), verify every concrete claim against the actual code rather than trusting it, return a calibrated second opinion (agree / sharpen / push back / what-it-missed), then optionally implement the agreed fixes and capture the whole exchange as a dated, attributed transcript under docs/feedback/.
user_invocable: true
---

# Tensies Feedback-Review Loop

You are reproducing a specific, repeatable loop: someone hands you **external
feedback about this codebase**, and you turn it into a verified second opinion,
an optional implementation, and a permanent transcript. The defining principle
of this loop is **verify, don't trust** — every "the reviewer is right" must be
backed by lines you actually read, not by the claim sounding plausible.

This skill was distilled from the 2026-05-30 review loop. The output of that run
lives at `docs/feedback/2026-05-30-tensies-code-review.md` — read it as the
reference example of the finished product before you start.

**Do not skip the verification phase.** The entire value of this loop is that the
second opinion is grounded in the real code. A review that just rephrases the
feedback is worthless.

---

## Inputs

The user will give you one of:
- Pasted feedback text (most common).
- A share link (ChatGPT / Claude / Gist). **Try to fetch it**, but expect
  failure: ChatGPT share pages return 403 to automated fetchers and render
  client-side, and the environment's network allowlist may block the host. If
  fetch fails, **ask the user to paste the text** — never guess at the content.
- A GitHub issue / PR comment / email — fetch via the appropriate MCP tool.

Capture the feedback **verbatim**. You will reproduce it unchanged in the
transcript, so keep the exact wording.

---

## Phase 1 — Read the feedback, list every concrete claim

Break the feedback into discrete, checkable claims. A claim is concrete if it
points at a file, a function, a config value, a schema column, or a specific
behavior. Vague praise ("the architecture is clean") needs no verification;
"`total_rounds` is only incremented for the round winner" does.

Make a checklist. You will verify each item in Phase 2 and carry a verdict for
each into the write-up.

---

## Phase 2 — Verify each claim against the actual code (the core of the loop)

For every concrete claim, **open the referenced code and confirm or refute it.**
Read the modules the feedback names — and the ones it *should* have named.
Reference things as `path:line` so the write-up is auditable.

Guidance that made the last run effective:

- **Trace, don't assume.** "CONFIRMED" must mean you read the lines. In the
  reference run that meant `server/ws.py`, `server/game.py`, `server/broadcast.py`,
  `server/routes.py`, `server/state.py`, `server/telemetry/writer.py`,
  `migrations/001_init.sql`, `docker-compose.yml`, `Dockerfile`, and the client
  `static/js/*.js`.
- **Read the SQL / the queries.** The highest-value findings last time
  (the writer-transaction abort, the `total_rounds == total_wins` equivalence,
  the unwritten `total_games`) only came from reading actual queries, not docs.
- **Escalate when the code is worse than the claim.** If the reviewer
  under-states a problem, say so and prove it. (Last time: the shared
  `con.transaction()` doesn't just "poison the batch" — it rolls back the
  append-only event insert too, breaking a documented guarantee.)
- **Find what the review missed.** Look for claims the feedback *almost* made.
  (Last time: it noted disabled Grafana HTML sanitization AND user-controlled
  names separately but never connected them into a stored-XSS path.)
- **Check the feedback's own facts.** If it cites a number or a line, confirm it.

Assign each claim one of: **CONFIRMED**, **CONFIRMED + escalated**,
**partially right**, **wrong/refuted**, or **agree but soften** (real, but the
stakes are overstated).

---

## Phase 3 — Write the second opinion

Produce a calibrated review with these parts (mirror
`docs/feedback/2026-05-30-tensies-code-review.md`):

1. **Overall verdict** — is the feedback fair? Well-calibrated, or generic? One
   honest sentence, then the nuance.
2. **Claims verified as correct** — each with the `path:line` evidence. Mark the
   escalations.
3. **What the review missed** — the connection(s) it didn't make.
4. **Where you'd push back or soften** — disagreements and over-statements, with
   reasoning, not just contradiction.
5. **Recommended priority order** — ordered by value ÷ risk. Lead with the
   small, self-contained, high-value fixes.
6. **Bottom line** — the one or two things to do first.

Be willing to disagree with the feedback **and** with the user. The loop is only
useful if the second opinion is independent.

---

## Phase 4 — Decide what to implement (ask)

Surface the priority list to the user and let them choose scope. Do **not**
assume "review" means "implement everything." Use the AskUserQuestion tool to
confirm how far down the list to go, and confirm any design choice that has more
than one defensible answer (last time: opaque token vs HMAC — present the
trade-offs, recommend one, let the user pick).

The user may also tell you to **drop** an item you rated highly. Honor it, and
record the decision — the transcript documents the exchange, not just the final
plan.

---

## Phase 5 — Implement + verify (only what was agreed)

For each agreed fix:

- Implement it in the smallest coherent diff. Match surrounding code style.
- **Verify it actually works**, not just that it compiles. Prefer the project's
  own harnesses. If the full stack can't run (e.g. Docker image pulls are
  network-blocked, as last time), say so explicitly and fall back to what *can*
  run: a telemetry-free app launch, the `/test-game` skill, a headless WS driver,
  isolated browsers. Report what you did NOT cover.
- Report outcomes faithfully — failures with output, skipped steps as skipped,
  and any "this looked like a regression but was actually correct behavior"
  findings (last time: a peer not showing the loading screen turned out to be
  correct token self-healing, proven from the server log).
- Commit each logical change with a clear message. Push to the working branch.
  Do **not** open a PR unless asked.

---

## Phase 6 — Write the transcript

Append/create a dated, attributed transcript under `docs/feedback/`:

- **Filename:** `docs/feedback/YYYY-MM-DD-<short-topic>.md`.
- **Header:** date, one-line framing, a participants key (who is who).
- **Turns, verbatim and attributed:** reproduce each turn of the exchange
  unchanged — external reviewer, Claude Code, reviewer reply, etc. Do **not**
  edit the content of a turn; organization and attribution only.
- **A final "decision rationale" turn** (written from memory): why you agreed /
  disagreed with each point, the reasoning behind any design decision you made,
  what the implementation actually changed (with commit hashes), how you verified
  it (and what you couldn't), and what was deliberately deferred.
- Close by noting where implementation picked up (commit hash) and what remains
  open.

If a transcript for this exchange already exists, extend it rather than
duplicating.

---

## Phase 7 — Report

Give the user a short summary:
- The verdict on the feedback (fair / overstated / missed things).
- What you verified, agreed with, pushed back on, and added.
- What you implemented and how it was verified (with caveats).
- What's deferred and the transcript path.

Then update any uncommitted state and confirm the branch is pushed and clean.

---

## Principles (the spirit of this loop)

- **Verify before agreeing.** No "CONFIRMED" without lines read.
- **Independent judgment.** Disagree with the feedback or the user when the code
  says so; soften severity that's overstated; surface what was missed.
- **Faithful reporting.** Telemetry untested means say "telemetry untested."
  A regression that's actually correct behavior gets explained, not buried.
- **The transcript is a record, not a plan.** Preserve dropped ideas and
  disagreements; they're part of the exchange.
- **Smallest honest diff.** Implement only what was agreed, verify it for real,
  defer the rest explicitly.
