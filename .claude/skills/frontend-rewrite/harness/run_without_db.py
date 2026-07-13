# Run the REAL Tensies app for screenshotting WITHOUT the Postgres/Grafana
# stack. Telemetry's DB-dependent start/stop are stubbed so the production `/`
# route (and assets.py cache-busting) serve unchanged. Repo files are untouched.
#
#   PYTHONPATH=.claude/skills/frontend-rewrite/harness:. \
#     uvicorn run_without_db:app --host 127.0.0.1 --port 8888
#
# Use this only when `docker compose up` is unavailable (e.g. a sandbox whose
# network policy blocks the image registry). Otherwise prefer the real stack.
from server import telemetry


async def _noop():
    return None


telemetry.start = _noop
telemetry.stop = _noop

from main import app  # noqa: E402  (import after the monkeypatch)
