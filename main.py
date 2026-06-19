from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from server import db, discord, drand, fanout, gamestore, reaper, telemetry
from server.auth import router as auth_router
from server.config import FRONTEND_DIST
from server.routes import router as http_router
from server.security import SecurityHeadersMiddleware
from server.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Postgres (shared pool + migrations) comes up first — auth needs it even
    # with telemetry disabled. Then Redis-backed shared state + cross-instance
    # fan-out (both required); telemetry (Grafana writer/live) and the Discord
    # notifier are optional (each a no-op unless enabled); the reaper backstops
    # per-game timers across instances.
    await db.init()
    await gamestore.init()
    await fanout.start()
    await drand.start()
    await telemetry.start()
    await discord.start()
    await reaper.start()
    try:
        yield
    finally:
        await reaper.stop()
        await discord.stop()
        await telemetry.stop()
        await drand.stop()
        await fanout.stop()
        await gamestore.close()
        await db.close()


app = FastAPI(lifespan=lifespan)

# Stamp CSP + HSTS onto every HTTP response (index page, /static, /metrics, …).
app.add_middleware(SecurityHeadersMiddleware)

# Static-asset serving is split by deployment mode:
#
#   PROD  (FRONTEND_DIST set): the frontend is bundled + fingerprinted into a
#         static dist/ at image-build time and served straight from disk by
#         nginx. The app does NO asset work — no in-process JS cache, no
#         StaticFiles mount — so the event loop is never spent pushing static
#         bytes. nginx owns everything under /static.
#
#   DEV   (FRONTEND_DIST unset): no build step. The app serves the raw,
#         unbundled ES modules itself, rewriting each transitive `import
#         './foo.js'` URL with a ?v=<hash> cache-buster (build_js_cache) so
#         edits are picked up immediately. StaticFiles serves css/images/fonts.
if not FRONTEND_DIST:
    from server.assets import build_js_cache

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

app.include_router(auth_router)
app.include_router(http_router)
app.include_router(ws_router)
