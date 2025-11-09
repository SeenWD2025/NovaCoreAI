#!/bin/bash
# Noble NovaCoreAI - Restore Script
# Restores from backup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Check arguments
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <backup_timestamp> [component]"
    echo ""
    echo "Components: postgres, redis, config, all (default)"
    echo ""
    echo "Example: $0 20251109_120000 all"
    exit 1
fi

TIMESTAMP="$1"
COMPONENT="${2:-all}"
BACKUP_DIR="${BACKUP_DIR:-/opt/novacore/backups}"

log "=== Starting Noble NovaCoreAI restore ==="
log "Timestamp: $TIMESTAMP"
log "Component: $COMPONENT"

# Confirm restore
read -p "⚠️  This will overwrite existing data. Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log "Restore cancelled"
    exit 0
fi

# Stop services
log "Stopping services..."
cd /opt/novacore
docker-compose down

# Restore PostgreSQL
if [ "$COMPONENT" = "postgres" ] || [ "$COMPONENT" = "all" ]; then
    POSTGRES_BACKUP="$BACKUP_DIR/postgres/postgres_${TIMESTAMP}.sql.gz"
    
    if [ -f "$POSTGRES_BACKUP" ]; then
        log "Restoring PostgreSQL database..."
        
        # Start only postgres
        docker-compose up -d postgres
        sleep 10
        
        # Drop and recreate database
        docker exec noble-postgres psql -U noble -c "DROP DATABASE IF EXISTS noble_novacore;"
        docker exec noble-postgres psql -U noble -c "CREATE DATABASE noble_novacore;"
        
        # Restore
        gunzip -c "$POSTGRES_BACKUP" | docker exec -i noble-postgres psql -U noble noble_novacore
        
        log "PostgreSQL restore completed"
    else
        error "PostgreSQL backup not found: $POSTGRES_BACKUP"
        exit 1
    fi
fi

# Restore Redis
if [ "$COMPONENT" = "redis" ] || [ "$COMPONENT" = "all" ]; then
    REDIS_BACKUP="$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb"
    
    if [ -f "$REDIS_BACKUP" ]; then
        log "Restoring Redis data..."
        
        # Start redis
        docker-compose up -d redis
        sleep 5
        
        # Stop redis and copy backup
        docker-compose stop redis
        docker cp "$REDIS_BACKUP" noble-redis:/data/dump.rdb
        
        # Restart redis
        docker-compose up -d redis
        
        log "Redis restore completed"
    else
        warn "Redis backup not found: $REDIS_BACKUP (skipping...)"
    fi
fi

# Restore configuration
if [ "$COMPONENT" = "config" ] || [ "$COMPONENT" = "all" ]; then
    CONFIG_BACKUP="$BACKUP_DIR/config/config_${TIMESTAMP}.tar.gz"
    
    if [ -f "$CONFIG_BACKUP" ]; then
        log "Restoring configuration files..."
        
        # Backup current config
        tar -czf "$BACKUP_DIR/config/config_pre_restore_$(date +%Y%m%d_%H%M%S).tar.gz" \
            -C /opt/novacore \
            .env \
            docker-compose.yml \
            docker-compose.prod.yml \
            2>/dev/null || true
        
        # Extract backup
        tar -xzf "$CONFIG_BACKUP" -C /opt/novacore
        
        log "Configuration restore completed"
    else
        warn "Configuration backup not found: $CONFIG_BACKUP (skipping...)"
    fi
fi

# Start all services
log "Starting all services..."
docker-compose up -d

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 30

# Health check
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    log "✅ Services are healthy"
else
    error "⚠️  Health check failed - services may need manual inspection"
fi

log "=== Restore completed ==="
log "Please verify all services are working correctly"

exit 0
