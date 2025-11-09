#!/bin/bash
# Noble NovaCoreAI - Droplet Initialization Script
# This script runs on first boot to configure the server

set -e

echo "=== Starting Noble NovaCoreAI server initialization ==="
echo "Hostname: ${hostname}"
echo "Environment: ${environment}"

# Update system
echo "=== Updating system packages ==="
apt-get update
apt-get upgrade -y

# Install essential packages
echo "=== Installing essential packages ==="
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    git \
    ufw \
    fail2ban \
    htop \
    vim \
    wget \
    unzip

# Set hostname
echo "=== Setting hostname ==="
hostnamectl set-hostname ${hostname}

# Configure firewall
echo "=== Configuring firewall ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Install Docker
echo "=== Installing Docker ==="
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
echo "=== Installing Docker Compose ==="
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create novacore user
echo "=== Creating novacore user ==="
useradd -m -s /bin/bash -G docker novacore || true

# Create application directories
echo "=== Creating application directories ==="
mkdir -p /opt/novacore
mkdir -p /var/log/novacore
mkdir -p /data/models
chown -R novacore:novacore /opt/novacore
chown -R novacore:novacore /var/log/novacore
chown -R novacore:novacore /data/models

# Mount block storage if exists
if [ -e /dev/disk/by-id/scsi-0DO_Volume_novacore-models-${environment} ]; then
    echo "=== Mounting model storage ==="
    mkfs.ext4 -F /dev/disk/by-id/scsi-0DO_Volume_novacore-models-${environment} || true
    mount /dev/disk/by-id/scsi-0DO_Volume_novacore-models-${environment} /data/models
    echo '/dev/disk/by-id/scsi-0DO_Volume_novacore-models-${environment} /data/models ext4 defaults,nofail,discard 0 2' >> /etc/fstab
fi

# Configure fail2ban
echo "=== Configuring fail2ban ==="
systemctl enable fail2ban
systemctl start fail2ban

# Set up log rotation
echo "=== Configuring log rotation ==="
cat > /etc/logrotate.d/novacore << 'EOF'
/var/log/novacore/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 novacore novacore
    sharedscripts
    postrotate
        docker-compose -f /opt/novacore/docker-compose.yml restart || true
    endscript
}
EOF

# Install monitoring agent (if using DigitalOcean monitoring)
echo "=== Installing monitoring agent ==="
curl -sSL https://repos.insights.digitalocean.com/install.sh | bash || true

# Create systemd service for NovaCoreAI
echo "=== Creating systemd service ==="
cat > /etc/systemd/system/novacore.service << 'EOF'
[Unit]
Description=Noble NovaCoreAI Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/novacore
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=novacore
Group=novacore

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable novacore.service

# Set up automatic security updates
echo "=== Configuring automatic security updates ==="
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Create deployment script
echo "=== Creating deployment script ==="
cat > /opt/novacore/deploy.sh << 'EOF'
#!/bin/bash
# NovaCoreAI Deployment Script

set -e

echo "Pulling latest changes..."
cd /opt/novacore
git pull origin main

echo "Pulling Docker images..."
docker-compose pull

echo "Restarting services..."
docker-compose up -d --remove-orphans

echo "Cleaning up old images..."
docker image prune -f

echo "Deployment complete!"
EOF

chmod +x /opt/novacore/deploy.sh
chown novacore:novacore /opt/novacore/deploy.sh

# Install NVIDIA drivers if GPU instance
if lspci | grep -i nvidia > /dev/null; then
    echo "=== Installing NVIDIA drivers for GPU ==="
    apt-get install -y ubuntu-drivers-common
    ubuntu-drivers autoinstall
    
    # Install NVIDIA Docker runtime
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
    curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add -
    curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | tee /etc/apt/sources.list.d/nvidia-docker.list
    apt-get update
    apt-get install -y nvidia-docker2
    systemctl restart docker
fi

# Final system optimization
echo "=== Optimizing system settings ==="
cat >> /etc/sysctl.conf << 'EOF'
# NovaCoreAI optimizations
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.ip_local_port_range = 1024 65535
vm.swappiness = 10
EOF

sysctl -p

echo "=== Server initialization complete ==="
echo "Ready for application deployment"
