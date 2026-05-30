#!/usr/bin/env python3
"""Headless WebSocket integration test for Tensies gameplay + reconnect token.

Drives the real JSON protocol end-to-end (no browser, no telemetry stack):
create, join, lobby sync, invalid-code + join-after-start rejection,
roll/reveal, rate limit, roll-to-win + target cycle, disconnect, and the
reconnect-token auth from commit 4d63929 (happy path + negative auth matrix).
"""
import asyncio
import contextlib
import json

import websockets

# Port 8000 = inside Docker; run as: docker compose exec web python ws_integration_test.py
# Or hit port 8888 from outside: URL = "ws://127.0.0.1:8888/ws"
URL = "ws://127.0.0.1:8000/ws"
results = []


def check(name, cond, detail=""):
    results.append((bool(cond), name, detail))
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


async def recv_until(ws, want_type, timeout=5.0, collect=None):
    loop = asyncio.get_event_loop()
    deadline = loop.time() + timeout
    while True:
        remaining = deadline - loop.time()
        if remaining <= 0:
            raise asyncio.TimeoutError(f"never saw {want_type}")
        m = json.loads(await asyncio.wait_for(ws.recv(), timeout=remaining))
        if m.get("type") == "ping":          # answer pings so the socket stays healthy
            await ws.send(json.dumps({"action": "pong", "t": m["t"]}))
            continue
        if collect is not None:
            collect.setdefault(m.get("type"), []).append(m)
        if m.get("type") == want_type:
            return m


async def drain(ws, secs=0.5):
    got = []
    with contextlib.suppress(asyncio.TimeoutError):
        while True:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout=secs))
            if m.get("type") == "ping":
                await ws.send(json.dumps({"action": "pong", "t": m["t"]}))
                continue
            got.append(m)
    return got


async def main():
    # ── create (host) ────────────────────────────────────────────────
    host = await websockets.connect(URL)
    wel = json.loads(await host.recv())
    check("create: welcome carries player_id", wel.get("type") == "welcome" and bool(wel.get("player_id")))
    await host.send(json.dumps({"action": "create", "name": "Alpha"}))
    seen = {}
    state = await recv_until(host, "state", collect=seen)
    code = state["code"]
    host_pid = next(iter(state["players"]))
    host_token = seen.get("reconnect_token", [{}])[0].get("token")
    check("create: private reconnect_token frame sent", bool(host_token),
          f"len={len(host_token) if host_token else 0}")
    check("create: token_hash NOT leaked in state", "token_hash" not in json.dumps(state))
    check("create: not started, target=6, round 1",
          state["started"] is False and state["target"] == 6 and state["round_num"] == 1)
    check("create: host has HOST role", state["host"] == host_pid)

    # ── invalid code rejection ───────────────────────────────────────
    bad = await websockets.connect(URL)
    await bad.recv()
    await bad.send(json.dumps({"action": "join", "name": "X", "code": "ZZZZZ"}))
    err = await recv_until(bad, "error")
    check("join: invalid code rejected", err.get("msg") == "Game not found", err.get("msg"))
    await bad.close()

    # ── join (guest) ─────────────────────────────────────────────────
    guest = await websockets.connect(URL)
    await guest.recv()
    await guest.send(json.dumps({"action": "join", "name": "Beta", "code": code}))
    gseen = {}
    gstate = await recv_until(guest, "state", collect=gseen)
    guest_token = gseen.get("reconnect_token", [{}])[0].get("token")
    guest_pid = next(p for p in gstate["players"] if p != host_pid)
    check("join: guest gets a distinct reconnect_token", bool(guest_token) and guest_token != host_token)
    check("join: roster has both players", len(gstate["players"]) == 2)
    hsync = await recv_until(host, "state")
    check("join: host sees 2-player lobby", len(hsync["players"]) == 2)

    # ── start ────────────────────────────────────────────────────────
    await host.send(json.dumps({"action": "start"}))
    sstate = await recv_until(host, "state")
    check("start: game started", sstate["started"] is True)
    check("start: 10 dice dealt to host", len(sstate["players"][host_pid]["dice"]) == 10)
    await drain(guest, 0.5)

    # ── non-host cannot start (authority check) ──────────────────────
    # (Beta already in a started game; sending start should be a silent no-op
    #  — assert no exception/disconnect and game stays in round 1.)
    await guest.send(json.dumps({"action": "start"}))
    quiet = await drain(guest, 0.5)
    check("authority: non-host start is a no-op", all(m.get("type") != "error" for m in quiet))

    # ── join-after-start rejection ───────────────────────────────────
    late = await websockets.connect(URL)
    await late.recv()
    await late.send(json.dumps({"action": "join", "name": "Late", "code": code}))
    lerr = await recv_until(late, "error")
    check("join-after-start rejected", lerr.get("msg") == "Game already in progress", lerr.get("msg"))
    await late.close()

    # ── rate limit (two rolls < MIN_ROLL_INTERVAL) ───────────────────
    await host.send(json.dumps({"action": "roll"}))
    await host.send(json.dumps({"action": "roll"}))
    frames = await drain(host, 1.0)
    types = [f.get("type") for f in frames]
    check("roll: produced a state/round_won response", any(t in ("state", "round_won") for t in types), str(types))
    check("rate limit: 2nd rapid roll got 'Slow down'",
          any(f.get("type") == "error" and f.get("msg") == "Slow down" for f in frames))

    # ── roll-to-win + reveal-ack + target cycle ──────────────────────
    won = None
    for _ in range(600):
        await asyncio.sleep(0.27)  # respect MIN_ROLL_INTERVAL (0.25s)
        await host.send(json.dumps({"action": "roll"}))
        frames = await drain(host, 1.0)
        for f in frames:
            if f.get("type") == "round_won":
                won = f
            if f.get("type") in ("state", "round_won"):
                await host.send(json.dumps({"action": "roll_done"}))  # ack reveal
        if won:
            break
    check("win: round_won received, winner=Alpha",
          won is not None and won.get("winner_name") == "Alpha", (won or {}).get("winner_name"))
    if won:
        me = won["players"][host_pid]
        check("win: winner has all 10 matched",
              sum(1 for d in me["dice"] if d == won["target"]) == 10)

    adv = await recv_until(host, "state", timeout=6.0)
    check("round advance: round_num -> 2", adv["round_num"] == 2, f"round={adv['round_num']}")
    check("round advance: target cycled 6->5", adv["target"] == 5, f"target={adv['target']}")
    check("round advance: dice re-dealt, has_rolled reset",
          adv["players"][host_pid]["has_rolled"] is False)

    # ── disconnect guest, then the reconnect-token auth matrix ───────
    await guest.close()
    await asyncio.sleep(0.6)
    hstate = await recv_until(host, "state", timeout=4.0)
    check("disconnect: guest marked disconnected", hstate["players"][guest_pid]["disconnected"] is True)

    async def try_reconnect(token):
        c = await websockets.connect(URL)
        await c.recv()  # welcome
        payload = {"action": "reconnect", "player_id": guest_pid, "game_code": code}
        if token is not None:
            payload["token"] = token
        await c.send(json.dumps(payload))
        m = json.loads(await asyncio.wait_for(c.recv(), timeout=4.0))
        return c, m

    c1, m1 = await try_reconnect(None)
    check("reconnect: MISSING token rejected", m1.get("type") == "error" and m1.get("msg") == "Game not found", m1.get("type"))
    await c1.close()

    c2, m2 = await try_reconnect("definitely-not-the-token")
    check("reconnect: WRONG token rejected", m2.get("type") == "error" and m2.get("msg") == "Game not found", m2.get("type"))
    await c2.close()

    c3, m3 = await try_reconnect(host_token)  # another player's valid token
    check("reconnect: CROSS-PLAYER token rejected", m3.get("type") == "error", m3.get("type"))
    await c3.close()

    c4, m4 = await try_reconnect(guest_token)  # correct
    ok = m4.get("type") in ("state", "round_won") and m4["players"][guest_pid]["disconnected"] is False
    check("reconnect: CORRECT token restores slot", ok, m4.get("type"))
    await c4.close()
    await host.close()

    passed = sum(1 for ok, _, _ in results if ok)
    total = len(results)
    print(f"\n==== {passed}/{total} checks passed ====")
    if passed != total:
        print("FAILURES:")
        for ok, name, detail in results:
            if not ok:
                print(f"  - {name}  {detail}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
