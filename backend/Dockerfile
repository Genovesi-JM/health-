FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 KAYA_MANAGED_SCHEMA=true
WORKDIR /app
COPY requirements.deploy.txt ./
RUN pip install --no-cache-dir -r requirements.deploy.txt psycopg2-binary redis
RUN adduser --disabled-password --gecos '' appuser && chown appuser:appuser /app
COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser alembic/ ./alembic/
COPY --chown=appuser:appuser accounts_alembic/ ./accounts_alembic/
COPY --chown=appuser:appuser scripts/ ./scripts/
COPY --chown=appuser:appuser alembic.ini accounts_alembic.ini ./
USER appuser
EXPOSE 8000
CMD ["gunicorn","app.main:app","--worker-class","uvicorn.workers.UvicornWorker","--bind","0.0.0.0:8000","--workers","1","--timeout","120"]
