from fastapi import WebSocket

games: dict[str, dict] = {}
connections: dict[str, dict[str, WebSocket]] = {}
