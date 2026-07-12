# Tensies build-progression timelapse

A video that walks the entire git history of this app, oldest commit to newest,
playing a real round on each one so you can watch the game grow up — from the
first dark-themed board to the polished wood-table, 3D-dice, telemetry-era app.

![tensies-gameplay-timelapse.mp4](tensies-gameplay-timelapse.mp4)

`tensies-gameplay-timelapse.mp4` is the rendered result.

## What it does

For **every commit** on `HEAD` (oldest → newest) the pipeline:

1. checks the commit out into a throwaway clone,
2. launches **just the app** — telemetry (Postgres/Prometheus/Grafana) is
   monkey-patched to no-ops so even the telemetry-era commits boot with no
   external services,
3. drives it with headless Chromium, and
4. screenshots, then stitches all the frames into one MP4.

Two capture modes:

| Mode    | Frames/commit | What you see |
|---------|---------------|--------------|
| `arc` (default) | 8 | A full **2-player round**: loading → landing → lobby (both players) → fresh board → first roll → dice locking onto the target → **WIN** (winner's overlay), then the **opponent's losing view** of the same moment. |
| `board` | 1 | A single fresh game board per commit (fast, minimal). |

The `arc` driver runs two browser contexts against one server: the host plays to
a win while the guest is left behind, so the same instant is captured as both a
win (10/10 locked) and a loss (e.g. 7/10). Everything is driven by **stable
selectors** (`#lobby-code`, `#code-input`, `#winner-overlay`) and **button text**
(`Create` / `Start` / `Roll`), which survive the markup and protocol drift across
the project's history.

### Capture device & output

Frames are captured in a real **mobile** browser context emulating an
**iPhone 17 Pro Max** — viewport 440×956 CSS pts at DPR 3 → native **1320×2868**
pixels, `is_mobile`/`has_touch`, iOS Safari UA — so the page renders its true
phone layout (not a desktop window scaled down). To target a different device,
edit the `DEVICE` dict at the top of `bin/play.py`.

The video keeps that native resolution and is encoded for phones: H.264 **Main**
+ `yuv420p`, **CRF 26 / `veryslow` / `-tune stillimage`** (the frames are
stills), a silent AAC track, and `+faststart`. At native 3× the result is large
(~80 MB for the full history); raise CRF for a smaller file.

## Usage

```bash
# from anywhere inside the repo
Timelapse/bin/make_timelapse.sh            # arc mode, 4 parallel workers
Timelapse/bin/make_timelapse.sh board 6    # quick board-only, 6 workers
Timelapse/bin/make_timelapse.sh arc 4 /path/to/repo
```

Output is written to `Timelapse/tensies-gameplay-timelapse.mp4`. Scratch clones
and raw frames live in `Timelapse/.work/` and `Timelapse/frames/` (gitignored).

## Prerequisites

```bash
pip install playwright imageio-ffmpeg
playwright install chromium
```

Notes:
- `imageio-ffmpeg` ships a static ffmpeg with libx264; the build script falls
  back to a system `ffmpeg` on `PATH` if one exists.
- Playwright's pip package and its browser build must match. If
  `playwright install chromium` can't download (offline/firewalled) but a
  Chromium build already exists under `PLAYWRIGHT_BROWSERS_PATH`, pin the pip
  package to the matching version instead (e.g. build 1194 ⇒ `playwright==1.56`).

## Files

| File | Role |
|------|------|
| `bin/make_timelapse.sh` | orchestrator — clones, parallel workers, then builds the video |
| `bin/launch.py` | boots a commit's `main:app`, telemetry neutralized |
| `bin/play.py` | 2-player gameplay arc → 8 frames (`arc` mode) |
| `bin/shoot.py` | single fresh-board screenshot (`board` mode) |
| `bin/build_video.py` | frames → MP4 (native res, mobile compression), holding the win/loss beats longer |
