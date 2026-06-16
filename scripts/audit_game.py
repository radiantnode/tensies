#!/usr/bin/env python3
"""CLI front-end for the Tensies game audit (the engine lives in server/audit.py).

Reads every event recorded for a game code from Postgres and verifies it for
ACCURACY (every roll reconstructs to the game rules), REALISM (timing, win
conditions, target cycle) and FAIRNESS (chi-square dice tests). See
server/audit.py for the full description of every check.

The audit reads ONLY recorded data — it never touches live game state — so it
is safe to run against production at any time. The same engine backs the public
HTTP endpoint  GET /api/games/{code}/audit.

Usage:
    python scripts/audit_game.py <GAME_CODE> [--dsn DSN] [--json] [--markdown FILE]
                                             [--alpha 0.01] [--max-examples 5]

In a deployed stack the web container already has POSTGRES_DSN in its
environment, so the simplest invocation is:

    docker compose -f docker-compose.prod.yml exec web \
        python scripts/audit_game.py ABCDE

Exit status: 0 if the audit passes (no errors), 1 if any ERROR-level finding is
raised, 2 on usage/connection failure. WARN-level findings (e.g. a statistical
fairness flag, which is expected occasionally by chance) do not fail the run.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Allow running as a plain script (python scripts/audit_game.py) as well as a
# module — make the repo root importable so `server.audit` resolves.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server.audit import (  # noqa: E402
    audit, load_events, render_markdown, render_text, report_to_dict,
)

DEFAULT_DSN = "postgresql://tensies:tensies@postgres:5432/tensies"


async def _main_async(args) -> int:
    import asyncpg  # imported lazily so --help works without the driver present
    dsn = args.dsn or os.environ.get("POSTGRES_DSN") or DEFAULT_DSN
    code = args.code.upper().strip()
    try:
        con = await asyncpg.connect(dsn)
    except Exception as e:
        print(f"error: could not connect to Postgres ({dsn.split('@')[-1]}): {e}",
              file=sys.stderr)
        return 2
    try:
        events = await load_events(con, code)
    finally:
        await con.close()

    rep = audit(code, events, alpha=args.alpha, max_examples=args.max_examples)

    if args.json:
        print(json.dumps(report_to_dict(rep), indent=2, default=str))
    else:
        print(render_text(rep))

    if args.markdown:
        Path(args.markdown).write_text(render_markdown(rep))
        if not args.json:
            print(f"\n  Markdown report written to {args.markdown}")

    return 0 if rep.passed else 1


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Forensic accuracy/realism/fairness audit of one Tensies game.")
    ap.add_argument("code", help="game code to audit")
    ap.add_argument("--dsn", help="Postgres DSN (default: $POSTGRES_DSN or the app default)")
    ap.add_argument("--alpha", type=float, default=0.01,
                    help="significance threshold for fairness tests (default 0.01)")
    ap.add_argument("--max-examples", type=int, default=5,
                    help="max example rows to show per failing check (default 5)")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of text")
    ap.add_argument("--markdown", metavar="FILE", help="also write a Markdown report")
    args = ap.parse_args()
    try:
        return asyncio.run(_main_async(args))
    except KeyboardInterrupt:
        return 2


if __name__ == "__main__":
    sys.exit(main())
