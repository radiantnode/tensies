#!/usr/bin/env python3
"""Boot a Tensies commit's app as "just the app" on a given port.

Telemetry (Postgres/Prometheus/Grafana) is monkey-patched to no-ops so that
*any* commit — including the telemetry-era ones — boots standalone with no
external services. The game board never needs telemetry.

Run with the target commit's working tree as the current directory:
    cd <checkout> && python3 launch.py <port>
"""
import os
import sys

sys.path.insert(0, os.getcwd())  # import the checkout's main.py, not this dir

# Neutralize telemetry if the commit has it (older commits don't — that's fine).
try:
    import server.telemetry as tel

    async def _noop(*a, **k):
        pass

    tel.start = _noop
    tel.stop = _noop
    tel.emit = lambda *a, **k: None
except Exception:
    pass

import uvicorn  # noqa: E402
import main  # noqa: E402

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
uvicorn.run(main.app, host="127.0.0.1", port=port, log_level="warning")
