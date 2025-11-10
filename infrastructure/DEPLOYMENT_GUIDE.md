# Noble NovaCoreAI - Production Deployment Guide

## Overview

This guide covers the complete production deployment of Noble NovaCoreAI on DigitalOcean infrastructure using Terraform for infrastructure as code and automated CI/CD with GitHub Actions.

## Architecture

### Infrastructure Components

**App Server Droplet** (8GB RAM, 4vCPU - $48/month)
- API Gateway
- Auth & Billing Service
- Memory Service
- NGS Curriculum
- Noble-Spirit Policy
- Frontend
- Nginx reverse proxy
- Prometheus
- Grafana

**GPU Server Droplet** (GPU + 16GB RAM - $200/month)
- Intelligence Core (with Ollama/vLLM)
- Reflection Worker
- Distillation Worker
- MCP Server

**Managed Services**
- PostgreSQL Database ($15/month)
- Redis Cache ($15/month)
- Block Storage for models ($10/month)
- DigitalOcean Spaces for backups

**Total Monthly Cost:** ~$288/month

## Prerequisites

### Required Tools
- Terraform >= 1.5.0
- DigitalOcean account with payment method
- Domain name (e.g., novacore.ai)
- GitHub account (for CI/CD)
- SSH key pair
- Docker & Docker Compose

### Required Credentials
- DigitalOcean API token
- DigitalOcean Spaces access key and secret
- Stripe API keys (production)
- Domain DNS access
- GitHub repository access

## Step 1: Prepare DigitalOcean Account

### 1.1 Create API Token

1. Log in to DigitalOcean
2. Go to API → Tokens/Keys
3. Generate New Token
4. Name: "NovaCoreAI-Terraform"
5. Scopes: Read & Write
6. Save token securely

### 1.2 Create Spaces for Terraform State

1. Go to Spaces
2. Create new Space
3. Name: `novacore-terraform-state`
4. Region: NYC3
5. Enable CDN: No
6. Generate Spaces access key and secret

### 1.3 Add SSH Key

1. Go to Settings → Security → SSH Keys
2. Add your public SSH key
3. Name: "deployment-key"

## Step 2: Configure Domain

### 2.1 Add Domain to DigitalOcean

1. Go to Networking → Domains
2. Add domain: novacore.ai
3. Update nameservers at your registrar to:
   - ns1.digitalocean.com
   - ns2.digitalocean.com
   - ns3.digitalocean.com

### 2.2 Create DNS Records (will be created by Terraform)

```
A       @               -> [app_server_ip]
A       www             -> [app_server_ip]
A       api             -> [app_server_ip]
A       metrics         -> [app_server_ip]
CNAME   *               -> @
```

## Step 3: Deploy Infrastructure with Terraform

### 3.1 Initialize Terraform

```bash
cd infrastructure/terraform

# Set environment variables
export DO_TOKEN="your_digitalocean_token"
export DO_SPACES_ACCESS_KEY="your_spaces_key"
export DO_SPACES_SECRET_KEY="your_spaces_secret"

# Initialize Terraform
terraform init \
  -backend-config="access_key=$DO_SPACES_ACCESS_KEY" \
  -backend-config="secret_key=$DO_SPACES_SECRET_KEY"
```

### 3.2 Plan Infrastructure

```bash
# Review what will be created
terraform plan \
  -var="do_token=$DO_TOKEN" \
  -var="environment=production" \
  -var="app_domain=novacore.ai" \
  -out=tfplan
```

### 3.3 Apply Infrastructure

```bash
# Create infrastructure
terraform apply tfplan

# Save outputs
terraform output -json > outputs.json
```

### 3.4 Extract Connection Details

```bash
# Get app server IP
APP_IP=$(terraform output -raw app_server_ip)

# Get GPU server IP
GPU_IP=$(terraform output -raw gpu_server_ip)

# Get database connection
DB_CONNECTION=$(terraform output -raw database_connection)

# Get Redis connection
REDIS_CONNECTION=$(terraform output -raw redis_connection)
```

## Step 4: Configure Servers

### 4.1 SSH into App Server

```bash
ssh novacore@$APP_IP
```

### 4.2 Clone Repository

```bash
cd /opt/novacore
git clone https://github.com/SeenWD2025/NovaCoreAI.git .
```

### 4.3 Configure Environment

```bash
# Copy example environment
cp env.example .env

# Edit with production values
nano .env
```

Update these critical values:
```bash
# Database (from Terraform output)
DATABASE_URL="postgresql://..."

# Redis (from Terraform output)
REDIS_URL="redis://..."

# JWT Secrets (generate secure random strings)
JWT_SECRET="$(openssl rand -base64 48)"
JWT_REFRESH_SECRET="$(openssl rand -base64 48)"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Domain
DOMAIN="novacore.ai"
SSL_EMAIL="admin@novacore.ai"

# LLM Configuration
OLLAMA_URL="http://[gpu_server_private_ip]:11434"
LLM_MODEL="mistral:instruct"
GPU_ENABLED="true"

# Observability
GRAFANA_ADMIN_USER="admin"
GRAFANA_ADMIN_PASSWORD="[secure_password]"
```

### 4.4 Set Up SSL Certificates

```bash
# Run SSL setup script
sudo bash infrastructure/ssl/scripts/setup-ssl.sh
```

## Step 5: Configure GPU Server

### 5.1 SSH into GPU Server

```bash
ssh novacore@$GPU_IP
```

### 5.2 Install NVIDIA Drivers

```bash
# Install drivers
sudo ubuntu-drivers autoinstall

# Reboot
sudo reboot

# Verify installation
nvidia-smi
```

### 5.3 Install Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
docker compose exec ollama ollama pull mistral:instruct

# Verify
docker compose exec ollama ollama list
```

### 5.4 Configure Ollama Service

```bash
# Create systemd service
sudo nano /etc/systemd/system/ollama.service
```

Add:
```ini
[Unit]
Description=Ollama LLM Service
After=network.target

[Service]
Type=simple
User=novacore
ExecStart=/usr/local/bin/ollama serve
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/data/models"
Restart=always

[Install]
WantedBy=multi-user.target
```

Start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama
```

## Step 6: Deploy Application

### 6.1 On App Server

```bash
cd /opt/novacore

# Pull Docker images (or build locally)
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 6.2 Initialize Database

```bash
# Run migrations (if needed)
docker exec noble-postgres psql -U noble noble_novacore < shared/schemas/01_init.sql
```

### 6.3 Verify Services

```bash
# Check Gateway
curl http://localhost:5000/health

# Check HTTPS
curl https://novacore.ai/health

# Check API
curl https://api.novacore.ai/health
```

## Step 7: Configure CI/CD

### 7.1 Add GitHub Secrets

Go to GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
```
DO_TOKEN                    # DigitalOcean API token
DO_SPACES_ACCESS_KEY        # Spaces access key
DO_SPACES_SECRET_KEY        # Spaces secret key
SSH_PRIVATE_KEY            # SSH private key for deployment
KNOWN_HOSTS                # SSH known hosts
PRODUCTION_HOST            # App server IP
PRODUCTION_USER            # SSH user (novacore)
STAGING_HOST               # Optional staging server IP
STAGING_USER               # Optional staging SSH user
STAGING_SSH_PRIVATE_KEY    # Optional staging SSH key
STAGING_KNOWN_HOSTS        # Optional staging known hosts
```

### 7.2 Test CI/CD Pipeline

```bash
# Push to develop branch (triggers staging deploy)
git checkout develop
git push origin develop

# Push to main branch (triggers production deploy)
git checkout main
git merge develop
git push origin main
```

## Step 8: Configure Monitoring

### 8.1 Access Grafana

1. Open https://metrics.novacore.ai
2. Login with credentials from .env
3. Verify datasource connection to Prometheus
4. Check pre-configured dashboards

### 8.2 Configure Alerts

1. In Grafana, go to Alerting → Contact points
2. Add notification channels:
   - Email (SMTP)
   - Slack
   - PagerDuty
3. Configure alert rules for critical services

## Step 9: Set Up Backups

### 9.1 Configure Backup Script

```bash
# Edit backup configuration
nano scripts/backup.sh

# Update Spaces credentials in .env
DO_SPACES_KEY="your_key"
DO_SPACES_SECRET="your_secret"
```

### 9.2 Schedule Automated Backups

```bash
# Add cron job
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/novacore/scripts/backup.sh >> /var/log/novacore/backup.log 2>&1
```

### 9.3 Test Backup

```bash
# Run backup manually
bash scripts/backup.sh

# Verify backup files
ls -lh backups/postgres/
ls -lh backups/redis/
```

### 9.4 Test Restore

```bash
# Test restore on staging/dev environment
bash scripts/restore.sh [backup_timestamp] all
```

## Step 10: Security Hardening

### 10.1 Configure Firewall

```bash
# Already configured by Terraform and user-data script
# Verify rules
sudo ufw status verbose
```

### 10.2 Enable Fail2Ban

```bash
# Check status
sudo systemctl status fail2ban

# View banned IPs
sudo fail2ban-client status sshd
```

### 10.3 Configure Automatic Updates

```bash
# Verify unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 10.4 Set Up Log Monitoring

```bash
# Install logwatch (optional)
sudo apt install logwatch

# Configure daily email reports
sudo nano /etc/cron.daily/00logwatch
```

## Step 11: Performance Tuning

### 11.1 Database Optimization

```sql
-- Connect to PostgreSQL
psql $DATABASE_URL

-- Analyze database
ANALYZE;

-- Vacuum database
VACUUM ANALYZE;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### 11.2 Redis Optimization

```bash
# Check memory usage
redis-cli INFO memory

# Configure maxmemory policy in docker-compose.prod.yml
# maxmemory-policy: allkeys-lru
```

### 11.3 Nginx Optimization

Already configured in `infrastructure/nginx/nginx.conf`:
- Worker connections: 4096
- Gzip compression enabled
- Keepalive connections
- Rate limiting

## Step 12: Disaster Recovery Plan

### 12.1 Backup Strategy

- **Database:** Daily backups to Spaces, 30-day retention
- **Redis:** Daily snapshots to Spaces
- **Configuration:** Version controlled in Git
- **Logs:** Rotated daily, 14-day retention

### 12.2 Recovery Procedures

**Complete Server Failure:**
1. Provision new server with Terraform
2. Deploy application with CI/CD
3. Restore database from latest backup
4. Update DNS if needed

**Database Corruption:**
1. Stop application services
2. Restore from latest backup
3. Verify data integrity
4. Restart services

**Service Outage:**
1. Check logs: `docker-compose logs [service]`
2. Restart service: `docker-compose restart [service]`
3. Monitor metrics in Grafana
4. Escalate if needed

## Step 13: Maintenance

### 13.1 Regular Tasks

**Daily:**
- Monitor Grafana dashboards
- Check backup logs
- Review error logs

**Weekly:**
- Review security alerts
- Check disk space usage
- Analyze performance metrics

**Monthly:**
- Update dependencies
- Review and rotate logs
- Test disaster recovery
- Review and optimize database

### 13.2 Update Procedures

**Application Updates:**
```bash
# Via CI/CD (recommended)
git push origin main

# Manual deployment
cd /opt/novacore
git pull origin main
docker-compose pull
docker-compose up -d
```

**System Updates:**
```bash
# Automatic via unattended-upgrades
# Manual if needed:
sudo apt update
sudo apt upgrade
sudo reboot
```

## Troubleshooting

### Service Won't Start

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs [service]

# Restart service
docker-compose restart [service]
```

### Database Connection Issues

```bash
# Test database connection
docker exec noble-postgres psql -U noble noble_novacore -c "SELECT 1"

# Check database service
docker-compose ps postgres

# View database logs
docker-compose logs postgres
```

### SSL Certificate Issues

```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/novacore.ai/cert.pem -noout -enddate
```

### High Resource Usage

```bash
# Check container resource usage
docker stats

# Check system resources
htop

# Check disk space
df -h

# Check for memory leaks
docker-compose logs | grep -i "out of memory"
```

## Support and Monitoring

### Health Check Endpoints

- Gateway: https://api.novacore.ai/health
- Main app: https://novacore.ai/health
- Prometheus: http://localhost:9090/-/healthy
- Grafana: https://metrics.novacore.ai/api/health

### Log Locations

- Application logs: `/var/log/novacore/`
- Docker logs: `docker-compose logs`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

### Metrics Endpoints

All services expose Prometheus metrics at `/metrics`:
- Gateway: http://localhost:5000/metrics
- Services: http://localhost:[port]/metrics

## Cost Optimization

### Current Monthly Costs

- App Server: $48
- GPU Server: $200
- PostgreSQL: $15
- Redis: $15
- Block Storage: $10
- **Total: $288/month**

### Optimization Strategies

1. **Use Managed Databases:** Save on maintenance time
2. **Spot/Reserved Instances:** Consider reserved pricing for 12+ month commitment
3. **Auto-scaling:** Scale workers based on demand
4. **Caching:** Optimize Redis usage to reduce database queries
5. **CDN:** Use DigitalOcean Spaces CDN for static assets

## Next Steps

- [ ] Monitor application performance for first week
- [ ] Set up additional alerting channels
- [ ] Configure log aggregation (optional)
- [ ] Set up APM (Application Performance Monitoring)
- [ ] Implement rate limiting per user
- [ ] Add more comprehensive metrics
- [ ] Configure auto-scaling (if needed)
- [ ] Set up staging environment
- [ ] Document incident response procedures

---

**Deployment Guide Version:** 1.0  
**Last Updated:** November 9, 2025  
**Status:** Production Ready  
**Maintainer:** DevOps Team
