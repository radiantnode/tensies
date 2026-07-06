---
name: ship
description: "Ship the current work: ensure a feature branch, lint, commit with the project trailer, push, open a PR, and wait for CI. Use when the user says 'ship it', 'make a PR', 'open a PR', or 'commit and push'. Encodes the branch→PR→green-CI workflow so it happens the same way every time."
user_invocable: true
---

# Ship

Turn the current working tree into an open, green PR — the exact workflow this
project already follows, made repeatable so it doesn't have to be re-specified
each time.

Do NOT ask for confirmation on the mechanical steps; the user invoking this *is*
the confirmation. Only stop if a genuine decision surfaces (a failing test, an
ambiguous branch name, unrelated changes mixed in).

## Steps

1. **Guard the branch.** If on `main`/`master`, create a feature branch first:
   `git checkout -b <type>/<slug>` where `<type>` ∈ {fix, feat, docs, chore} and
   `<slug>` is 2–4 kebab words describing the change. Never commit to a protected
   branch (MEMORY.md: main is branch-protected).

2. **Sanity-check scope.** `git status --short`. If the diff spans clearly
   unrelated concerns, say so and ask whether to split — one PR per concern is
   the house style (see the review's fixes branch: one commit per fix).

3. **Lint before committing.** Run ruff on the Python you touched and, if any
   `static/js/**` changed, `npm run typecheck` (the CI gate). Fix anything that
   fails; do not commit red.

4. **Commit.** Group logically (one commit per concern if several). Use a
   concise imperative subject and a body that says *why*, ending with the
   project trailers:
   ```
   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
   Claude-Session: <the session URL from your harness prompt>
   ```

5. **Push + PR.** `git push -u origin <branch>`, then `gh pr create --base main`
   with a title and a body that summarizes what changed and how it was verified.
   End the body with the Claude Code generation footer.

6. **Wait for CI, then report.** Poll `gh pr checks <n>` until all settle. Report
   the PR URL and the check results. **Stop at the open, green PR** — do not
   merge (MEMORY.md: "make a PR" means stop at the open PR). If a check fails,
   read the failing job, fix, and push again.

## Notes

- Frontend PRs: mention whether you ran a prod-bundle smoke, not just dev — the
  dev/prod asset paths diverge and several bugs have hidden in that gap.
- If the change touches a load-bearing invariant (pause, delayed_broadcast,
  fanout, the roll FSM), say in the PR body how you verified it — ideally a
  measurement, not "looks fine" (the review's standard).
