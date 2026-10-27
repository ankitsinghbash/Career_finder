#!/usr/bin/env bash
# ==============================================================================
# Automated Setup Script for GCP Compute Engine (Ubuntu 22.04 / 24.04 LTS)
# Career Crawler Daemon (Playwright + SQLite + Node.js + PM2)
# ==============================================================================

set -e

echo "🚀 [1/6] Updating system packages..."
sudo apt-get update -y
sudo apt-get install -y curl wget git build-essential sqlite3 libsqlite3-dev

# Setup 2GB Swap Memory (Crucial for GCP e2-micro so Chromium doesn't OOM)
if [ ! -f /swapfile ]; then
    echo "💾 [2/6] Configuring 2GB Swap Memory for Playwright Chromium..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap memory enabled."
else
    echo "✅ Swapfile already exists."
fi

# Install Node.js 20 LTS
echo "📦 [3/6] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"

# Install PM2 globally
echo "⚙️ [4/6] Installing PM2 process manager..."
sudo npm install -g pm2

# Install project dependencies & Playwright system libraries
echo "📥 [5/6] Installing NPM packages & Playwright Chromium with Linux dependencies..."
npm install
npx playwright install --with-deps chromium

echo "=============================================================================="
echo "🎉 Setup complete! Starting the daemon with PM2..."
pm2 start scripts/auto_scheduler.js --name "career-crawler"
pm2 save

echo ""
echo "✅ Career Crawler Daemon is now running 24/7 in background!"
echo "To view live logs: pm2 logs career-crawler"
echo "=============================================================================="
