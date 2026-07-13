#!/usr/bin/env bash
# Per-screen design-progression capture. For every CSS-touching commit
# (oldest->newest) checks out the commit into a private clone, boots just the
# app, and captures each screen that exists at that commit. Frames land in
# screens_frames/<screen>/frame_<idx>.png. Parallel across N workers.
#
# Requires infra env exported by the caller: REDIS_URL, POSTGRES_DSN (seeded),
# PLACES_ENABLED + GOOGLE_APPLICATION_CREDENTIALS (+ host HTTPS_PROXY/CA for the
# places screen), JWT_SECRET, etc. See run_screens.sh.
#
# Usage: make_screens.sh [jobs]
set -uo pipefail

JOBS="${1:-4}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
WORK="$SCRIPT_DIR/../.work_screens"
ROOT="$SCRIPT_DIR/../screens_frames"
WL="$WORK/worklist.txt"
BASEPORT=8400

rm -rf "$ROOT"; mkdir -p "$ROOT" "$WORK"
# SCREENS_WL lets a smoke test supply a truncated worklist; else generate full.
if [ -n "${SCREENS_WL:-}" ] && [ -r "${SCREENS_WL:-}" ]; then
  cp "$SCREENS_WL" "$WL"
else
  python3 "$SCRIPT_DIR/gen_worklist.py" "$REPO" > "$WL"
fi
TOTAL=$(wc -l < "$WL")
echo "[screens] $TOTAL css commits | jobs=$JOBS"

for k in $(seq 0 $((JOBS - 1))); do
  rm -rf "$WORK/clone$k"
  git clone --quiet --shared "$REPO" "$WORK/clone$k"
done

capture_one() {  # clone port idx sha screens
  local clone="$1" port="$2" idx="$3" sha="$4" screens="$5" pid ok=0 i
  ( cd "$clone" && git checkout -q --force "$sha" 2>/dev/null && git clean -fdxq 2>/dev/null ) || return
  ( cd "$clone" && exec python3 "$SCRIPT_DIR/launch.py" "$port" >"$WORK/srv_$port.log" 2>&1 ) &
  pid=$!
  for i in $(seq 1 70); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" 2>/dev/null)" = "200" ] && { ok=1; break; }
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  if [ "$ok" = 1 ]; then
    local got
    got=$(timeout 170 python3 "$SCRIPT_DIR/capture_screens.py" "http://127.0.0.1:$port" "$ROOT" "$((10#$idx))" "$screens" 2>/dev/null | tail -1)
    echo "[screens] $idx ${sha:0:7}  ${got#*	}"
  else
    echo "[screens] $idx ${sha:0:7} LAUNCH-FAIL ($(tail -1 "$WORK/srv_$port.log" 2>/dev/null | cut -c1-45))"
  fi
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
}

worker() {  # worker_id
  local w="$1"
  local port=$((BASEPORT + w)) clone="$WORK/clone$w" idx sha screens
  while read -r idx sha screens; do
    [ $((10#$idx % JOBS)) -eq "$w" ] && capture_one "$clone" "$port" "$idx" "$sha" "$screens"
  done < "$WL"
}

for k in $(seq 0 $((JOBS - 1))); do worker "$k" & done
wait
echo "[screens] capture done -> $ROOT"
for d in "$ROOT"/*/; do echo "  $(basename "$d"): $(ls "$d" 2>/dev/null | wc -l) frames"; done
