# Noble NovaCoreAI - Infrastructure

## Overview

This directory contains all infrastructure-as-code (IaC) and deployment configurations for Noble NovaCoreAI production deployment on DigitalOcean.

## Directory Structure

```
infrastructure/
├── terraform/              # Terraform configurations
│   ├── main.tf            # Main configuration
│   ├── modules/           # Reusable modules
│   │   ├── networking/    # VPC and firewall rules
│   │   ├── database/      # Managed PostgreSQL
│   │   ├── redis/         # Managed Redis
│   │   ├── storage/       # Block storage and Spaces
│   │   └── droplet/       # Virtual machine configuration
│   └── environments/      # Environment-specific configs
│       ├── dev/
│       ├── staging/
│       └── production/
├── nginx/                 # Nginx reverse proxy configuration
│   ├── nginx.conf        # Main nginx config
│   └── conf.d/           # Site-specific configs
├── ssl/                   # SSL/TLS certificates
│   └── scripts/          # SSL setup automation
├── DEPLOYMENT_GUIDE.md   # Comprehensive deployment guide
└── README.md             # This file
```

## Quick Start

### Prerequisites

1. **DigitalOcean Account** with payment method
2. **Terraform** >= 1.5.0 installed
3. **Domain name** registered and DNS configured
4. **SSH key** added to DigitalOcean
5. **Required credentials:**
   - DigitalOcean API token
   - Spaces access key and secret

### Deploy Infrastructure

```bash
# Navigate to terraform directory
cd infrastructure/terraform

# Set environment variables
export DO_TOKEN="your_digitalocean_token"
export DO_SPACES_ACCESS_KEY="your_spaces_key"
export DO_SPACES_SECRET_KEY="your_spaces_secret"

# Initialize Terraform
terraform init \
  -backend-config="access_key=$DO_SPACES_ACCESS_KEY" \
  -backend-config="secret_key=$DO_SPACES_SECRET_KEY"

# Plan infrastructure changes
terraform plan \
  -var="do_token=$DO_TOKEN" \
  -var="environment=production" \
  -var="app_domain=novacore.ai"

# Apply changes
terraform apply \
  -var="do_token=$DO_TOKEN" \
  -var="environment=production" \
  -var="app_domain=novacore.ai"
```

### Get Infrastructure Details

```bash
# View all outputs
terraform output

# Get specific values
terraform output app_server_ip
terraform output gpu_server_ip
terraform output database_connection
terraform output redis_connection
```

## Terraform Modules

### Networking Module

Creates VPC and firewall rules for secure communication.

**Resources:**
- VPC with 10.10.0.0/16 CIDR
- Firewall rules for app server
- Firewall rules for GPU server

**Inputs:**
- `environment` - Environment name
- `region` - DigitalOcean region

**Outputs:**
- `vpc_id` - VPC identifier
- `firewall_app_id` - App firewall ID
- `firewall_gpu_id` - GPU firewall ID

### Database Module

Provisions managed PostgreSQL database cluster.

**Resources:**
- PostgreSQL 15 cluster
- Database: `noble_novacore`
- Connection pool
- VPC firewall rule

**Configuration:**
- Size: db-s-2vcpu-4gb (production)
- Node count: 2 (HA in production)
- Private networking enabled

**Outputs:**
- `connection_string` - Full connection URI
- `host`, `port` - Connection details
- `database_name` - Database name
- `user`, `password` - Credentials
- `pool_uri` - Connection pool URI

### Redis Module

Provisions managed Redis cluster for caching.

**Resources:**
- Redis 7 cluster
- VPC firewall rule

**Configuration:**
- Size: db-s-2vcpu-4gb (production)
- Node count: 1
- Private networking enabled

**Outputs:**
- `connection_string` - Redis URI
- `host`, `port` - Connection details
- `password` - Redis password

### Storage Module

Creates block storage and object storage.

**Resources:**
- Block volume (100GB) for ML models
- Spaces bucket for assets
- Spaces bucket for backups

**Features:**
- CORS configuration for assets
- Versioning enabled in production
- Lifecycle rules for backup retention

**Outputs:**
- `model_volume_id` - Volume ID
- `bucket_endpoint` - Spaces endpoint
- `assets_bucket_name` - Assets bucket
- `backups_bucket_name` - Backups bucket

### Droplet Module

Creates and configures virtual machines.

**Resources:**
- Ubuntu 22.04 droplet
- Volume attachments
- Reserved IP (production only)
- Monitoring enabled
- Automatic backups (production)

**User Data:**
- System updates
- Docker installation
- User creation
- Directory setup
- Firewall configuration
- Monitoring agent
- NVIDIA drivers (GPU instances)

**Inputs:**
- `name` - Droplet name
- `size` - Instance size
- `vpc_uuid` - VPC ID
- `ssh_keys` - SSH key IDs
- `volume_ids` - Volumes to attach

**Outputs:**
- `id` - Droplet ID
- `ipv4_address` - Public IP
- `ipv4_address_private` - Private IP

## Nginx Configuration

### Main Configuration (`nginx.conf`)

- Worker processes: auto
- Worker connections: 4096
- Gzip compression enabled
- Security headers configured
- Rate limiting zones defined

### Site Configuration (`conf.d/novacore.conf`)

**Servers:**
1. **HTTP (port 80)** - Redirects to HTTPS
2. **Main App** - Frontend (novacore.ai, www)
3. **API Gateway** - Backend API (api.novacore.ai)
4. **Metrics** - Grafana (metrics.novacore.ai)

**Features:**
- SSL/TLS with Let's Encrypt
- HTTP/2 enabled
- WebSocket support
- Rate limiting
- HSTS headers
- Proxy buffering for streaming

## SSL/TLS Setup

### Automatic Setup Script

```bash
# Run SSL setup
sudo bash infrastructure/ssl/scripts/setup-ssl.sh

# With custom domain
DOMAIN=yourdomain.com SSL_EMAIL=admin@yourdomain.com \
  bash infrastructure/ssl/scripts/setup-ssl.sh

# Test with staging certificates first
STAGING=true bash infrastructure/ssl/scripts/setup-ssl.sh
```

### Manual Setup

```bash
# Install certbot
apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email admin@novacore.ai \
  -d novacore.ai \
  -d www.novacore.ai \
  -d api.novacore.ai \
  -d metrics.novacore.ai

# Set up auto-renewal
certbot renew --dry-run
```

### Certificate Renewal

Automatic renewal is configured in cron:
```
0 0,12 * * * root certbot renew --quiet --post-hook "cd /opt/novacore && docker-compose restart nginx"
```

## Environment Variables

### Required for Terraform

```bash
export DO_TOKEN="dop_v1_..."
export DO_SPACES_ACCESS_KEY="..."
export DO_SPACES_SECRET_KEY="..."
```

### Production Application (.env)

```bash
# Database (from Terraform output)
DATABASE_URL="postgresql://..."

# Redis (from Terraform output)
REDIS_URL="redis://..."

# JWT Secrets
JWT_SECRET="generated_secret_min_48_chars"
JWT_REFRESH_SECRET="generated_secret_min_48_chars"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Domain Configuration
DOMAIN="novacore.ai"
SSL_EMAIL="admin@novacore.ai"

# LLM
OLLAMA_URL="http://[gpu_private_ip]:11434"
LLM_MODEL="mistral:7b-instruct-q4"
GPU_ENABLED="true"

# Observability
GRAFANA_ADMIN_USER="admin"
GRAFANA_ADMIN_PASSWORD="secure_password"

# Backup
DO_SPACES_KEY="..."
DO_SPACES_SECRET="..."
S3_BUCKET="novacore-backups-production"
```

## Infrastructure Costs

### Monthly Breakdown

| Resource | Specs | Cost |
|----------|-------|------|
| App Server | 8GB RAM, 4vCPU | $48 |
| GPU Server | GPU, 16GB RAM | $200 |
| PostgreSQL | 4GB, 2vCPU, HA | $15 |
| Redis | 4GB, 2vCPU | $15 |
| Block Storage | 100GB | $10 |
| Spaces | 250GB storage | ~$5 |
| **Total** | | **~$293/month** |

### Cost Optimization

- Use development environment for testing ($100-150/month)
- Reserved pricing for 12+ month commitment (10-20% savings)
- Monitor and right-size resources
- Use managed services to save on maintenance

## Monitoring and Alerts

### Metrics Collected

**Infrastructure:**
- CPU usage
- Memory usage
- Disk space
- Network I/O

**Application:**
- Request rate
- Response time
- Error rate
- Token usage

**Database:**
- Connection count
- Query performance
- Replication lag

**Redis:**
- Memory usage
- Hit rate
- Command rate

### Alert Rules

See `../observability/prometheus/rules/alerts.yml` for complete list.

**Critical Alerts:**
- Service down
- Database unavailable
- Redis unavailable
- Disk space < 5%

**Warning Alerts:**
- High error rate (>5%)
- High latency (p95 > 2s)
- High resource usage (>80%)
- Disk space < 15%

## Security

### Network Security

- VPC for private networking
- Firewall rules restrict access
- Internal services not exposed publicly
- Rate limiting on public endpoints

### Application Security

- HTTPS enforced (HSTS)
- Security headers configured
- JWT authentication
- Input validation
- SQL injection prevention

### Operational Security

- SSH key authentication only
- Fail2ban for brute force protection
- Automatic security updates
- Regular backups encrypted at rest
- Secrets managed via environment variables

## Backup and Recovery

### Automated Backups

Daily backups at 2 AM UTC:
- PostgreSQL database (gzipped SQL dump)
- Redis snapshot (RDB file)
- Configuration files
- Application logs

Retention: 30 days local, 90 days in Spaces

### Backup Script

```bash
# Manual backup
/opt/novacore/scripts/backup.sh

# View backups
ls -lh /opt/novacore/backups/

# Restore from backup
/opt/novacore/scripts/restore.sh [timestamp] all
```

### Disaster Recovery

**RTO (Recovery Time Objective):** 1 hour
**RPO (Recovery Point Objective):** 24 hours

See DEPLOYMENT_GUIDE.md for detailed recovery procedures.

## CI/CD Pipeline

### GitHub Actions Workflows

Located in `.github/workflows/ci-cd.yml`:

**Triggers:**
- Push to `main` → Production deployment
- Push to `develop` → Staging deployment
- Pull request → Run tests only

**Jobs:**
1. **Test** - Run service tests
2. **Build** - Build and push Docker images
3. **Terraform** - Plan and apply infrastructure
4. **Deploy** - Deploy to servers via SSH

### Required GitHub Secrets

```
DO_TOKEN                  # DigitalOcean API token
DO_SPACES_ACCESS_KEY      # Spaces access key
DO_SPACES_SECRET_KEY      # Spaces secret key
SSH_PRIVATE_KEY          # Deployment SSH key
KNOWN_HOSTS              # SSH known hosts
PRODUCTION_HOST          # App server IP
PRODUCTION_USER          # SSH username
```

## Maintenance

### Regular Tasks

**Daily:**
- Check Grafana dashboards
- Verify backup completion
- Review error logs

**Weekly:**
- Check disk space
- Review performance metrics
- Security patch review

**Monthly:**
- Test disaster recovery
- Update dependencies
- Review and optimize costs
- Database maintenance

### Update Procedures

**Infrastructure:**
```bash
cd infrastructure/terraform
terraform plan
terraform apply
```

**Application:**
```bash
# Via CI/CD (recommended)
git push origin main

# Manual
cd /opt/novacore
git pull
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Common Issues

**Terraform Errors:**
```bash
# State locked
terraform force-unlock [lock-id]

# State out of sync
terraform refresh
```

**Service Won't Start:**
```bash
# Check logs
docker-compose logs [service]

# Restart service
docker-compose restart [service]
```

**Database Connection:**
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT 1"

# Check firewall rules
terraform show | grep firewall
```

## Support

For issues or questions:

1. Check logs: `docker-compose logs [service]`
2. Review Grafana dashboards
3. Consult DEPLOYMENT_GUIDE.md
4. Check Terraform state: `terraform show`
5. Review project documentation in `/docs`

## Resources

- [DigitalOcean Documentation](https://docs.digitalocean.com/)
- [Terraform DigitalOcean Provider](https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

---

**Infrastructure Version:** 1.0  
**Last Updated:** November 9, 2025  
**Status:** Production Ready
