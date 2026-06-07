from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from server import fanout, gamestore, reaper, telemetry
from server.assets import build_js_cache
from server.routes import router as http_router
from server.security import SecurityHeadersMiddleware
from server.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Redis-backed shared state + cross-instance fan-out come up first (both
    # required); telemetry (Postgres/Grafana) is optional; the reaper backstops
    # per-game timers across instances.
    await gamestore.init()
    await fanout.start()
    await telemetry.start()
    await reaper.start()
    try:
        yield
    finally:
        await reaper.stop()
        await telemetry.stop()
        await fanout.stop()
        await gamestore.close()


app = FastAPI(lifespan=lifespan)

# Stamp CSP + HSTS onto every HTTP response (index page, /static, /metrics, …).
app.add_middleware(SecurityHeadersMiddleware)

# JS files are served from a rewritten cache that appends ?v=<hash> to every
# relative `import './foo.js'` URL. Without this, the ?v= on the top-level
# main.js script tag busts only main.js — browsers cache transitively-imported
# modules forever and never pick up edits. Route declared BEFORE the /static
# mount so it takes precedence for js/* paths.
_js_cache = build_js_cache()


@app.get("/static/js/{path:path}")
async def static_js(path: str):
    key = f"js/{path}"
    if key in _js_cache:
        return Response(
            content=_js_cache[key],
            media_type="text/javascript; charset=utf-8",
            headers={"Cache-Control": "no-cache"},
        )
    raise HTTPException(status_code=404)


app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(http_router)
app.include_router(ws_router)
