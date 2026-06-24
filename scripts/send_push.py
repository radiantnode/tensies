#!/usr/bin/env python3
"""Send a Web Push notification to a single account.

    python scripts/send_push.py --user <uuid|username> \
        --title "Your turn" --body "Tap to roll" [--url /ABCDE]

`--user` accepts either a users.id UUID or a username (case-insensitive). The
send goes through the same server/push.send_to_user path the app uses, so dead
subscriptions are pruned and the result count is authoritative.

Run it where the env is configured (POSTGRES_DSN + the VAPID_* vars +
PUSH_ENABLED=1), e.g. inside the web container:

    docker compose exec web python scripts/send_push.py --user alice \
        --title "Hi" --body "Test"
"""
import argparse
import asyncio
import pathlib
import sys
import uuid

# Allow `python scripts/send_push.py` from the repo root: the script's own dir
# (scripts/) is what Python puts on sys.path, so add the repo root for `server`.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from server import db, push  # noqa: E402


async def _resolve_user_id(token: str) -> str | None:
    """A UUID is taken as-is; anything else is looked up as a username."""
    try:
        return str(uuid.UUID(token))
    except ValueError:
        pass
    async with db.pool().acquire() as con:
        row = await con.fetchrow(
            "SELECT id FROM users WHERE username_lower = $1", token.lower()
        )
    return str(row["id"]) if row else None


async def main() -> int:
    ap = argparse.ArgumentParser(description="Send a Web Push to one account.")
    ap.add_argument("--user", required=True, help="user UUID or username")
    ap.add_argument("--title", required=True)
    ap.add_argument("--body", required=True)
    ap.add_argument("--url", default=None, help="path to open on click (default /)")
    args = ap.parse_args()

    if not push.is_configured():
        print(
            "push not configured: set PUSH_ENABLED=1 and VAPID_PUBLIC_KEY/"
            "VAPID_PRIVATE_KEY (see scripts/gen_vapid.py).",
            file=sys.stderr,
        )
        return 2

    await db.init()
    try:
        user_id = await _resolve_user_id(args.user)
        if user_id is None:
            print(f"no account matches {args.user!r}", file=sys.stderr)
            return 1
        delivered = await push.send_to_user(user_id, args.title, args.body, args.url)
    finally:
        await db.close()

    print(f"delivered to {delivered} subscription(s) for user {user_id}")
    return 0 if delivered else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
