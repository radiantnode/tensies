# Multi-stage build. The frontend bundle is compiled at image-build time (never
# at server runtime) so the final images carry no Node toolchain and the app
# process does zero asset work in prod. Stage order matters: `web` is LAST so a
# bare `docker build .` / compose `build: .` resolves to it; the prod compose
# selects the `nginx` stage with `target: nginx`.

# ── Stage 1: build the static frontend bundle (dist/) ─────────────────────────
# Tag-pinned (not a digest), matching the python base policy below, so local
# builds still pick up base-image security patches.
FROM node:22-bookworm-slim AS assets
WORKDIR /build
# Install the exact, locked build toolchain (esbuild) first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci
COPY scripts/ ./scripts/
COPY static/ ./static/
# -> /build/dist : bundled + minified + content-hashed JS/CSS, fingerprinted
#    images/fonts, a rewritten index.html, and a .gz sibling per text asset.
RUN node scripts/build_assets.mjs

# ── Stage 2: nginx serving the prebuilt dist straight from disk ───────────────
# Serves everything under /static (sendfile + gzip_static + immutable) and
# proxies the rest to the app. Config + dist are baked in (no runtime volumes).
FROM nginx:1.27-alpine AS nginx
COPY ops/nginx.conf /etc/nginx/nginx.conf
COPY --from=assets /build/dist/static /srv/dist/static

# ── Stage 3: the Python app (default build target) ────────────────────────────
# Pinned to a specific patch tag (intentionally NOT a digest) so local dev
# builds still pick up base-image patch updates. The prod *service* images are
# digest-pinned in docker-compose.prod.yml instead.
FROM python:3.12.8-slim-bookworm AS web

# Don't write .pyc, unbuffered logs, no pip version chatter.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps first for layer caching. Prefer the fully-pinned lock for
# reproducible/prod builds; fall back to requirements.txt if the lock is absent.
COPY requirements.txt requirements.lock* ./
RUN pip install --no-cache-dir -r $( [ -f requirements.lock ] && echo requirements.lock || echo requirements.txt )

COPY . .

# Bake ONLY the prebuilt index.html. In prod (FRONTEND_DIST=/app/dist, set in
# docker-compose.prod.yml) the app serves this single document — so the CSP
# stays single-sourced in the security middleware — while nginx serves every
# /static asset. The app builds no in-process JS cache and mounts no StaticFiles.
COPY --from=assets /build/dist/index.html /app/dist/index.html

# Run as an unprivileged user, not root.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
# No --reload in the image; dev reload is supplied by docker-compose.yml.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
