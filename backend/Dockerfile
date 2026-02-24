FROM python:3.12-slim

# System deps for psycopg2 (PostgreSQL) and reportlab (PDF)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (use deploy requirements for production)
COPY requirements.deploy.txt requirements.txt ./
RUN pip install --no-cache-dir -r requirements.deploy.txt && \
    pip install --no-cache-dir psycopg2-binary redis

# Copy application code
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run migrations then start gunicorn with uvicorn workers
CMD ["sh", "-c", "python -m alembic upgrade head 2>/dev/null; gunicorn app.main:create_application --factory --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers 2 --timeout 120 --access-logfile - --error-logfile -"]
