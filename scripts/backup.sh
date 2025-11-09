#!/bin/bash
# Noble NovaCoreAI - Backup Script
# Backs up PostgreSQL database, Redis data, and application files

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/novacore/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
S3_BUCKET="${S3_BUCKET:-novacore-backups-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log "=== Starting Noble NovaCoreAI backup ==="

# Create backup directory
mkdir -p "$BACKUP_DIR"/{postgres,redis,config,logs}

# Backup PostgreSQL
log "Backing up PostgreSQL database..."
if docker exec noble-postgres pg_dump -U noble noble_novacore | gzip > "$BACKUP_DIR/postgres/postgres_${TIMESTAMP}.sql.gz"; then
    log "PostgreSQL backup completed: postgres_${TIMESTAMP}.sql.gz"
else
    error "PostgreSQL backup failed"
    exit 1
fi

# Backup Redis
log "Backing up Redis data..."
if docker exec noble-redis redis-cli --rdb /data/dump.rdb save && \
   docker cp noble-redis:/data/dump.rdb "$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb"; then
    log "Redis backup completed: redis_${TIMESTAMP}.rdb"
else
    warn "Redis backup failed (continuing...)"
fi

# Backup configuration files
log "Backing up configuration files..."
tar -czf "$BACKUP_DIR/config/config_${TIMESTAMP}.tar.gz" \
    -C /opt/novacore \
    .env \
    docker-compose.yml \
    docker-compose.prod.yml \
    observability/prometheus/prometheus.yml \
    observability/grafana/provisioning \
    infrastructure/nginx \
    2>/dev/null || warn "Some config files missing"

# Backup application logs
log "Backing up logs..."
tar -czf "$BACKUP_DIR/logs/logs_${TIMESTAMP}.tar.gz" \
    -C /var/log \
    novacore \
    2>/dev/null || warn "Logs backup skipped"

# Upload to DigitalOcean Spaces (S3-compatible)
if [ -n "$DO_SPACES_KEY" ] && [ -n "$DO_SPACES_SECRET" ]; then
    log "Uploading backups to DigitalOcean Spaces..."
    
    export AWS_ACCESS_KEY_ID="$DO_SPACES_KEY"
    export AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET"
    
    # Install s3cmd if not present
    if ! command -v s3cmd &> /dev/null; then
        warn "s3cmd not installed, skipping upload"
    else
        s3cmd put --recursive \
            "$BACKUP_DIR/" \
            "s3://${S3_BUCKET}/backups/${TIMESTAMP}/" \
            --host=nyc3.digitaloceanspaces.com \
            --host-bucket='%(bucket)s.nyc3.digitaloceanspaces.com'
        
        log "Backups uploaded to Spaces"
    fi
else
    warn "Spaces credentials not configured, skipping upload"
fi

# Clean up old backups
log "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR/postgres" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR/redis" -name "*.rdb" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR/config" -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR/logs" -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete

# Calculate backup sizes
POSTGRES_SIZE=$(du -sh "$BACKUP_DIR/postgres/postgres_${TIMESTAMP}.sql.gz" 2>/dev/null | cut -f1 || echo "N/A")
REDIS_SIZE=$(du -sh "$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb" 2>/dev/null | cut -f1 || echo "N/A")
CONFIG_SIZE=$(du -sh "$BACKUP_DIR/config/config_${TIMESTAMP}.tar.gz" 2>/dev/null | cut -f1 || echo "N/A")

log "=== Backup completed successfully ==="
log "PostgreSQL: $POSTGRES_SIZE"
log "Redis: $REDIS_SIZE"
log "Config: $CONFIG_SIZE"
log "Location: $BACKUP_DIR"

# Send notification (optional)
if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"✅ NovaCoreAI backup completed successfully at $(date)\"}" \
        2>/dev/null || true
fi

exit 0
