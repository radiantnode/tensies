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

from .config import (
    CSP_EXTRA_CONNECT_SRC,
    CSP_EXTRA_SCRIPT_SRC,
    CSP_OVERRIDE,
    HSTS_ENABLED,
    HSTS_INCLUDE_SUBDOMAINS,
    HSTS_MAX_AGE,
    HSTS_PRELOAD,
    SECURITY_HEADERS,
)


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
        "img-src 'self' data:",
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
        self.hsts = build_hsts() if SECURITY_HEADERS else None
        self.active = bool(self.csp or self.hsts)

    async def __call__(self, scope, receive, send) -> None:
        if not self.active or scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def _send(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                if self.csp:
                    headers["Content-Security-Policy"] = self.csp
                if self.hsts:
                    headers["Strict-Transport-Security"] = self.hsts
            await send(message)

        await self.app(scope, receive, _send)
