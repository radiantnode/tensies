"""Security response headers — strict Content-Security-Policy + HSTS.

A tiny pure-ASGI middleware (no BaseHTTPMiddleware buffering) that stamps
headers onto every HTTP response, including the index page and /static assets.

The CSP is strict same-origin with no 'unsafe-inline': the frontend has no
inline scripts, styles, or event handlers and loads every asset from /static,
so this applies cleanly and turns any future inline-script/innerHTML sink into
a visible CSP violation. `connect-src 'self'` also covers the same-origin
WebSocket. `upgrade-insecure-requests` is added only when HSTS is on (i.e. a
real HTTPS deploy), so plain-http dev isn't forced to upgrade to https.
"""
from starlette.datastructures import MutableHeaders
from starlette.requests import HTTPConnection

from .config import (
    CSP_EXTRA_CONNECT_SRC,
    CSP_EXTRA_IMG_SRC,
    CSP_EXTRA_SCRIPT_SRC,
    CSP_OVERRIDE,
    HSTS_ENABLED,
    HSTS_INCLUDE_SUBDOMAINS,
    HSTS_MAX_AGE,
    HSTS_PRELOAD,
    SECURITY_HEADERS,
    TRUST_PROXY_HEADERS,
    TRUSTED_PROXY_HOPS,
)


def client_ip(conn: HTTPConnection) -> str:
    """Real client IP for abuse limits (audit H1). Works for HTTP requests and
    WebSockets alike — both are starlette HTTPConnections. Behind a trusted
    proxy the transport peer is the proxy, so read X-Forwarded-For; otherwise
    use the peer. Taking the entry TRUSTED_PROXY_HOPS from the right ignores
    any client-spoofed values prepended on the left."""
    peer = conn.client.host if conn.client else "?"
    if not TRUST_PROXY_HEADERS:
        return peer
    xff = conn.headers.get("x-forwarded-for")
    if not xff:
        return peer
    parts = [p.strip() for p in xff.split(",") if p.strip()]
    if not parts:
        return peer
    idx = min(max(TRUSTED_PROXY_HOPS, 1), len(parts))
    return parts[-idx]


def _directive(name: str, *sources: str) -> str:
    """Join a directive name with its sources into one CSP directive string."""
    return " ".join((name, *sources))


def build_csp() -> str:
    if CSP_OVERRIDE:
        return CSP_OVERRIDE
    # script-src / connect-src can be extended with extra hosts (e.g. an
    # analytics beacon) via env, without rewriting the whole policy.
    directives = [
        "default-src 'self'",
        _directive("script-src", "'self'", *CSP_EXTRA_SCRIPT_SRC),
        "style-src 'self'",
        _directive("img-src", "'self'", "data:", *CSP_EXTRA_IMG_SRC),
        "font-src 'self'",
        _directive("connect-src", "'self'", *CSP_EXTRA_CONNECT_SRC),
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
    ]
    if HSTS_ENABLED:
        # Only meaningful (and safe) on a real HTTPS deploy.
        directives.append("upgrade-insecure-requests")
    return "; ".join(directives)


def build_hsts() -> str | None:
    if not HSTS_ENABLED:
        return None
    value = f"max-age={HSTS_MAX_AGE}"
    if HSTS_INCLUDE_SUBDOMAINS:
        value += "; includeSubDomains"
    if HSTS_PRELOAD:
        value += "; preload"
    return value


class SecurityHeadersMiddleware:
    def __init__(self, app) -> None:
        self.app = app
        self.csp = build_csp() if SECURITY_HEADERS else None
        # HSTS is governed solely by HSTS_ENABLED (build_hsts returns None when
        # off). It is deliberately NOT gated by SECURITY_HEADERS: that switch is
        # documented as the CSP master switch, so an operator disabling CSP (e.g.
        # to debug a policy violation) must not silently lose HSTS on an HTTPS
        # deploy and reopen the SSL-strip/downgrade window.
        self.hsts = build_hsts()

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        async def _send(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                if self.csp:
                    headers["Content-Security-Policy"] = self.csp
                if self.hsts:
                    headers["Strict-Transport-Security"] = self.hsts
                # Keep the app shell (and dev-served /static) from going stale.
                # A cached HTML document points at old hashed asset URLs, so a PWA
                # — which caches aggressively and in a store separate from Safari
                # — can boot a version-skewed module graph and hang on the inline
                # loading screen (only a reinstall clears it). Force the document
                # to revalidate; in prod nginx proxies "/" here so this covers it
                # too, while nginx serves the content-hashed /static bundles with
                # their own far-future immutable cache (this middleware never runs
                # for those). In dev, /static is app-served, so revalidate it too.
                if "cache-control" not in headers:
                    ctype = headers.get("content-type", "")
                    if path.startswith("/static/") or ctype.startswith("text/html"):
                        headers["Cache-Control"] = "no-cache"
            await send(message)

        await self.app(scope, receive, _send)
