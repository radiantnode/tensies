from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from server.routes import router as http_router
from server.ws import router as ws_router

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(http_router)
app.include_router(ws_router)
