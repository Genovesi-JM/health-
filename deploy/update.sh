#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Health Platform — Quick Update Script
# Re-deploys latest code without losing database data
#
# Usage (from LOCAL machine):
#   ./deploy/update.sh YOUR_DROPLET_IP
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

DROPLET_IP="${1:?Usage: $0 <DROPLET_IP>}"
APP_DIR="/opt/health-platform"
SSH_USER="root"

echo "🔄 Updating Health Platform on ${DROPLET_IP}..."

ssh ${SSH_USER}@${DROPLET_IP} << UPDATE
set -e
cd ${APP_DIR}

echo "📥 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "🐳 Rebuilding containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "⏳ Waiting for services..."
sleep 10

echo "🏥 Health check..."
curl -sf http://localhost/health && echo " ✅ API OK" || echo " ⚠️ API not ready yet"
curl -sf http://localhost/ > /dev/null && echo "✅ Frontend OK" || echo "⚠️ Frontend not ready yet"

echo ""
echo "📊 Status:"
docker compose -f docker-compose.prod.yml ps
UPDATE

echo ""
echo "✅ Update complete! App: http://${DROPLET_IP}"
