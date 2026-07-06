#!/usr/bin/env bash
# SessionStart — print the project's current state so Claude starts every
# session already oriented, instead of re-deriving "what branch am I on, what's
# uncommitted, when did we last test, what PRs are open" from scratch (or asking
# you). stdout from a SessionStart hook is injected into the model's context.
#
# This is the single biggest lever for "ask fewer repeat questions": most of the
# repeat questions are re-establishing state that this prints for free.
set -uo pipefail

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo '?')
last_commit=$(git log -1 --format='%h %s' 2>/dev/null || echo 'none')

# Most recent game test-run (skip the README index).
last_test=$(ls -t docs/test-runs/game/*.md 2>/dev/null | grep -v README | head -1)
[ -n "$last_test" ] && last_test=$(basename "$last_test" .md) || last_test='none'

echo "== Tensies session context =="
echo "branch: $branch  |  uncommitted files: $dirty  |  unpushed commits: $ahead"
echo "HEAD: $last_commit"
echo "latest game test-run: $last_test"

# Open PRs (best-effort — needs gh + network; silent if unavailable).
prs=$(gh pr list --state open --limit 6 \
        --json number,title,headRefName,statusCheckRollup \
        -q '.[] | "  #\(.number) [\(.headRefName)] \(.title)"' 2>/dev/null)
if [ -n "$prs" ]; then
  echo "open PRs:"
  echo "$prs"
fi

# A gentle nudge toward the habits the review found most load-bearing.
echo "reminders: main is branch-protected (feature branch → PR); verify at the mobile"
echo "viewport 390×844; state the verification tier up front for design work."
