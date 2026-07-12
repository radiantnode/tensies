#!/usr/bin/env python3
"""Stitch frame_NNN_S.png files into the timelapse MP4.

Usage: build_video.py <frames_dir> <out.mp4> [arc|board]

In "arc" mode the win/loss beats (steps 6 & 7) are held longer so each round
reads as a little story. In "board" mode every frame gets an equal hold.

ffmpeg is taken from PATH if present, otherwise from the imageio-ffmpeg
bundled static build (pip install imageio-ffmpeg).
"""
import glob
import os
import shutil
import subprocess
import sys

FRAMES = sys.argv[1] if len(sys.argv) > 1 else "frames"
OUT = sys.argv[2] if len(sys.argv) > 2 else "tensies-timelapse.mp4"
MODE = sys.argv[3] if len(sys.argv) > 3 else "arc"

# seconds each step (the trailing _S) is held on screen, in "arc" mode
ARC_DUR = {0: 0.16, 1: 0.16, 2: 0.28, 3: 0.22, 4: 0.24, 5: 0.24, 6: 0.55, 7: 0.55}
BOARD_DUR = 0.25


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("ffmpeg not found: install it or `pip install imageio-ffmpeg`")


def main():
    frames = sorted(glob.glob(os.path.join(FRAMES, "frame_*.png")))
    if not frames:
        sys.exit(f"no frames found in {FRAMES}")

    listfile = os.path.join(FRAMES, "_concat.txt")
    with open(listfile, "w") as f:
        f.write("ffconcat version 1.0\n")
        for fr in frames:
            if MODE == "arc":
                step = int(fr.rsplit("_", 1)[1].split(".")[0])
                dur = ARC_DUR.get(step, 0.2)
            else:
                dur = BOARD_DUR
            f.write(f"file '{os.path.abspath(fr)}'\n")
            f.write(f"duration {dur}\n")
        f.write(f"file '{os.path.abspath(frames[-1])}'\n")  # honor last duration

    ff = find_ffmpeg()
    print(f"{len(frames)} frames -> {OUT}")
    # Keep the frames' native resolution (the capture already targets the device
    # — e.g. iPhone 17 Pro Max at 1320x2868). Mobile-friendly compression:
    # H.264 Main + yuv420p, CRF 26 / veryslow / stillimage (frames are stills),
    # a silent AAC track (some mobile/social players reject audioless files),
    # and +faststart for progressive streaming.
    subprocess.run(
        [
            ff, "-y",
            "-f", "concat", "-safe", "0", "-i", listfile,
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-vf", "format=yuv420p,fps=30",
            "-c:v", "libx264", "-profile:v", "main", "-crf", "26",
            "-preset", "veryslow", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "64k", "-shortest",
            "-movflags", "+faststart", OUT,
        ],
        check=True,
    )
    print("done")


if __name__ == "__main__":
    main()
