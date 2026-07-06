#!/usr/bin/env bash
# PostToolUse(Edit|Write) — lint the file that was just edited, immediately.
#
# Why: the review found the whole "strict JS" claim had drifted to 31 tsc errors
# because nothing checked it until CI. Same class of problem for ruff. This
# closes the loop at edit time: if Claude introduces a lint error, it hears about
# it on the very next turn (exit 2 feeds stderr back) and fixes it before moving
# on — instead of the mistake surfacing minutes later in CI, or never.
#
# Design choice: uses a locally-installed `ruff` if present (instant). It does
# NOT pip-install per edit — that would add ~15s to every edit and make the hook
# a nuisance. tsc is deliberately left to CI (too slow for a per-edit hook; the
# CI gate added in the fixes branch covers it). If you don't keep ruff on the
# host, see the Docker fallback commented at the bottom.
set -uo pipefail

input=$(cat)
f=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$f" ] && exit 0
[ -f "$f" ] || exit 0

case "$f" in
  *.py)
    if command -v ruff >/dev/null 2>&1; then
      if ! out=$(ruff check "$f" 2>&1); then
        printf 'ruff flagged the file you just edited (%s) — fix before continuing:\n%s\n' "$f" "$out" >&2
        exit 2
      fi
    fi
    ;;
esac
exit 0

# ── Docker fallback (if you don't want ruff on the host) ──────────────────────
# Replace the `if command -v ruff` block with a one-time-built cached image so
# it stays fast:
#   docker build -t tensies-ruff - <<'DOCKER'
#   FROM python:3.12-slim
#   RUN pip install ruff==0.14.3
#   DOCKER
# then:
#   out=$(docker run --rm -v "$PWD":/app -w /app tensies-ruff ruff check "$f" 2>&1) || { ... exit 2; }
