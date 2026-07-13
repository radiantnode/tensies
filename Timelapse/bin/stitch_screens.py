#!/usr/bin/env python3
"""Dedup + stitch per-screen design-progression clips.

For each screen dir under <root>, order frames by commit index, drop frames
that are perceptually near-identical to the previous kept one (design didn't
change — tolerates dynamic content like dice/codes/names), then encode a short
clip. One .mp4 per screen under <outdir>.

Usage: stitch_screens.py <root_frames> <outdir> [screen=threshold ...]
"""
import os
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image

ROOT = sys.argv[1]
OUTDIR = sys.argv[2]
os.makedirs(OUTDIR, exist_ok=True)
FF = imageio_ffmpeg.get_ffmpeg_exe()

# Per-screen Hamming-distance threshold on a 64-bit dHash: a frame is kept only
# if it differs from the last kept frame by MORE than this. Static screens use a
# low value (catch subtle design tweaks); content-heavy screens (dice/codes) use
# a higher value so gameplay randomness alone doesn't count as a design change.
DEFAULT_THRESH = {
    "landing": 6, "join": 6, "lobby": 8, "board": 14, "win": 12, "lose": 12,
    "menu": 6, "profile": 4, "postgame": 4, "places": 6,
}
# Per-frame hold (seconds) and the final-frame hold.
HOLD = 0.5
FINAL_HOLD = 1.8
SCALE_W = 720


def dhash(path, size=8):
    img = Image.open(path).convert("L").resize((size + 1, size), Image.BILINEAR)
    a = np.asarray(img, dtype=np.int16)
    diff = a[:, 1:] > a[:, :-1]
    return np.packbits(diff.flatten())


def ham(a, b):
    return int(np.unpackbits(a ^ b).sum())


def dedup(frames, thresh):
    kept = []
    last = None
    for f in frames:
        try:
            h = dhash(f)
        except Exception:
            continue
        if last is None or ham(h, last) > thresh:
            kept.append(f)
            last = h
    # always include the final design state even if similar to prior kept
    if frames and frames[-1] not in kept:
        kept.append(frames[-1])
    return kept


def build(screen, kept):
    if not kept:
        return None
    concat = os.path.join(OUTDIR, f"_{screen}.txt")
    with open(concat, "w") as fh:
        fh.write("ffconcat version 1.0\n")
        for i, f in enumerate(kept):
            fh.write(f"file '{os.path.abspath(f)}'\n")
            fh.write(f"duration {FINAL_HOLD if i == len(kept) - 1 else HOLD}\n")
        fh.write(f"file '{os.path.abspath(kept[-1])}'\n")  # concat quirk: last needs a repeat
    out = os.path.join(OUTDIR, f"{screen}.mp4")
    cmd = [
        FF, "-y", "-f", "concat", "-safe", "0", "-i", concat,
        "-vf", f"scale={SCALE_W}:-2:flags=lanczos,format=yuv420p,fps=30",
        "-c:v", "libx264", "-profile:v", "main", "-crf", "27", "-preset", "medium",
        "-movflags", "+faststart", out,
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(concat)
    return out


def main():
    overrides = {}
    for a in sys.argv[3:]:
        k, v = a.split("=")
        overrides[k] = int(v)
    screens = sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d)))
    for screen in screens:
        d = os.path.join(ROOT, screen)
        frames = sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith(".png"))
        if not frames:
            continue
        thresh = overrides.get(screen, DEFAULT_THRESH.get(screen, 8))
        kept = dedup(frames, thresh)
        out = build(screen, kept)
        sz = os.path.getsize(out) / 1e6 if out and os.path.exists(out) else 0
        print(f"{screen:9s}  {len(frames):3d} frames -> {len(kept):3d} kept  "
              f"(thresh {thresh})  {sz:.1f}MB  {os.path.basename(out) if out else '-'}")


if __name__ == "__main__":
    main()
