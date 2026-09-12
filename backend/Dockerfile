FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps for psycopg2 (PostgreSQL) and reportlab (PDF)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (use deploy requirements for production)
COPY requirements.deploy.txt ./
RUN pip install --no-cache-dir -r requirements.deploy.txt && \
    pip install --no-cache-dir psycopg2-binary redis

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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run migrations (fail loudly if they fail — do NOT suppress errors in production)
# Then start gunicorn with uvicorn workers
CMD ["sh", "-c", "python -m alembic upgrade head && gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers 2 --timeout 120 --access-logfile - --error-logfile -"]

# Run only explicit isolated regressions: no app startup, real database, mail,
# provider calls or inherited host environment. Not part of the production image.
FROM runtime AS security-test
HEALTHCHECK NONE
USER root
RUN pip install --no-cache-dir 'pytest>=8.0.0'
COPY --chown=appuser:appuser security_tests/ ./security_tests/
USER appuser
ENV PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
    KAYA_DISABLE_RATE_LIMIT=1
CMD ["python", "-m", "pytest", "security_tests", "-q", "-p", "no:cacheprovider", "--disable-warnings"]

# The default target remains the non-root production runtime, without test tools.
FROM runtime AS production
