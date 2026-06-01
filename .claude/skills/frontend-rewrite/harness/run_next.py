# Serve the REWRITTEN frontend (static-next/) for pixel verification while the
# old static/ keeps serving elsewhere. Reuses the real /ws router and game logic
# (so stateful views work) with telemetry's Postgres boot stubbed. Run from the
# repo root:
#   PYTHONPATH=.claude/skills/frontend-rewrite/harness:. \
#     setsid uvicorn run_next:app --host 127.0.0.1 --port 8890 >/tmp/next.log 2>&1 </dev/null &
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server import telemetry
from server.ws import router as ws_router

DIR = "static-next"


async def _noop():
    return None


telemetry.start = _noop
telemetry.stop = _noop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await telemetry.start()
    try:
        yield
    finally:
        await telemetry.stop()


app = FastAPI(lifespan=lifespan)


@app.get("/")
async def index():
    return FileResponse(f"{DIR}/index.html")


app.mount("/static", StaticFiles(directory=DIR), name="static")
app.include_router(ws_router)
