#!/bin/bash
set -e

APP_NAME="${1:-mongo-db-manager}"

echo "==> Pulling latest code..."
git pull

echo "==> Building client + server..."
npm run build

echo "==> Restarting PM2..."
pm2 restart "$APP_NAME"

echo "✅ Deploy done!"
