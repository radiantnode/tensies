#!/usr/bin/env python3
"""Emit the per-commit worklist for the screen-design timelapse.

One line per CSS-touching commit (oldest->newest): "<idx> <sha> <screens_csv>".
Each screen is enabled only from the commit it first existed (gated by commit
time). Core screens exist from the start.

Usage: gen_worklist.py <repo> > worklist.txt
"""
import subprocess
import sys

REPO = sys.argv[1] if len(sys.argv) > 1 else "."

# First-existence commits (their committer unix time gates the screen).
GATES = {
    "menu": "81b8359",
    "profile": "bac28ae",
    "postgame": "2c1b2b6",
    "places": "cbbe222",
}
CORE = ["landing", "join", "lobby", "board", "win", "lose"]


def ct(ref):
    return int(subprocess.check_output(
        ["git", "-C", REPO, "show", "-s", "--format=%ct", ref]).decode().strip())


def main():
    gate_ts = {k: ct(v) for k, v in GATES.items()}
    # CSS-touching commits, oldest -> newest, with committer timestamp.
    out = subprocess.check_output(
        ["git", "-C", REPO, "log", "--reverse", "--format=%H %ct", "HEAD", "--", "*.css"]
    ).decode().splitlines()
    for i, line in enumerate(out):
        sha, cts = line.split()
        cts = int(cts)
        screens = list(CORE)
        for name, ts in gate_ts.items():
            if cts >= ts:
                screens.append(name)
        print(f"{i:04d} {sha} {','.join(screens)}")


if __name__ == "__main__":
    main()
