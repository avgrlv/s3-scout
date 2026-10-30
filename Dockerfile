FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/src ./src
RUN npm run build

FROM python:3.13-slim@sha256:2d44738ebf4ce5f63b9d9ea871e9c7cfdc0426f7b0c97cac915fd88ded1d86bb AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AWS_EC2_METADATA_DISABLED=true \
    S3_DESK_DATA_DIR=/data
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt 'gunicorn>=23,<24' \
    && useradd --create-home --uid 10001 app \
    && mkdir /data \
    && chown app:app /data \
    && chmod 700 /data
COPY backend ./backend
COPY download_s3.py ./download_s3.py
COPY --from=frontend /build/dist ./frontend/dist
USER app
EXPOSE 7890
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7890/api/health', timeout=2).close()"
CMD ["gunicorn", "--bind", "0.0.0.0:7890", "--workers", "1", "--threads", "4", "--timeout", "120", "backend.server:create_app()"]
