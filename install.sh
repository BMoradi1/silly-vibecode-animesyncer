#!/bin/bash

# Anime Syncer Installation Script for Debian
# Run as root or with sudo

set -e

echo "================================"
echo "Anime Syncer Installation Script"
echo "================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo"
  exit 1
fi

# Update system
echo "Updating system packages..."
apt-get update

# Install Node.js and npm
echo "Installing Node.js and npm..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

# Install nginx
echo "Installing nginx..."
apt-get install -y nginx

# Create application directory
echo "Setting up application directory..."
APP_DIR="/var/www/anime-syncer"
mkdir -p $APP_DIR
cp -r ./* $APP_DIR/
cd $APP_DIR

# Install dependencies
echo "Installing Node.js dependencies..."
npm install --production

# Create uploads directory with proper permissions
mkdir -p $APP_DIR/uploads
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Setup systemd service
echo "Setting up systemd service..."
cp anime-syncer.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable anime-syncer
systemctl start anime-syncer

# Setup nginx
echo "Configuring nginx..."
cp nginx.conf /etc/nginx/sites-available/anime-syncer
ln -sf /etc/nginx/sites-available/anime-syncer /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# Setup firewall (if ufw is installed)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw allow 80/tcp
    ufw allow 443/tcp
fi

echo ""
echo "================================"
echo "Installation Complete!"
echo "================================"
echo ""
echo "Service status:"
systemctl status anime-syncer --no-pager
echo ""
echo "The application is now running!"
echo "Admin panel: http://your-server-ip/admin"
echo "Client view: http://your-server-ip/"
echo ""
echo "To view logs: journalctl -u anime-syncer -f"
echo "To restart: systemctl restart anime-syncer"
echo ""
echo "Don't forget to:"
echo "1. Update nginx.conf with your domain name"
echo "2. Configure SSL with Let's Encrypt (recommended)"
echo ""
