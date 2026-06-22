import hashlib
import re
from pathlib import Path
from string import Template

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


_SHARE_IMAGE_PATH = "/static/images/share-hero.png"

# Default values for the $template_vars in index.html. Routes can override any
# of these by passing keyword arguments to render_page().
PAGE_DEFAULTS = {
    "page_title": "Tensies — Real-Time Multiplayer Dice Game",
    "share_title": "Tensies — Real-Time Multiplayer Dice Game",
    "share_description": "Roll all ten dice to match the target and win the round. Free, real-time multiplayer — no download, just share a code and play.",
    "share_image": _SHARE_IMAGE_PATH,
    "canonical_url": "/",
}


def build_page_template(html_source: str, app_url: str = "") -> tuple[Template, dict[str, str]]:
    """Wrap the cache-busted index.html in a Template and resolve defaults.

    Called once at startup. The returned (Template, defaults) pair is passed to
    render_page() per-request — defaults for most routes, with overrides for
    pages like profiles."""
    base = app_url.rstrip("/")
    defaults = PAGE_DEFAULTS.copy()
    if base:
        defaults["share_image"] = f"{base}{_SHARE_IMAGE_PATH}"
        defaults["canonical_url"] = base + "/"
    return Template(html_source), defaults


def _escape_attr(val: str) -> str:
    """Escape for use inside a double-quoted HTML attribute.

    Escapes &, <, >, and " — but NOT single quotes, which are fine inside
    content="..." and look ugly when escaped in share-preview titles."""
    return val.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def render_page(template: Template, defaults: dict[str, str], **overrides: str) -> str:
    """Substitute the page template with defaults + per-page overrides.

    All values are escaped for double-quoted HTML attributes."""
    merged = {k: _escape_attr(v) for k, v in {**defaults, **overrides}.items()}
    return template.safe_substitute(merged)


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
