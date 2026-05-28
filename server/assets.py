import hashlib
import re
from pathlib import Path

STATIC_DIR = Path("static")
ASSET_REF = re.compile(r'"(/static/[^"?]+\.(?:css|js))"')


def asset_hash(paths: list[Path]) -> str:
    h = hashlib.sha1()
    for path in paths:
        h.update(path.read_bytes())
    return h.hexdigest()[:8]


def build_index_html() -> str:
    """Read index.html and append ?v=<hash> to every local CSS/JS reference."""
    html = (STATIC_DIR / "index.html").read_text()
    css_files = sorted((STATIC_DIR / "css").glob("*.css")) if (STATIC_DIR / "css").exists() else []
    js_files = sorted((STATIC_DIR / "js").rglob("*.js")) if (STATIC_DIR / "js").exists() else []
    legacy = [p for p in (STATIC_DIR / "style.css", STATIC_DIR / "game.js") if p.exists()]
    version = asset_hash(css_files + js_files + legacy)
    return ASSET_REF.sub(lambda m: f'"{m.group(1)}?v={version}"', html)
