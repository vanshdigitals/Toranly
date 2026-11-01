# syntax=docker/dockerfile:1.7
# Build from the repository root (the web app is built into the same image, same origin):
#   docker build -f backend/Dockerfile -t toranly .

# --- 1. Build the React app ---------------------------------------------------------------
FROM node:24.11-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# --- 2. Python runtime --------------------------------------------------------------------
FROM python:3.14-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    APP_ENV=production \
    STATIC_DIR=/app/static \
    PORT=8000

RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --require-hashes --no-deps -r requirements.txt

COPY backend/alembic.ini ./
COPY backend/app ./app
COPY --from=web /web/dist ./static

USER app
EXPOSE 8000

# Liveness only (no database call), so a sleeping Neon database never marks the container
# unhealthy; readiness is /api/v1/health/ready. The slim image has no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3   CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/v1/health' % os.environ.get('PORT', '8000'), timeout=4)"]

# Migrations run before the app starts (ARCHITECTURE.md §7). Uvicorn's own proxy-header
# handling and access log are off: the app decides which proxies to trust
# (TRUSTED_PROXY_CIDRS) and writes its own redacted request log.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app_factory --factory --host 0.0.0.0 --port ${PORT} --no-proxy-headers --no-access-log --no-server-header"]
