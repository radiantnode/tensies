#!/usr/bin/env bash
# Build the Tensies build-progression timelapse.
#
# For every commit (oldest -> newest) this checks out the commit into a private
# clone, launches just the app (telemetry neutralized), drives it to gameplay
# with headless Chromium, screenshots, and finally stitches every frame into an
# MP4. Work is split across N parallel workers, each with its own clone + port.
#
# Usage:
#   bin/make_timelapse.sh [arc|board] [jobs] [repo_dir]
#
#   arc     (default)  2-player round per commit: loading -> lobby -> first roll
#                      -> dice locking -> WIN, then the opponent's losing view
#                      (8 frames/commit)
#   board              single fresh-board screenshot per commit (1 frame/commit)
#   jobs               parallel workers (default 4)
#   repo_dir           git repo to walk (default: repo containing this script)
#
# Prerequisites (see ../README.md):
#   pip install playwright imageio-ffmpeg && playwright install chromium
set -uo pipefail

MODE="${1:-arc}"
JOBS="${2:-4}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${3:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)}"

WORK="$SCRIPT_DIR/../.work"
FRAMES="$SCRIPT_DIR/../frames"
SHAS="$WORK/shas.txt"
OUT="$SCRIPT_DIR/../tensies-gameplay-timelapse.mp4"
BASEPORT=8200

rm -rf "$FRAMES"; mkdir -p "$FRAMES" "$WORK"

# ordered oldest -> newest with zero-padded index
git -C "$REPO" log --reverse --format='%H' HEAD | awk '{printf "%03d %s\n", NR-1, $0}' > "$SHAS"
TOTAL=$(wc -l < "$SHAS")
echo "[timelapse] $TOTAL commits | mode=$MODE | jobs=$JOBS | repo=$REPO"

# one shared-object clone per worker (cheap; isolates git state for parallelism)
for k in $(seq 0 $((JOBS - 1))); do
  rm -rf "$WORK/clone$k"
  git clone --quiet --shared "$REPO" "$WORK/clone$k"
done

capture_one() {  # clone port idx sha
  local clone="$1" port="$2" idx="$3" sha="$4" pid ok=0 i
  ( cd "$clone" && git checkout -q --force "$sha" 2>/dev/null && git clean -fdxq 2>/dev/null ) || return
  ( cd "$clone" && exec python3 "$SCRIPT_DIR/launch.py" "$port" >"$WORK/srv_$port.log" 2>&1 ) &
  pid=$!
  for i in $(seq 1 60); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" 2>/dev/null)" = "200" ] && { ok=1; break; }
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  if [ "$ok" = 1 ]; then
    if [ "$MODE" = board ]; then
      python3 "$SCRIPT_DIR/shoot.py" "http://127.0.0.1:$port/" "$FRAMES/frame_${idx}_0.png" >/dev/null 2>&1
    else
      python3 "$SCRIPT_DIR/play.py" "http://127.0.0.1:$port/" "$FRAMES" "$((10#$idx))" >/dev/null 2>&1
    fi
    echo "[timelapse] $idx ${sha:0:7} captured"
  else
    echo "[timelapse] $idx ${sha:0:7} LAUNCH-FAIL ($(tail -1 "$WORK/srv_$port.log" 2>/dev/null | cut -c1-50))"
  fi
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
}

worker() {  # worker_id  (handles every commit where idx % JOBS == id)
  local w="$1" port=$((BASEPORT + w)) clone="$WORK/clone$w" idx sha
  while read -r idx sha; do
    [ $((10#$idx % JOBS)) -eq "$w" ] && capture_one "$clone" "$port" "$idx" "$sha"
  done < "$SHAS"
}

for k in $(seq 0 $((JOBS - 1))); do worker "$k" & done
wait

echo "[timelapse] stitching video..."
python3 "$SCRIPT_DIR/build_video.py" "$FRAMES" "$OUT" "$MODE"
echo "[timelapse] done -> $OUT"
