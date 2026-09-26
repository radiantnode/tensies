"""Keep players' coordinates out of the access log.

The radar (`/api/nearby?lat=&lon=`) and the check-in picker
(`/api/places/nearby`, `/api/places/search`) carry the caller's position in
the query string. uvicorn's default access log writes the full request line
beside the client address, so every poll would pin a person to a place on
disk. This filter drops those lines from the `uvicorn.access` logger and
nothing else — every other path keeps its access line exactly as before,
which is why this is a filter rather than `--no-access-log`.

nginx does the same for its own log in ops/nginx.conf (`access_log off` on
the matching location blocks). Both layers, because each writes its own log.

Installed at app import (main.py). uvicorn configures its loggers when its
Config is built, before it imports the app, so the filter attaches to the
already-configured logger and survives — including under `--reload`, where
the serving subprocess imports the app afresh.
"""
import logging

# Path prefixes whose access lines are dropped. Prefix rather than exact so a
# trailing slash or a future sibling under /api/places/ is covered by default
# — failing toward silence is the right direction for location data.
PRIVATE_PATH_PREFIXES = ("/api/nearby", "/api/places/")


def is_private_path(path: str) -> bool:
    """True for a request path (query string allowed) that carries coordinates."""
    return path.split("?", 1)[0].startswith(PRIVATE_PATH_PREFIXES)


class DropPrivatePaths(logging.Filter):
    """Reject uvicorn access records for location-bearing paths.

    uvicorn logs access as
    ``'%s - "%s %s HTTP/%s" %d' % (client, method, full_path, version, status)``
    so the request target is the third positional arg. Anything that doesn't
    fit that shape is passed through untouched.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            return not is_private_path(args[2])
        return True


def install() -> None:
    """Attach the filter to `uvicorn.access` (idempotent)."""
    logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, DropPrivatePaths) for f in logger.filters):
        logger.addFilter(DropPrivatePaths())
