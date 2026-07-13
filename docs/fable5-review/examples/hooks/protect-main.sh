#!/usr/bin/env bash
# PreToolUse(Bash) — refuse to commit or push while on a protected branch.
#
# Why: MEMORY.md records "main is branch-protected — always PR". That's a rule
# Claude has to *remember*; a hook makes it a rule the machine *enforces*. Turns
# a class of mistake into an impossibility, which is strictly better than a
# reminder it might miss in a long session.
#
# Exit 2 blocks the tool call and feeds the stderr message back to Claude, so it
# self-corrects (branches first) instead of just failing.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0

# Only intercept commit/push; everything else on main is fine (status, log…).
case "$cmd" in
  *"git commit"*|*"git push"*) ;;
  *) exit 0 ;;
esac

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
protected="${TENSIES_PROTECTED_BRANCHES:-main master}"

for p in $protected; do
  if [ "$branch" = "$p" ]; then
    echo "Blocked: you're on '$branch', which is branch-protected. Create a feature branch first — e.g. 'git checkout -b fix/<slug>' — then commit and open a PR. (Set TENSIES_PROTECTED_BRANCHES to change this list.)" >&2
    exit 2
  fi
done
exit 0
