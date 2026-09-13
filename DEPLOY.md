> **CLINICAL LAUNCH HOLD — synthetic development only.** This guide is retained as reference. Deployment, provider activation and live database operations require a separate release decision. Follow [Phase 0 execution status](docs/KAYA_EXECUTION_STATUS.md) before using these instructions.

# 🚀 Health Platform — Deploy to DigitalOcean

Guia completo para colocar a plataforma em produção num Droplet DigitalOcean.

---

## Arquitetura

```
┌─────────────────────────────────────────────┐
│              DigitalOcean Droplet            │
│                                             │
│   ┌──────────┐    ┌──────────┐              │
│   │ Frontend │    │ Backend  │              │
│   │ (Nginx)  │───▶│ (FastAPI)│              │
│   │ :80      │    │ :8000    │              │
│   └──────────┘    └────┬─────┘              │
│                        │                    │
│              ┌─────────┼──────────┐         │
│              │         │          │         │
│         ┌────▼───┐ ┌───▼────┐              │
│         │Postgres│ │ Redis  │              │
│         │ :5432  │ │ :6379  │              │
│         └────────┘ └────────┘              │
└─────────────────────────────────────────────┘
```

- **Frontend (Nginx)** → Serve React SPA + proxy `/api/`, `/auth/` para o backend
- **Backend (Gunicorn + Uvicorn)** → FastAPI em 2 workers
- **PostgreSQL 16** → Base de dados principal
- **Redis 7** → Cache e rate limiting

---

## Pré-requisitos

1. Conta no [DigitalOcean](https://www.digitalocean.com/) (já tens — GeoVision)
2. SSH key configurada na tua conta DO
3. Git instalado localmente

---

## ⚡ Deploy Rápido (Script Automático)

### 1. Criar Droplet no DigitalOcean

1. Vai ao [DO Dashboard](https://cloud.digitalocean.com/) → **Create** → **Droplets**
2. Configuração recomendada:
   - **Region**: Frankfurt (FRA1) — mais perto de Portugal
   - **Image**: Ubuntu 24.04 LTS
   - **Size**: Basic → Regular → **$6/mês** (1 vCPU, 1GB RAM, 25GB SSD)
     - Para produção real: **$12/mês** (2 vCPU, 2GB RAM) recomendado
   - **Authentication**: SSH Key (a tua)
   - **Hostname**: `health-platform`
3. Clicar **Create Droplet** e copiar o IP

### 2. Deploy com 1 Comando

```bash
# Dar permissão ao script
chmod +x deploy/setup-droplet.sh

# Deploy! (substituir pelo teu IP)
./deploy/setup-droplet.sh 164.92.xxx.xxx
```

O script faz tudo automaticamente:
- ✅ Instala Docker no droplet
- ✅ Configura firewall (portas 22, 80, 443)
- ✅ Clona o repositório
- ✅ Gera secrets seguros (.env)
- ✅ Faz build dos containers
- ✅ Inicia a plataforma

### 3. Aceder à Plataforma

```
🌐 App:     http://DROPLET_IP
🔑 Login:   http://DROPLET_IP/login
📡 API:     http://DROPLET_IP/api/v1/health
```

**Credenciais iniciais:**
| Role    | Email                              | Password   |
|---------|-------------------------------------|------------|
| Admin   | genovesi.maria@geovisionops.com    | Admin@1234 |
| Patient | paciente@health.com                | Admin@1234 |
| Doctor  | medico@health.com                  | Admin@1234 |

---

## 🔄 Atualizar (após mudanças no código)

```bash
# Faz push local
git add . && git commit -m "feat: ..." && git push

# Atualiza o droplet
chmod +x deploy/update.sh
./deploy/update.sh 164.92.xxx.xxx
```

---

## 🛠 Comandos Úteis (no Droplet)

```bash
# SSH no droplet
ssh root@DROPLET_IP

# Ver logs
cd /opt/health-platform
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs backend -f  # só backend
docker compose -f docker-compose.prod.yml logs frontend -f # só frontend

# Restart
docker compose -f docker-compose.prod.yml restart

# Parar tudo
docker compose -f docker-compose.prod.yml down

# Rebuild e reiniciar
docker compose -f docker-compose.prod.yml up -d --build

# Ver estado dos containers
docker compose -f docker-compose.prod.yml ps

# Aceder ao PostgreSQL
docker compose -f docker-compose.prod.yml exec db psql -U health_user -d health_platform

# Ver uso de disco
docker system df
docker system prune -a  # limpar imagens não usadas
```

---

## 🌐 Configurar Domínio (Opcional)

Se quiseres usar um domínio em vez de IP:

### 1. DNS
No teu registrar de domínio, adicionar:
```
A  health.teudominio.com  →  DROPLET_IP
```

### 2. SSL com Let's Encrypt

```bash
# SSH no droplet
ssh root@DROPLET_IP

# Instalar certbot
apt-get install -y certbot

# Gerar certificado
certbot certonly --standalone --preferred-challenges http \
  -d health.teudominio.com \
  --agree-tos -m teu@email.com

# Os certificados ficam em:
# /etc/letsencrypt/live/health.teudominio.com/fullchain.pem
# /etc/letsencrypt/live/health.teudominio.com/privkey.pem
```

### 3. Atualizar .env
```bash
cd /opt/health-platform
nano .env
# Mudar:
# FRONTEND_BASE=https://health.teudominio.com
# BACKEND_BASE=https://health.teudominio.com
# CORS_ORIGINS=https://health.teudominio.com
```

### 4. Restart
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📊 Monitorização

### Logs em tempo real
```bash
docker compose -f docker-compose.prod.yml logs -f --tail 100
```

### Verificar saúde
```bash
curl http://DROPLET_IP/health
# {"status":"ok","platform":"health"}
```

### Espaço em disco
```bash
df -h
docker system df
```

---

## 🔐 Segurança

1. **Mudar passwords** depois do primeiro login
2. **Backup da BD** regularmente:
   ```bash
   docker compose -f docker-compose.prod.yml exec db \
     pg_dump -U health_user health_platform > backup_$(date +%Y%m%d).sql
   ```
3. **Nunca commitar** o ficheiro `.env`
4. **Atualizar** o droplet regularmente:
   ```bash
   apt-get update && apt-get upgrade -y
   ```

---

## 💰 Custos Estimados

| Recurso            | Custo/mês |
|--------------------|-----------|
| Droplet ($6-12)    | $6-12     |
| Total              | **$6-12** |

> Nota: A BD PostgreSQL corre dentro do Droplet (Docker volume). Para produção
> mais robusta, podes usar DO Managed Database ($15/mês) — partilhado com GeoVision.

---

## 🐛 Troubleshooting

### Container não inicia
```bash
docker compose -f docker-compose.prod.yml logs backend
# Verificar se as env vars estão corretas
cat .env
```

### Erro de base de dados
```bash
# Verificar se PostgreSQL está a correr
docker compose -f docker-compose.prod.yml exec db pg_isready
# Correr migrations manualmente
docker compose -f docker-compose.prod.yml exec backend python -m alembic upgrade head
```

### Porta 80 ocupada
```bash
lsof -ti:80 | xargs kill -9 2>/dev/null
docker compose -f docker-compose.prod.yml up -d
```

### Reset completo (APAGA TUDO)
```bash
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```
