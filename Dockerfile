# Multi-stage build. The frontend bundle is compiled at image-build time (never
# at server runtime) so the final images carry no Node toolchain and the app
# process does zero asset work in prod. Stage order matters: `web` is LAST so a
# bare `docker build .` / compose `build: .` resolves to it; the prod compose
# selects the `nginx` stage with `target: nginx`.

# ── Stage 1: build the static frontend bundle (dist/) ─────────────────────────
# Tag-pinned (not a digest), matching the python base policy below, so local
# builds still pick up base-image security patches.
FROM node:26-bookworm-slim AS assets
WORKDIR /build
# Install the exact, locked build toolchain (esbuild) first for layer caching.
COPY package.json package-lock.json ./
# Optional build-time CA bundle (BuildKit secret `proxy_ca`): lets `npm ci` work
# behind a TLS-intercepting egress proxy. Absent in normal builds -> plain npm ci.
RUN --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=$(test -s /run/secrets/proxy_ca && echo /run/secrets/proxy_ca) \
    npm ci
COPY scripts/ ./scripts/
COPY static/ ./static/
# -> /build/dist : bundled + minified + content-hashed JS/CSS, fingerprinted
#    images/fonts, a rewritten index.html, and a .gz sibling per text asset.
RUN node scripts/build_assets.mjs

# ── Stage 2: nginx serving the prebuilt dist straight from disk ───────────────
# Serves everything under /static (sendfile + gzip_static + immutable) and
# proxies the rest to the app. Config + dist are baked in (no runtime volumes).
# The *unprivileged* image runs the master process as a non-root user (uid 101)
# and keeps its pid/temp paths under /tmp, so the container can run with a
# read-only root filesystem and no capabilities (it binds 8080, not 80, so it
# needs no NET_BIND_SERVICE). The companion config (ops/nginx.conf) listens on
# 8080 and routes nginx's pid/temp/log writes to /tmp + stdout/stderr.
FROM nginxinc/nginx-unprivileged:1.31.2-alpine AS nginx
COPY ops/nginx.conf /etc/nginx/nginx.conf
COPY --from=assets /build/dist/static /srv/dist/static

# ── Stage 3a: builder — has the C/C++ toolchain, produces a populated venv ─────
# asyncpg and blspy ship C/C++ extensions that the slim base can't compile
# without gcc + cmake. We build them HERE, into a self-contained virtualenv, and
# copy only that venv into the runtime stage below — so the compiler, headers,
# and apt metadata never reach the shipped image (the largest piece of runtime
# attack surface). Pinned to a patch tag (not a digest) so local builds pick up
# base-image patches; prod *service* images are digest-pinned in compose.
FROM python:3.12.8-slim-bookworm AS pybuild

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Self-contained venv we can lift wholesale into the runtime image.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install deps first for layer caching. Prefer the fully-pinned lock for
# reproducible/prod builds; fall back to requirements.txt if the lock is absent.
COPY requirements.txt requirements.lock* ./
# Optional build-time CA bundle (BuildKit secret `proxy_ca`): lets pip reach the
# index behind a TLS-intercepting egress proxy. Absent in normal builds -> plain
# pip with the default trust store.
RUN --mount=type=secret,id=proxy_ca \
    pip install --no-cache-dir \
      $(test -s /run/secrets/proxy_ca && echo --cert=/run/secrets/proxy_ca) \
      -r $( [ -f requirements.lock ] && echo requirements.lock || echo requirements.txt )

# ── Stage 3b: the Python app (default build target) ───────────────────────────
# Clean slim base with NO build toolchain — only the prebuilt venv and the app
# source. Runs as an unprivileged user with a read-only-friendly layout (writes
# nothing at runtime; PYTHONDONTWRITEBYTECODE keeps it from emitting .pyc).
FROM python:3.12.8-slim-bookworm AS web

# Don't write .pyc, unbuffered logs, no pip version chatter. PATH points at the
# copied venv so `uvicorn`/`python` resolve to the installed dependency set.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Lift the compiled dependency set from the builder. No gcc/cmake/apt-lists ship.
COPY --from=pybuild /opt/venv /opt/venv

# Copy ONLY what the server needs at runtime: the entrypoint, the app package,
# the DB migrations applied on startup (server/db.py), and the frontend source
# (served directly only in dev; in prod nginx serves /static and the app serves
# the single baked dist/index.html below). Everything else in the repo —
# scripts/, ops/, tools/, tests/, loadtest.py, build/compose files — stays out
# of the image to shrink the surface and avoid shipping non-runtime files.
COPY main.py ./
COPY server/ ./server/
COPY migrations/ ./migrations/
COPY static/ ./static/

# Bake ONLY the prebuilt index.html. In prod (FRONTEND_DIST=/app/dist, set in
# docker-compose.prod.yml) the app serves this single document — so the CSP
# stays single-sourced in the security middleware — while nginx serves every
# /static asset. The app builds no in-process JS cache and mounts no StaticFiles.
COPY --from=assets /build/dist/index.html /app/dist/index.html

# Create an unprivileged user, hand it the app tree, and strip every setuid/
# setgid bit in the image so a compromised process can't use a leftover
# privileged helper (su, mount, etc.) to escalate. Done as the last root step.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app \
    && find / -xdev -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true
USER appuser

EXPOSE 8000
# No --reload in the image; dev reload is supplied by docker-compose.yml.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
