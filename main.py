from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from server import telemetry
from server.routes import router as http_router
from server.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await telemetry.start()
    try:
        yield
    finally:
        await telemetry.stop()


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(http_router)
app.include_router(ws_router)
