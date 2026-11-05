FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    KAYA_EXECUTION_MODE=hold

# System deps for psycopg2 (PostgreSQL) and reportlab (PDF)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the audited runtime dependency graph, including database/cache drivers.
COPY requirements.deploy.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.deploy.lock

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser && chown appuser:appuser /app

# Explicit runtime inputs only; .dockerignore further limits these directories
# to source files. Never copy a local .env, database, mail log or upload folder.
COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser alembic/ ./alembic/
COPY --chown=appuser:appuser alembic.ini ./
USER appuser

# Expose port
EXPOSE 8000

# Process liveness only: the HOLD intentionally returns HTTP 503.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import socket; socket.create_connection(('127.0.0.1', 8000), timeout=3).close()"

# Phase 0: start only the held API. No migration or schema repair at startup.
CMD ["gunicorn", "app.main:app", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"]

# Run only explicit isolated regressions: no app startup, real database, mail,
# provider calls or inherited host environment. Not part of the production image.
FROM runtime AS security-test
HEALTHCHECK NONE
USER root
COPY requirements.phase0.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.phase0.lock
COPY --chown=appuser:appuser security_tests/ ./security_tests/
USER appuser
ENV PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
    KAYA_DISABLE_RATE_LIMIT=1
CMD ["python", "-m", "pytest", "security_tests", "-q", "-p", "no:cacheprovider", "--disable-warnings"]

# Owner migration tooling is available only through this explicit build target.
FROM runtime AS staging-migration
HEALTHCHECK NONE
COPY --chown=appuser:appuser accounts_alembic/ ./accounts_alembic/
COPY --chown=appuser:appuser accounts_alembic.ini ./
COPY --chown=appuser:appuser scripts/azure_schema.py scripts/staging_api_smoke.py ./scripts/
ENV KAYA_MANAGED_SCHEMA=true
CMD ["python", "scripts/azure_schema.py", "check"]

# The default target remains the non-root production runtime, without test tools.
FROM runtime AS production
