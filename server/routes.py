from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from .assets import build_index_html
from .names import make_name

router = APIRouter()

_index_html = build_index_html()


@router.get("/")
async def root() -> HTMLResponse:
    return HTMLResponse(_index_html)


@router.get("/random-name")
async def random_name() -> dict:
    return {"name": make_name()}
