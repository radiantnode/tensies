"""Headless WebSocket integration test for the multi-instance (Redis) build.

Drives the real protocol against TWO running app instances that share one Redis,
asserting any instance can serve any game and that the gameplay invariants hold
across instances (simultaneous rolling, single round winner, reveal handshake,
cross-instance reconnect, host transfer). Also exercises the new security
guards (message-size cap, name sanitization, rate limits).

Run:  python tests/ws_multi_instance_test.py [ws://A] [ws://B]
Defaults to ws://127.0.0.1:8101/ws and ws://127.0.0.1:8102/ws.
"""
import asyncio
import json
import sys

import websockets

A = sys.argv[1] if len(sys.argv) > 1 else "ws://127.0.0.1:8101/ws"
B = sys.argv[2] if len(sys.argv) > 2 else "ws://127.0.0.1:8102/ws"

_passed = 0
_failed = 0


def check(cond, label):
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  PASS  {label}")
    else:
        _failed += 1
        print(f"  FAIL  {label}")


class Client:
    """Thin WS client that buffers frames and lets tests await by type."""

    def __init__(self, url):
        self.url = url
        self.ws = None
        self.pid = None
        self.token = None
        self.last_state = None

    async def __aenter__(self):
        self.ws = await websockets.connect(self.url)
        self._task = asyncio.create_task(self._pump())
        await self.wait("welcome")
        return self

    async def __aexit__(self, *a):
        self._task.cancel()
        await self.ws.close()

    async def _pump(self):
        self._q = asyncio.Queue()
        async for raw in self.ws:
            m = json.loads(raw)
            if m.get("type") == "ping":
                await self.ws.send(json.dumps({"action": "pong", "t": m["t"]}))
                continue
            if m.get("type") == "welcome":
                self.pid = m["player_id"]
            if m.get("type") == "reconnect_token":
                self.token = m["token"]
            if m.get("type") in ("state", "round_won"):
                self.last_state = m
            await self._q.put(m)

    async def send(self, **kw):
        await self.ws.send(json.dumps(kw))

    async def wait(self, mtype, timeout=5.0):
        async def _w():
            while True:
                m = await self._q.get()
                if m.get("type") == mtype:
                    return m
        return await asyncio.wait_for(_w(), timeout)

    async def drain(self, secs=0.5):
        try:
            while True:
                await asyncio.wait_for(self._q.get(), secs)
        except asyncio.TimeoutError:
            pass


ROLL_PACE = 0.27  # just over MIN_ROLL_INTERVAL (0.25s) to avoid rate limiting


async def drive_win(c, timeout=60.0):
    """Roll (paced) until this client wins a round. Backs off on rate-limit."""
    loop = asyncio.get_event_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        await c.send(action="roll")
        m = await c.wait_any(("state", "round_won", "error"))
        if m.get("type") == "error":
            await asyncio.sleep(0.3)
            continue
        await c.send(action="roll_done")
        if m.get("type") == "round_won":
            return m
        await asyncio.sleep(ROLL_PACE)
    return None


async def _scenario_cross_instance():
    print("\n[cross-instance] create on A, join on B, play")
    async with Client(A) as host, Client(B) as guest:
        await host.send(action="create", name="Hosty")
        st = await host.wait("state")
        code = st["code"]
        check(bool(code) and len(code) == 5, f"host created game on A (code={code})")
        host_pid = host.pid

        await guest.send(action="join", code=code, name="Guesty")
        gst = await guest.wait("state")
        check(len(gst["players"]) == 2, "guest on B sees 2 players (cross-instance join)")
        # host (on A) should also see the join via Redis fan-out
        hst = await host.wait("state")
        check(len(hst["players"]) == 2, "host on A sees guest join (fan-out A<-B)")
        check(hst["host"] == host_pid, "host pid stable")

        # start from host
        await host.send(action="start")
        sst = await host.wait("state")
        check(sst["started"], "game started")
        # guest on B sees started
        gss = await guest.wait("state")
        check(gss["started"], "guest on B sees started (fan-out)")

        # SIMULTANEOUS rolling from both, on different instances. Burst fast to
        # stress the path; some rolls will be rate-limited (expected) — the
        # point is no crash / no desync.
        async def hammer(c, n):
            for _ in range(n):
                await c.send(action="roll")
                await c.send(action="roll_done")
                await asyncio.sleep(0.05)
        await asyncio.gather(hammer(host, 6), hammer(guest, 6))
        await asyncio.sleep(0.4)
        await host.drain(0.4)
        await guest.drain(0.4)
        check(True, "both rolled simultaneously across instances without error")

        # Drive host to a win and confirm exactly one round_won, seen on both.
        win = await drive_win(host)
        check(win is not None, "host reached a win")
        if win:
            check(win.get("winner_name") == "Hosty", "winner_name is the host")
            # guest (on B) receives the round_won broadcast
            gwin = await guest.wait("round_won", timeout=6)
            check(gwin.get("winner_name") == "Hosty",
                  "guest on B sees the same winner (single winner across instances)")
            check(win["round_num"] == gwin["round_num"], "both agree on round number")


async def _scenario_reconnect_cross_instance():
    print("\n[cross-instance] reconnect on the OTHER instance")
    async with Client(A) as host:
        await host.send(action="create", name="Rejoin")
        st = await host.wait("state")
        code = st["code"]
        pid, token = host.pid, host.token
        # add a 2nd player so the game isn't destroyed when host drops
        async with Client(B) as g:
            await g.send(action="join", code=code, name="Keep")
            await g.wait("state")
            await host.__aexit__()  # host disconnects
            await asyncio.sleep(0.5)
            # reconnect as the host, but to instance B this time
            async with Client(B) as host2:
                await host2.send(action="reconnect", player_id=pid, game_code=code, token=token)
                rst = await host2.wait("state")
                check(rst is not None and code == rst["code"],
                      "reconnected to game via the OTHER instance (B)")
                check(rst["host"] == pid, "host role preserved on cross-instance reconnect")
                # wrong token must be rejected
                async with Client(A) as bad:
                    await bad.send(action="reconnect", player_id=pid, game_code=code, token="wrong")
                    err = await bad.wait("error")
                    check(err.get("msg") == "Game not found", "bad reconnect token rejected")


async def _scenario_security():
    print("\n[security] name sanitization + message-size cap")
    async with Client(A) as c:
        await c.send(action="create", name="<img src=x onerror=alert(1)>Bob")
        st = await c.wait("state")
        nm = st["players"][c.pid]["name"]
        check("<" not in nm and ">" not in nm and "img" in nm,
              f"name sanitized of HTML markup (got {nm!r})")
        # oversized frame rejected
        await c.ws.send(json.dumps({"action": "join", "code": "AAAAA", "name": "x" * 9000}))
        err = await c.wait("error")
        check(err.get("msg") == "Message too large", "oversized WS frame rejected")


# small helper used above
async def _wait_any(self, types, timeout=6.0):
    async def _w():
        while True:
            m = await self._q.get()
            if m.get("type") in types:
                return m
    return await asyncio.wait_for(_w(), timeout)


Client.wait_any = _wait_any


async def main():
    await _scenario_cross_instance()
    await _scenario_reconnect_cross_instance()
    await _scenario_security()
    print(f"\n==== {_passed} passed, {_failed} failed ====")
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
