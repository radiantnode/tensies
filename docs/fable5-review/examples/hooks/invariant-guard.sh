#!/usr/bin/env bash
# PreToolUse(Edit|Write) — when Claude is about to touch a load-bearing file,
# inject the specific invariant it needs to respect *before* the edit lands.
#
# Why: CLAUDE.md's working agreement literally says "Re-read the relevant
# invariant before touching it" and names these exact paths as "load-bearing and
# easy to half-remember". This hook makes that re-read automatic and targeted —
# it surfaces the one paragraph that matters for the file in hand, at the moment
# it matters. It does NOT block; it advises (JSON additionalContext).
set -uo pipefail

input=$(cat)
f=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$f" ] && exit 0

note=""
case "$f" in
  *server/broadcast.py)
    note="delayed_broadcast ack timing + the pause-during-win-delay interlock (round_advance_pending freezes the advance; handle_pause runs advance_round on resume). Re-read the 'Delayed broadcast' and 'Pause' sections of CLAUDE.md." ;;
  *server/fanout.py)
    note="Redis pub/sub preserves per-publisher order ONLY, and state_msg carries no sequence number — cross-instance snapshots can transiently regress and are self-healing by full-snapshot, not by ordering. Don't assume global ordering." ;;
  *server/gamestore.py)
    note="the Redis-vs-process-local split + the Lua scripts. Distinct players write distinct hash fields (no contention); the ONE contended write is the round-win flip (try_finish_round CAS). Cross-instance timers must be idempotent (timestamp/deadline re-checks)." ;;
  *server/reaper.py)
    note="the reaper is the cross-instance backstop and races the owning instance's local task — every action it takes must be idempotent, and it must gate emits on the Lua result so nothing double-counts." ;;
  *server/ws.py)
    note="handle_pause reschedules drops with restamp on resume; handle_auth rebinds session.pid to the account UUID. Host-only actions (start/pause/end_game) re-check meta[host]==session.pid server-side." ;;
  *static/js/state.js)
    note="randomNamePlaceholder MUST stay the first Math.random consumer — the pixel harness pins the RNG and any earlier consumer shifts every baseline." ;;
  *static/js/animations.js|*static/js/net.js)
    note="the roll FSM (rolling/awaitingAck/pendingRollState/postRevealState) + the celebration-echo guard: on a win, a mid-reveal broadcast must be DROPPED, not routed through showFor() (which would hideWinner and flash the overlay)." ;;
  *static/js/transitions.js)
    note="swaps into #game must use the staged path — a View Transitions raster flattens the 3-D dice on Safari. Keep the vt-settling guard + fallback setTimeouts." ;;
  *) exit 0 ;;
esac

# Emit as advisory context (non-blocking). If your Claude Code version doesn't
# honor PreToolUse additionalContext, swap this for `echo "$note" >&2; exit 2`
# to turn it into a hard "re-read then retry" gate instead.
ctx="⚠ Load-bearing path ($f). Invariant to respect: $note"
jq -n --arg c "$ctx" \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $c}}'
exit 0
