#!/usr/bin/env python3
"""Bar-themed release codename generator for Tensies.

Every release in docs/CHANGELOG.md has a drink/bar codename ("Opening Tab",
"Happy Hour", "Last Call", "Provably Fair Pour"…). Coming up with a fresh one
each time is a small tax on the changelog skill. This proposes a few that aren't
already used, so the naming stays on-brand without repeating.

Deterministic by design (no RNG) so it plays nice with a sandbox that blocks
Math.random/Date.now equivalents — it ranks candidates by how *unlike* the names
you've already shipped they are, and prints the top few.

    python docs/fable5-review/examples/scripts/codename.py          # 5 suggestions
    python docs/fable5-review/examples/scripts/codename.py --n 10    # more
    python docs/fable5-review/examples/scripts/codename.py --all     # the whole pool, minus used
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

# A pool of bar/drink-night phrases. Extend freely — keep them evocative and
# short (two words reads best as a release name).
POOL = [
    "Neat Pour", "On the House", "Double Shot", "Bottoms Up", "Corner Booth",
    "Well Drink", "Top Shelf", "House Special", "Bar Snacks", "Wingman",
    "Free Pour", "Long Pour", "Short Pour", "Chaser", "Back Bar",
    "Bar Cart", "Coaster", "Bottle Service", "Bar None", "Rail Drink",
    "Garnish", "Bitters", "Muddle", "Shaken", "Stirred", "Twist of Lime",
    "Extra Olive", "Dirty Martini", "Neon Sign", "Jukebox", "Peanut Bowl",
    "Tab Runner", "Bar Fly", "Regular Order", "Usual Spot", "Cork Pull",
    "Ice Bucket", "Speakeasy", "Nightcap Redux", "Two Fingers", "Splash of Soda",
    "Cheers to That", "Round Two", "Buy Back", "Comp'd", "Sober Ride",
    "Designated Roller", "Barback", "Call Drink", "Signature Sip", "Last Pour",
]


def used_names(changelog: Path) -> set[str]:
    if not changelog.exists():
        return set()
    text = changelog.read_text(encoding="utf-8")
    # Matches: ## 1.23.0 ("Regular's Tab")
    return {m.strip().lower() for m in re.findall(r'##\s+\S+\s+\("([^"]+)"\)', text)}


def score(candidate: str, used: set[str]) -> int:
    """Higher = more distinct from what's shipped. We reward candidates whose
    words don't appear in any used name (deterministic, no randomness)."""
    used_words = {w for name in used for w in re.findall(r"[a-z]+", name.lower())}
    cand_words = set(re.findall(r"[a-z]+", candidate.lower()))
    overlap = len(cand_words & used_words)
    return len(candidate) - 5 * overlap  # penalize reused words, mild length pref


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--n", type=int, default=5, help="how many to suggest")
    ap.add_argument("--all", action="store_true", help="print the full unused pool")
    ap.add_argument(
        "--changelog",
        default="docs/CHANGELOG.md",
        help="path to the changelog (to avoid used names)",
    )
    args = ap.parse_args()

    used = used_names(Path(args.changelog))
    unused = [c for c in POOL if c.lower() not in used]

    if args.all:
        for c in sorted(unused):
            print(c)
        return

    ranked = sorted(unused, key=lambda c: score(c, used), reverse=True)
    print(f"# {len(used)} names already used; {len(unused)} unused in pool")
    for c in ranked[: args.n]:
        print(f'  "{c}"')


if __name__ == "__main__":
    main()
