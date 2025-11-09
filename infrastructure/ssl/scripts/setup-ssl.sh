#!/bin/bash
# Noble NovaCoreAI - SSL/TLS Certificate Setup with Let's Encrypt
# This script sets up SSL certificates for production deployment

set -e

# Configuration
DOMAIN="${DOMAIN:-novacore.ai}"
EMAIL="${SSL_EMAIL:-admin@novacore.ai}"
STAGING="${STAGING:-false}"

echo "=== Setting up SSL/TLS certificates for Noble NovaCoreAI ==="
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Stop nginx temporarily
echo "Stopping nginx..."
docker-compose stop nginx || true

# Obtain certificate
if [ "$STAGING" = "true" ]; then
    echo "Using Let's Encrypt staging server..."
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        --staging \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        -d "api.$DOMAIN" \
        -d "metrics.$DOMAIN"
else
    echo "Obtaining production certificate..."
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        -d "api.$DOMAIN" \
        -d "metrics.$DOMAIN"
fi

# Copy certificates to nginx directory
echo "Copying certificates..."
mkdir -p /opt/novacore/infrastructure/ssl/certs
mkdir -p /opt/novacore/infrastructure/ssl/letsencrypt

cp -L /etc/letsencrypt/live/$DOMAIN/fullchain.pem /opt/novacore/infrastructure/ssl/certs/
cp -L /etc/letsencrypt/live/$DOMAIN/privkey.pem /opt/novacore/infrastructure/ssl/certs/
cp -r /etc/letsencrypt /opt/novacore/infrastructure/ssl/

# Set correct permissions
chmod 644 /opt/novacore/infrastructure/ssl/certs/fullchain.pem
chmod 600 /opt/novacore/infrastructure/ssl/certs/privkey.pem

# Start nginx
echo "Starting nginx..."
cd /opt/novacore
docker-compose up -d nginx

# Set up auto-renewal
echo "Setting up auto-renewal..."
cat > /etc/cron.d/certbot-renewal << EOF
# Renew certificates twice daily
0 0,12 * * * root certbot renew --quiet --post-hook "cd /opt/novacore && docker-compose restart nginx"
EOF

chmod 644 /etc/cron.d/certbot-renewal

echo "=== SSL/TLS setup complete ==="
echo "Certificates installed for: $DOMAIN, www.$DOMAIN, api.$DOMAIN, metrics.$DOMAIN"
echo "Auto-renewal configured"
