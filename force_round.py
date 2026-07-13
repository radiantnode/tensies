"""Force a round win for a player by setting 9/10 dice to target, then
rolling until the last die matches. Run inside the container:
    python force_round.py <game_code> <winner_pid>
"""
import asyncio, json, os, sys
import redis.asyncio as aioredis

async def main():
    code, winner_pid = sys.argv[1], sys.argv[2]
    r = aioredis.from_url(os.environ["REDIS_URL"])
    g = f"game:{code}"

    current_round = int(await r.hget(g, "round_num"))
    target = int(await r.hget(g, "target"))
    p = f"p:{winner_pid}:"

    # Set 9 dice to target, 1 different, with 9 locked
    other = (target % 6) + 1
    await r.hset(g, p + "dice", json.dumps([target]*9 + [other]))
    await r.hset(g, p + "locked", json.dumps([True]*9 + [False]))
    await r.hset(g, p + "has_rolled", 1)
    if int(await r.hget(g, p + "roll_count") or 0) == 0:
        await r.hset(g, p + "roll_count", 1)

    print(f"ready round={current_round} target={target} pid={winner_pid[:8]}")
    await r.aclose()

asyncio.run(main())
