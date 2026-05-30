---
name: timelapse
description: Build a build-progression timelapse video of Tensies — walks the whole git history oldest→newest, launches just the app on each commit, drives a real 2-player round with headless Chromium (loading → lobby → first roll → win → opponent's loss), screenshots every step, and stitches it all into an MP4. Use when asked to make/refresh the progression timelapse or a per-commit gameplay video.
user_invocable: true
---

# Tensies progression timelapse

Produce a video that walks the entire commit history of this repo, playing a
round of the game on every commit. The whole pipeline lives in `Timelapse/bin/`
and is driven by one orchestrator. **Do not ask for confirmation — run it and
report the result.**

## Run it

```bash
Timelapse/bin/make_timelapse.sh arc 4
```

- arg 1: `arc` (default, 8 frames/commit — loading, lobby, first roll, dice
  locking, WIN, and the opponent's LOSS) or `board` (1 frame/commit, fast).
- arg 2: number of parallel workers (default 4). Each worker gets its own
  shared-object clone under `Timelapse/.work/` and its own port (8200+id), so
  workers never collide on git state.

Output: `Timelapse/tensies-gameplay-timelapse.mp4`. Deliver it with the file
tool when done.

## Prerequisites (install once, before the first run)

```bash
pip install playwright imageio-ffmpeg
playwright install chromium
```

If `playwright install chromium` can't download but a Chromium build already
exists under `PLAYWRIGHT_BROWSERS_PATH`, pin the pip package to match instead
(check the build number in that dir; e.g. build `1194` ⇒ `pip install
playwright==1.56`). `imageio-ffmpeg` provides a static libx264 ffmpeg; a system
`ffmpeg` on `PATH` is used if present.

## How it works (for debugging / extending)

- **`launch.py`** boots the checked-out commit's `main:app` and monkey-patches
  `server.telemetry` `start`/`stop`/`emit` to no-ops, so telemetry-era commits
  run with no Postgres/Grafana. Older commits have no telemetry — the patch is
  guarded.
- **`play.py`** drives two browser contexts (host = winner, guest = loser)
  against one server. It clicks by **button text** (`Create`/`Start`/`Roll`) and
  reads **stable ids** (`#lobby-code` for the join code, `#code-input` to join,
  `#winner-overlay` to detect the win). Rolls are paced above
  `MIN_ROLL_INTERVAL` and the host rolls until the winner overlay appears; the
  guest's screen at that instant is the loss frame. Every step screenshots
  best-effort, so a commit never produces a missing frame.
- **`shoot.py`** is the lightweight `board`-mode driver (create → start →
  screenshot the board).
- **`build_video.py`** stitches `frames/frame_NNN_S.png` via ffmpeg's concat
  demuxer, holding the win/loss beats (steps 6 & 7) longer so each round reads
  as a story.

## Gotchas

- Drive by text/stable-id, **not** by brittle per-version selectors — the
  markup and protocol changed a lot across history (inline-JS era → ES modules,
  server-authoritative rolls → client-side → back, dialog vs div overlay).
- A solo game can't show a loss (there's no "you lost" screen); the 2-player
  setup is what makes both win and loss frames possible.
- Parallel git worktrees on one repo can deadlock on lock files — that's why
  each worker uses a separate `git clone --shared` instead.
- If a commit comes back `PARTIAL` (no win captured), just re-run that index;
  it's almost always a timing fluke, not a real failure.
