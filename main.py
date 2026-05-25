import asyncio
import json
import random
import string
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# game_code -> game dict
games: dict[str, dict] = {}
# game_code -> {player_id: WebSocket}
connections: dict[str, dict[str, WebSocket]] = {}


def make_code() -> str:
    while True:
        code = "".join(random.choices(string.ascii_uppercase, k=5))
        if code not in games:
            return code


def fresh_dice() -> list[int]:
    """10 random dice — used for round start (no locking yet)."""
    return [random.randint(1, 6) for _ in range(10)]


def new_game(host_id: str, host_name: str) -> tuple[str, dict]:
    code = make_code()
    games[code] = {
        "target": 6,
        "round_num": 1,
        "started": False,
        "round_over": False,
        "host": host_id,
        "players": {
            host_id: {"name": host_name, "dice": [], "wins": 0, "has_rolled": False}
        },
    }
    connections[code] = {}
    return code, games[code]


def next_target(t: int) -> int:
    # cycles 6 → 5 → 4 → 3 → 2 → 1 → 6 → …
    return (t - 2) % 6 + 1


def state_msg(game: dict, code: str, msg_type: str = "state", **extra) -> dict:
    return {
        "type": msg_type,
        "code": code,
        "target": game["target"],
        "round_num": game["round_num"],
        "started": game["started"],
        "host": game["host"],
        "players": {
            pid: {
                "name": p["name"],
                "dice": p["dice"],
                "wins": p["wins"],
                "has_rolled": p.get("has_rolled", False),
            }
            for pid, p in game["players"].items()
        },
        **extra,
    }


async def broadcast(code: str, message: dict) -> None:
    if code not in connections:
        return
    data = json.dumps(message)
    dead = []
    for pid, ws in list(connections[code].items()):
        try:
            await ws.send_text(data)
        except Exception:
            dead.append(pid)
    for pid in dead:
        connections[code].pop(pid, None)


@app.get("/")
async def root():
    return FileResponse("static/index.html")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    pid = str(uuid.uuid4())
    await ws.send_text(json.dumps({"type": "welcome", "player_id": pid}))
    code: str | None = None

    try:
        while True:
            msg = json.loads(await ws.receive_text())
            action = msg.get("action")

            if action == "create":
                name = (msg.get("name") or "Player")[:20].strip() or "Player"
                code, game = new_game(pid, name)
                connections[code][pid] = ws
                await broadcast(code, state_msg(game, code))

            elif action == "join":
                join_code = (msg.get("code") or "").upper().strip()
                name = (msg.get("name") or "Player")[:20].strip() or "Player"
                if join_code not in games:
                    await ws.send_text(json.dumps({"type": "error", "msg": "Game not found"}))
                    continue
                game = games[join_code]
                if game["started"]:
                    await ws.send_text(json.dumps({"type": "error", "msg": "Game already in progress"}))
                    continue
                code = join_code
                game["players"][pid] = {"name": name, "dice": [], "wins": 0, "has_rolled": False}
                connections[code][pid] = ws
                await broadcast(code, state_msg(game, code))

            elif action == "start":
                if not code or code not in games:
                    continue
                game = games[code]
                if game["host"] != pid:
                    continue
                game["started"] = True
                for p in game["players"].values():
                    p["dice"] = fresh_dice()
                    p["has_rolled"] = False
                await broadcast(code, state_msg(game, code))

            elif action == "roll":
                if not code or code not in games:
                    continue
                game = games[code]
                if not game["started"] or game["round_over"]:
                    continue
                player = game["players"].get(pid)
                if not player:
                    continue

                target = game["target"]
                client_dice = msg.get("dice")

                # Validate: must be exactly 10 ints in range 1–6
                if (
                    not isinstance(client_dice, list)
                    or len(client_dice) != 10
                    or not all(isinstance(d, int) and 1 <= d <= 6 for d in client_dice)
                ):
                    await ws.send_text(json.dumps({"type": "error", "msg": "Invalid dice"}))
                    continue

                # On a re-roll, locked dice (those matching target) must stay locked
                if player.get("has_rolled"):
                    if any(
                        old == target and new != target
                        for old, new in zip(player["dice"], client_dice)
                    ):
                        await ws.send_text(json.dumps({"type": "error", "msg": "Cannot unlock matched dice"}))
                        continue

                player["dice"] = client_dice
                player["has_rolled"] = True

                if all(d == target for d in player["dice"]):
                    game["round_over"] = True
                    player["wins"] += 1
                    await broadcast(
                        code,
                        state_msg(game, code, "round_won", winner_name=player["name"]),
                    )
                    await asyncio.sleep(3)
                    game["target"] = next_target(target)
                    game["round_num"] += 1
                    game["round_over"] = False
                    for p in game["players"].values():
                        p["dice"] = fresh_dice()
                        p["has_rolled"] = False
                    await broadcast(code, state_msg(game, code))
                else:
                    await broadcast(code, state_msg(game, code))

    except WebSocketDisconnect:
        if code and code in games:
            connections[code].pop(pid, None)
            game = games[code]
            game["players"].pop(pid, None)
            if not game["players"]:
                del games[code]
                connections.pop(code, None)
            else:
                if game["host"] == pid:
                    game["host"] = next(iter(game["players"]))
                await broadcast(code, state_msg(game, code))
