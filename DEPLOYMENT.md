# Health Platform — Deployment Guide

> **Target environment**: DigitalOcean Droplet (backend + optional frontend) + DigitalOcean Managed PostgreSQL.  
> Frontend is also deployable to GitHub Pages via the existing Actions workflow.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Users (browser)                                        │
└───────────────┬─────────────────────────────────────────┘
                │ HTTPS (443)
      ┌─────────▼─────────────────────────────┐
      │  Nginx (Certbot TLS termination)       │  ← Droplet public IP
      │  Reverse proxy → :8080                 │
      └─────────┬─────────────────────────────┘
                │ HTTP :8080
      ┌─────────▼──────────────────────────────┐
      │  Docker: frontend (Nginx)               │  ← serves React SPA
      │  Proxies /api/ /auth/ /admin/ /me       │
      │          /health → backend:8000         │
      └─────────┬──────────────────────────────┘
                │ internal Docker network
      ┌─────────▼──────────────────────────────┐
      │  Docker: backend (FastAPI + Gunicorn)   │
      │  Runs: alembic upgrade head on startup  │
      └─────────┬──────────────────────────────┘
                │ SSL :25060
      ┌─────────▼──────────────────────────────┐
      │  DigitalOcean Managed PostgreSQL        │  ← outside Droplet
      │  (automatic backups, failover)          │
      └────────────────────────────────────────┘
```

**Alternatively**, the frontend is deployed to GitHub Pages and hits the DO backend directly via HTTPS (no Docker frontend container needed).

---

## 1. Local Development

```bash
# 1. Copy env files
cp backend/.env.example backend/.env     # edit DATABASE_URL, SECRET_KEY, etc.

# 2. Start services (local postgres + redis)
docker compose up -d --build

# 3. Frontend dev server (hot reload)
cd frontend && npm install && npm run dev
# → http://localhost:5173  (proxies /api/ → :8000 via vite.config.ts)
```

The local compose uses **SQLite** (default) or local **PostgreSQL** — see `backend/.env.example`.

---

## 2. DigitalOcean Managed PostgreSQL Setup

> Skip this section if you use the local Docker postgres (Option A in `docker-compose.prod.yml`).

### 2.1 Create a Managed Database cluster

1. DigitalOcean console → **Databases** → **Create Database Cluster**
2. Engine: **PostgreSQL 16**, Region: **Frankfurt (FRA1)** (or same as Droplet)
3. Plan: **Basic / 1 GB** ($15/mo) is sufficient for MVP
4. Wait for the cluster to become **Active** (~5 min)

### 2.2 Get the connection string

1. Click your cluster → **Connection Details**
2. Select **Connection string** → copy the full URI, e.g.:

```
postgresql://doadmin:<password>@db-health-do-user-xxx.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

3. Optionally create a dedicated database/user (recommended for production):

```sql
-- run via DO's "SQL Editor" or psql
CREATE USER health_app WITH PASSWORD 'strong_password';
CREATE DATABASE health_platform OWNER health_app;
GRANT ALL PRIVILEGES ON DATABASE health_platform TO health_app;
```

Then use:
```
postgresql://health_app:<password>@<host>:25060/health_platform?sslmode=require
```

### 2.3 Trusted Sources (firewall)

In the cluster settings → **Trusted Sources**, add:
- Your Droplet (select by name from dropdown)
- Your local IP for development access (optional)

### 2.4 Add `DATABASE_URL` to your Droplet `.env`

```bash
# On the Droplet, edit /opt/health-platform/.env
DATABASE_URL=postgresql://health_app:<password>@<host>:25060/health_platform?sslmode=require
```

The backend's `config.py` automatically converts `postgres://` → `postgresql://` if needed.

---

## 3. Production Environment Variables

Full reference in `backend/.env.example`.  
Copy the relevant values to `/opt/health-platform/.env` on the Droplet:

| Variable | Required | Notes |
|---|---|---|
| `ENV` | ✅ | `production` |
| `SECRET_KEY` | ✅ | `openssl rand -base64 48` |
| `DATABASE_URL` | ✅ | Managed PG connection string (see §2.2) |
| `ADMIN_PASSWORD` | ✅ | Initial admin account password |
| `CORS_ORIGINS` | ✅ | `https://yourdomain.com,https://genovesi-jm.github.io` |
| `FRONTEND_BASE` | ✅ | `https://yourdomain.com` |
| `BACKEND_BASE` | ✅ | `https://yourdomain.com` |
| `SMTP_*` | ⚠️ Optional | Required for password-reset emails |
| `OPENAI_API_KEY` | ⚠️ Optional | Required for AI chatbot |
| `DO_SPACES_*` | ⚠️ Optional | Required for file uploads |
| `STRIPE_*` | ⚠️ Optional | Required for payments |
| `DB_PASSWORD` | Option A only | Local Docker postgres only |

---

## 4. Deploying to the Droplet

### 4.1 First-time setup

```bash
# Run from your local machine:
bash deploy/setup-droplet.sh
```

This script:
- SSH into the Droplet
- Installs Docker + Docker Compose
- Clones the repository
- Prompts you to create the `.env` file
- Builds and starts all containers
- Sets up Nginx with Certbot TLS

### 4.2 Manual first deploy

```bash
ssh root@<DROPLET_IP>

# Clone
git clone https://github.com/genovesi-jm/health- /opt/health-platform
cd /opt/health-platform

# Create env file (see §3 and backend/.env.example)
cp backend/.env.example .env
nano .env   # fill in SECRET_KEY, DATABASE_URL, ADMIN_PASSWORD, etc.

# Start (Option A — local postgres)
docker compose -f docker-compose.prod.yml up -d --build

# OR Option B — Managed PostgreSQL
# (ensure DATABASE_URL is set in .env, remove `db` service from docker-compose.prod.yml)
docker compose -f docker-compose.prod.yml up -d --build
```

### 4.3 Subsequent deploys

```bash
bash deploy/update.sh
# OR manually:
ssh root@<DROPLET_IP> "cd /opt/health-platform && git pull && \
  docker compose -f docker-compose.prod.yml up -d --build"
```

---

## 5. Database Migrations

Migrations run **automatically** when the backend container starts (`alembic upgrade head` is the first command in `backend/Dockerfile`).

To run migrations manually:

```bash
# On the Droplet:
docker compose -f docker-compose.prod.yml exec backend python -m alembic upgrade head

# Check current revision:
docker compose -f docker-compose.prod.yml exec backend python -m alembic current

# Show migration history:
docker compose -f docker-compose.prod.yml exec backend python -m alembic history --verbose
```

---

## 6. Frontend Deployment

### Option A — GitHub Pages (current setup)

The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys the frontend automatically on every push to `main`.

**Required GitHub repository variables** (Settings → Secrets and variables → Actions → **Variables** tab):

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://health.geovisionops.com` |
| `VITE_BASE_PATH` | `/health-/` |

If these variables are not set, the workflow falls back to the hardcoded defaults in the YAML file.

### Option B — Docker on Droplet

The `frontend` service in `docker-compose.prod.yml` builds and serves the React app via Nginx.  
In this mode `VITE_API_URL` should be empty (or `/`) because Nginx proxies `/api/` → `backend:8000` internally.

---

## 7. Health Check

```bash
# Quick check — should return {"status": "ok", "platform": "health"}
curl https://health.geovisionops.com/health

# From inside the Droplet:
curl http://localhost:8080/health
```

Docker also runs a built-in health check every 30 seconds (`HEALTHCHECK` in `backend/Dockerfile`).

```bash
# View container health status:
docker inspect --format='{{.State.Health.Status}}' health--1-backend-1
```

---

## 8. Rollback

### Application rollback (code)

```bash
ssh root@<DROPLET_IP>
cd /opt/health-platform

# Find the last working commit
git log --oneline -10

# Roll back to a specific commit
git checkout <commit-sha>
docker compose -f docker-compose.prod.yml up -d --build
```

### Database rollback (Alembic)

```bash
# Downgrade one step:
docker compose -f docker-compose.prod.yml exec backend python -m alembic downgrade -1

# Downgrade to a specific revision:
docker compose -f docker-compose.prod.yml exec backend python -m alembic downgrade <revision_id>

# Show available revisions:
docker compose -f docker-compose.prod.yml exec backend python -m alembic history
```

> ⚠️ **Always back up the database before downgrading** (see §9 below).

### Emergency restore (Managed PostgreSQL)

DigitalOcean Managed PostgreSQL takes daily backups automatically.  
To restore: Database cluster → **Backups** → **Restore from Backup**.

---

## 9. Manual Database Backup

```bash
# Dump from Managed PostgreSQL to local file:
pg_dump "postgresql://health_app:<password>@<host>:25060/health_platform?sslmode=require" \
  -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump

# Restore:
pg_restore -d "postgresql://health_app:<password>@<host>:25060/health_platform?sslmode=require" \
  --clean backup_YYYYMMDD_HHMMSS.dump
```

---

## 10. Monitoring & Logs

```bash
# Follow all container logs:
docker compose -f docker-compose.prod.yml logs -f

# Backend only:
docker compose -f docker-compose.prod.yml logs -f backend

# Frontend (Nginx access log):
docker compose -f docker-compose.prod.yml logs -f frontend

# Nginx TLS termination log:
sudo tail -f /var/log/nginx/access.log
```

---

## 11. Costs (estimated)

| Resource | Plan | Cost |
|---|---|---|
| Droplet | Basic 2 vCPU / 4 GB | ~$24/mo |
| Managed PostgreSQL | 1 GB Basic | ~$15/mo |
| DigitalOcean Spaces | 250 GB + 1 TB transfer | ~$5/mo |
| **Total** | | **~$44/mo** |

GitHub Pages is **free**. Redis runs in the same Docker compose (no extra cost for MVP).

---

## 12. Security Checklist

- [ ] `SECRET_KEY` set to a random 48-byte value (not `CHANGE_ME`)
- [ ] `ADMIN_PASSWORD` changed after first login
- [ ] `DATABASE_URL` uses `?sslmode=require`
- [ ] Managed DB cluster has Trusted Sources set (Droplet only)
- [ ] Certbot TLS certificate installed and auto-renewing
- [ ] `.env` file is `chmod 600` and owned by root on Droplet
- [ ] `DB_PASSWORD` is not used in production (replaced by `DATABASE_URL`)
- [ ] GitHub Secrets/Variables set (`VITE_API_URL`, `VITE_BASE_PATH`)
