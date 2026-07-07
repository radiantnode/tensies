import hashlib
import os
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
    "share_description": (
        "Roll all ten dice to match the target and win the round."
        " Free, real-time multiplayer — no download, just share a code and play."
    ),
    "share_image": _SHARE_IMAGE_PATH,
    "canonical_url": "/",
}


def build_page_template(
    html_source: str, app_url: str = "", build_id: str = ""
) -> tuple[Template, dict[str, str]]:
    """Wrap the cache-busted index.html in a Template and resolve defaults.

    Called once at startup. The returned (Template, defaults) pair is passed to
    render_page() per-request — defaults for most routes, with overrides for
    pages like profiles. `build_id` fills the <meta name="app-build"> the client
    compares against the server's build id (see current_build_id)."""
    base = app_url.rstrip("/")
    defaults = PAGE_DEFAULTS.copy()
    defaults["build_id"] = build_id
    if base:
        defaults["share_image"] = f"{base}{_SHARE_IMAGE_PATH}"
        defaults["canonical_url"] = base + "/"
    return Template(html_source), defaults


def _escape_attr(val: str) -> str:
    """Escape for use inside a double-quoted HTML attribute.

    Escapes &, <, >, and " — but NOT single quotes, which are fine inside
    content="..." and look ugly when escaped in share-preview titles."""
    return (
        val.replace("&", "&amp;").replace("<", "&lt;")
        .replace(">", "&gt;").replace('"', "&quot;")
    )


def render_page(template: Template, defaults: dict[str, str], **overrides: str) -> str:
    """Substitute the page template with defaults + per-page overrides.

    All values are escaped for double-quoted HTML attributes."""
    merged = {k: _escape_attr(v) for k, v in {**defaults, **overrides}.items()}
    return template.safe_substitute(merged)


def build_js_cache() -> dict[str, str]:
    """Return {relative_path: rewritten_js} for every JS file under static/js/.

    Keyed by the path as it appears in URLs (e.g. "js/main.js", "js/components/player-card.js").
    """
    css, js_files, legacy = _collect_assets()
    version = asset_hash(css + js_files + legacy)
    cache: dict[str, str] = {}
    for path in js_files:
        rel = path.relative_to(STATIC_DIR).as_posix()
        cache[rel] = _rewrite_js(path.read_text(), version)
    return cache


_prod_build_id: str | None = None


def current_build_id() -> str:
    """Build id for the frontend the server is serving right now.

    Used to (a) name the service-worker cache so a deploy busts it, and (b) let
    a running client notice it's older than the server — sent in the WS `welcome`
    frame and compared against the <meta name="app-build"> baked into the page.

    Prod (FRONTEND_DIST set): the content hash of the prebuilt dist/index.html,
    which references every fingerprinted asset by hashed name, so it changes iff
    the build does. Immutable at runtime, so it's computed once and memoised. An
    explicit BUILD_ID env var overrides it. Dev: the live static-tree hash, which
    matches the ?v= cache-buster and the page the app just served."""
    global _prod_build_id
    if _prod_build_id is not None:
        return _prod_build_id
    override = os.environ.get("BUILD_ID")
    if override:
        _prod_build_id = override.strip()
        return _prod_build_id
    dist = os.environ.get("FRONTEND_DIST", "").strip()
    if dist:
        try:
            _prod_build_id = asset_hash([Path(dist) / "index.html"])
        except OSError:
            _prod_build_id = "unknown"
        return _prod_build_id
    return dev_assets().build_id()


class DevAssets:
    """Dev-only cache-busted asset serving that survives file edits without a
    server restart.

    In dev the app serves the raw modules itself, and the version hash + the
    rewritten module bodies used to be computed once at startup — so any edit to
    a CSS/JS file needed a `docker compose restart web` to show up (the single
    biggest source of dev friction). This recomputes them lazily, but only when
    something actually changed: each call stats the static tree (cheap, no file
    reads) and rebuilds the index template + JS cache only when the max mtime
    moves. Prod (FRONTEND_DIST set) never constructs this — nginx serves the
    prebuilt, fingerprinted dist/.
    """

    def __init__(self, app_url: str = "") -> None:
        self._app_url = app_url
        self._sig: tuple[int, int] | None = None
        self._tmpl: Template | None = None
        self._defaults: dict[str, str] = {}
        self._js: dict[str, str] = {}
        self._version = "dev"

    def _signature(self) -> tuple[int, int]:
        css, js, legacy = _collect_assets()
        paths = [*css, *js, *legacy, STATIC_DIR / "index.html"]
        newest = max((p.stat().st_mtime_ns for p in paths if p.exists()), default=0)
        return newest, len(paths)

    def _refresh_if_stale(self) -> None:
        sig = self._signature()
        if sig == self._sig:
            return
        self._sig = sig
        css, js, legacy = _collect_assets()
        self._version = asset_hash(css + js + legacy)
        self._tmpl, self._defaults = build_page_template(
            build_index_html(), self._app_url, self._version
        )
        self._js = build_js_cache()

    def template(self) -> tuple[Template, dict[str, str]]:
        self._refresh_if_stale()
        assert self._tmpl is not None
        return self._tmpl, self._defaults

    def js(self, key: str) -> str | None:
        self._refresh_if_stale()
        return self._js.get(key)

    def build_id(self) -> str:
        self._refresh_if_stale()
        return self._version


_dev_assets: DevAssets | None = None


def dev_assets(app_url: str = "") -> DevAssets:
    """Process-wide DevAssets singleton, so routes.py and main.py share one
    mtime sweep and one set of caches. First caller (routes.py, at import) sets
    app_url; later callers reuse the same instance."""
    global _dev_assets
    if _dev_assets is None:
        _dev_assets = DevAssets(app_url)
    return _dev_assets
