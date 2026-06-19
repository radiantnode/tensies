import hashlib
import re
from pathlib import Path

STATIC_DIR = Path("static")
ASSET_REF = re.compile(r'"(/static/[^"?]+\.(?:css|js))"')

# Matches relative ES module imports/exports:
#   import './state.js'
#   import { foo } from "./state.js"
#   import * as x from '../util.js'
#   export { foo } from './state.js'
# Captures everything up to but not including the trailing ' or ".
_JS_IMPORT = re.compile(
    r"""(\b(?:import|export)\b[^'"]*?from\s*['"]|\bimport\s*['"])(\.{1,2}/[^'"?]+\.js)(['"])""",
)


def asset_hash(paths: list[Path]) -> str:
    h = hashlib.sha1()
    for path in paths:
        h.update(path.read_bytes())
    return h.hexdigest()[:8]


def _collect_assets() -> tuple[list[Path], list[Path], list[Path]]:
    css = sorted((STATIC_DIR / "css").glob("*.css")) if (STATIC_DIR / "css").exists() else []
    js = sorted((STATIC_DIR / "js").rglob("*.js")) if (STATIC_DIR / "js").exists() else []
    legacy = [p for p in (STATIC_DIR / "style.css", STATIC_DIR / "game.js") if p.exists()]
    return css, js, legacy


def _rewrite_js(source: str, version: str) -> str:
    """Append ?v=<version> to every relative ES-module import URL.

    Without this, a browser caches `./state.js` forever — the ?v=<hash> on
    the script tag in index.html only busts main.js, not the modules it
    imports transitively. We rewrite the URL itself so the cache key changes
    whenever any JS file changes.
    """
    return _JS_IMPORT.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={version}{m.group(3)}", source)


def build_index_html() -> str:
    """Read index.html and append ?v=<hash> to every local CSS/JS reference."""
    html = (STATIC_DIR / "index.html").read_text()
    css, js, legacy = _collect_assets()
    version = asset_hash(css + js + legacy)
    return ASSET_REF.sub(lambda m: f'"{m.group(1)}?v={version}"', html)


# og:image / twitter:image whose content is a root-relative /static path. iOS
# LinkPresentation builds the share-sheet preview from these but wants ABSOLUTE
# URLs, so we prefix them with the public origin when APP_URL is set.
_SOCIAL_IMAGE = re.compile(
    r'(<meta\s+(?:property="og:image"|name="twitter:image")\s+content=")(/[^"]*)(">)'
)


def absolutize_social_images(html: str, base_url: str) -> str:
    """Rewrite root-relative og:image/twitter:image URLs to absolute on `base_url`.

    No-op when base_url is empty so dev/preview keep relative URLs. Asset (css/js)
    references are left relative — only the social-preview images need to resolve
    for an off-site fetcher (iOS, social crawlers)."""
    if not base_url:
        return html
    base = base_url.rstrip("/")
    return _SOCIAL_IMAGE.sub(lambda m: f"{m.group(1)}{base}{m.group(2)}{m.group(3)}", html)


def build_js_cache() -> dict[str, str]:
    """Return {relative_path: rewritten_js} for every JS file under static/js/.

    Keyed by the path as it appears in URLs (e.g. "js/main.js", "js/components/player-card.js").
    """
    _, js_files, _ = _collect_assets()
    version = asset_hash(_collect_assets()[0] + js_files + _collect_assets()[2])
    cache: dict[str, str] = {}
    for path in js_files:
        rel = path.relative_to(STATIC_DIR).as_posix()
        cache[rel] = _rewrite_js(path.read_text(), version)
    return cache
