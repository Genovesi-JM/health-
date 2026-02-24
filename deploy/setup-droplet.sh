#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Health Platform — DigitalOcean Droplet Deploy Script
# 
# Usage (from your LOCAL machine):
#   ./deploy/setup-droplet.sh YOUR_DROPLET_IP
#
# What this does:
#   1. SSHs into the droplet
#   2. Installs Docker + Docker Compose
#   3. Clones the repo
#   4. Creates .env from template
#   5. Builds and starts all containers
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ── Config ──
DROPLET_IP="${1:?Usage: $0 <DROPLET_IP>}"
REPO_URL="https://github.com/Genovesi-JM/health-.git"
APP_DIR="/opt/health-platform"
SSH_USER="root"

echo "🚀 Health Platform — DigitalOcean Deploy"
echo "   Droplet: ${DROPLET_IP}"
echo ""

# ── Step 1: Install Docker on Droplet ──
echo "📦 Step 1: Installing Docker on droplet..."
ssh -o StrictHostKeyChecking=no ${SSH_USER}@${DROPLET_IP} << 'INSTALL_DOCKER'
set -e

# Skip if Docker already installed
if command -v docker &> /dev/null; then
    echo "Docker already installed: $(docker --version)"
else
    echo "Installing Docker..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release
    
    # Add Docker GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add Docker repo
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start and enable
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installed: $(docker --version)"
fi

# Basic firewall
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   2>/dev/null || true
    ufw allow 80/tcp   2>/dev/null || true
    ufw allow 443/tcp  2>/dev/null || true
    echo "y" | ufw enable 2>/dev/null || true
    echo "✅ Firewall configured (22, 80, 443)"
fi
INSTALL_DOCKER

# ── Step 2: Clone/Update Repository ──
echo ""
echo "📂 Step 2: Setting up application..."
ssh ${SSH_USER}@${DROPLET_IP} << SETUP_APP
set -e

if [ -d "${APP_DIR}" ]; then
    echo "Updating existing repository..."
    cd ${APP_DIR}
    git fetch origin main
    git reset --hard origin/main
else
    echo "Cloning repository..."
    git clone ${REPO_URL} ${APP_DIR}
    cd ${APP_DIR}
fi

# Create .env if it doesn't exist
if [ ! -f "${APP_DIR}/.env" ]; then
    echo "Creating .env from template..."
    cp ${APP_DIR}/.env.production ${APP_DIR}/.env
    
    # Generate secure values
    SECRET_KEY=\$(openssl rand -base64 48)
    DB_PASSWORD=\$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    ADMIN_PASSWORD="Admin@1234"
    
    # Replace placeholders
    sed -i "s|CHANGE_ME_GENERATE_WITH_OPENSSL|\${SECRET_KEY}|g" ${APP_DIR}/.env
    sed -i "s|CHANGE_ME_STRONG_DB_PASSWORD|\${DB_PASSWORD}|g" ${APP_DIR}/.env
    sed -i "s|CHANGE_ME_ADMIN_PASSWORD|\${ADMIN_PASSWORD}|g" ${APP_DIR}/.env
    sed -i "s|YOUR_DROPLET_IP|${DROPLET_IP}|g" ${APP_DIR}/.env
    
    echo "✅ .env created with secure values"
    echo "   ⚠️  Admin password set to: Admin@1234"
    echo "   ⚠️  Change it in ${APP_DIR}/.env after first login!"
else
    echo ".env already exists, keeping current values"
    # Update IP references if needed
    sed -i "s|YOUR_DROPLET_IP|${DROPLET_IP}|g" ${APP_DIR}/.env 2>/dev/null || true
fi
SETUP_APP

# ── Step 3: Build and Start ──
echo ""
echo "🐳 Step 3: Building and starting containers..."
ssh ${SSH_USER}@${DROPLET_IP} << START_APP
set -e
cd ${APP_DIR}

# Stop existing containers if running
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Wait for services
echo ""
echo "⏳ Waiting for services to start..."
sleep 15

# Check health
echo ""
echo "🏥 Health check..."
if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "✅ Backend API: HEALTHY"
else
    echo "⚠️  Backend API: NOT READY (may still be starting — check logs)"
fi

if curl -sf http://localhost/ > /dev/null 2>&1; then
    echo "✅ Frontend:    HEALTHY"
else
    echo "⚠️  Frontend:   NOT READY (may still be starting)"
fi

echo ""
echo "📊 Container status:"
docker compose -f docker-compose.prod.yml ps
START_APP

echo ""
echo "═══════════════════════════════════════════════════════"
echo "🎉 DEPLOY COMPLETE!"
echo ""
echo "   🌐 App:     http://${DROPLET_IP}"
echo "   🔑 Login:   http://${DROPLET_IP}/login"
echo "   📡 API:     http://${DROPLET_IP}/api/v1/health"
echo ""
echo "   Admin:  genovesi.maria@geovisionops.com / Admin@1234"
echo "   Patient: paciente@health.com / Admin@1234"
echo "   Doctor:  medico@health.com / Admin@1234"
echo ""
echo "   ⚠️  Change passwords after first login!"
echo ""
echo "   📋 Useful commands (on droplet):"
echo "   ssh root@${DROPLET_IP}"
echo "   cd ${APP_DIR}"
echo "   docker compose -f docker-compose.prod.yml logs -f"
echo "   docker compose -f docker-compose.prod.yml restart"
echo "═══════════════════════════════════════════════════════"
