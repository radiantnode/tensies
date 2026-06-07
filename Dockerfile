# Pinned to a specific patch tag (intentionally NOT a digest) so local dev
# builds still pick up base-image patch updates. The prod *service* images are
# digest-pinned in docker-compose.prod.yml instead.
FROM python:3.12.8-slim-bookworm

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

# Run as an unprivileged user, not root.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
# No --reload in the image; dev reload is supplied by docker-compose.yml.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
