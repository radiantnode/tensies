#!/usr/bin/env bash
# Custom Claude Code status line for Tensies.
# Claude Code pipes a JSON blob on stdin (model, workspace, etc.); we print one
# line that gets shown under the prompt. Keep it fast — it runs constantly.
#
# Shows: model · branch (dirty?) · unpushed · last game test-run age · whether
# the dev stack is up. The test-run age is the sleeper feature — it makes "our
# last full test was 9 days ago" impossible to forget before a merge.
set -uo pipefail

input=$(cat 2>/dev/null || echo '{}')
model=$(printf '%s' "$input" | jq -r '.model.display_name // "Claude"' 2>/dev/null)

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
dirty=""
[ -n "$(git status --porcelain 2>/dev/null)" ] && dirty="*"
ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
push=""
[ "$ahead" != "0" ] && [ "$ahead" != "?" ] && push=" ↑$ahead"

# Age of the most recent game test-run, in days.
last=$(ls -t docs/test-runs/game/*.md 2>/dev/null | grep -v README | head -1)
testage="no tests"
if [ -n "$last" ]; then
  now=$(date +%s)
  mt=$(stat -f %m "$last" 2>/dev/null || stat -c %Y "$last" 2>/dev/null || echo "$now")
  days=$(( (now - mt) / 86400 ))
  testage="🎲 ${days}d"
fi

# Is the dev stack answering on :8888?
stack="○"
curl -sf -m 1 http://localhost:8888/ 2>/dev/null | grep -q TENSIES && stack="●"

printf '%s · ⎇ %s%s%s · %s · dev:%s' "$model" "$branch" "$dirty" "$push" "$testage" "$stack"
