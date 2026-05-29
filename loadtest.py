"""Concurrent-games load driver. Each game = 2 headless WS clients running the
real protocol (create/join/start/roll/roll_done + pong). Ramps through sizes."""
import asyncio, json, sys, time, urllib.request
from collections import defaultdict
import websockets

URL = "ws://localhost:8000/ws"
ROLL_SECONDS = 6
SETUP_SEM = None          # created inside the loop; caps concurrent connect/setup
SETUP_CONCURRENCY = 400


def metric(name):
    try:
        data = urllib.request.urlopen("http://localhost:8000/metrics", timeout=5).read().decode()
        for line in data.splitlines():
            if line.startswith(name + " ") or line.startswith(name + "\t"):
                return float(line.split()[-1])
    except Exception:
        pass
    return None


async def recv_until(ws, typ, t=15):
    while True:
        m = json.loads(await asyncio.wait_for(ws.recv(), t))
        if m.get("type") == "ping":
            await ws.send(json.dumps({"action": "pong", "t": m["t"]}))
            continue
        if m.get("type") == typ:
            return m


async def reader(ws, st):
    try:
        async for raw in ws:
            m = json.loads(raw)
            if m.get("type") == "ping":
                await ws.send(json.dumps({"action": "pong", "t": m["t"]}))
            elif m.get("type") == "round_won":
                st["wins"] += 1
    except asyncio.CancelledError:
        raise
    except Exception:
        st["disconnects"] += 1


async def roller(ws, deadline, st):
    while time.monotonic() < deadline:
        try:
            await ws.send(json.dumps({"action": "roll"}))
            st["rolls"] += 1
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"action": "roll_done"}))
        except Exception:
            st["errors"] += 1
            return
        await asyncio.sleep(0.3)


async def run_game(i, deadline, st):
    host = guest = None
    try:
        async with SETUP_SEM:          # ramp connection setup to avoid a thundering herd
            host = await websockets.connect(URL, max_queue=None, open_timeout=30)
            await recv_until(host, "welcome")
            await host.send(json.dumps({"action": "create", "name": f"H{i}"}))
            code = (await recv_until(host, "state"))["code"]
            st["games"] += 1
            guest = await websockets.connect(URL, max_queue=None, open_timeout=30)
            await recv_until(guest, "welcome")
            await guest.send(json.dumps({"action": "join", "name": f"G{i}", "code": code}))
            await recv_until(guest, "state")
            st["joins"] += 1
            await host.send(json.dumps({"action": "start"}))
            st["starts"] += 1
        ht = asyncio.create_task(reader(host, st))
        gt = asyncio.create_task(reader(guest, st))
        await asyncio.gather(roller(host, deadline, st), roller(guest, deadline, st))
        ht.cancel(); gt.cancel()
    except Exception:
        st["errors"] += 1
    finally:
        for ws in (host, guest):
            if ws is not None:
                try: await ws.close()
                except Exception: pass


async def batch(n):
    st = defaultdict(int)
    t0 = time.monotonic()
    setup_budget = max(4, n / 40)     # scale setup window with size (~25s at 1000)
    deadline = t0 + setup_budget + ROLL_SECONDS
    games = [asyncio.create_task(run_game(i, deadline, st)) for i in range(n)]
    # Sample server gauges once setup should be mostly complete
    await asyncio.sleep(setup_budget)
    ga = metric("tensies_games_active")
    conns = metric("tensies_ws_connections_active")
    await asyncio.gather(*games)
    dt = time.monotonic() - t0
    await asyncio.sleep(1.5)  # let last-player disconnects tear games down
    print(f"[{n:>4} games] created={st['games']:>4} joined={st['joins']:>4} "
          f"started={st['starts']:>4} | rolls={st['rolls']:>6} "
          f"({st['rolls']/dt:>6.0f}/s) wins={st['wins']:>4} "
          f"| peak_games_active={ga} peak_conns={conns} "
          f"| errors={st['errors']} disconnects={st['disconnects']} "
          f"| games_active_after={metric('tensies_games_active')}")


async def main():
    global SETUP_SEM
    SETUP_SEM = asyncio.Semaphore(SETUP_CONCURRENCY)
    sizes = [int(x) for x in sys.argv[1:]] or [25, 100, 250]
    print(f"Load test — sizes={sizes}, roll window={ROLL_SECONDS}s each, "
          f"setup_concurrency={SETUP_CONCURRENCY}")
    for n in sizes:
        await batch(n)


asyncio.run(main())
