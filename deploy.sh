#!/bin/bash

# Script deploy untuk GitHub
# Generated: 2025-09-30T05:52:36.850Z

echo "🚀 Memulai deploy dari GitHub..."

# 1. Update dari GitHub
echo "📥 Update dari GitHub..."
git pull origin main

# 2. Install dependencies
echo "📦 Install dependencies..."
npm install

# 3. Buat direktori yang diperlukan
echo "📁 Membuat direktori yang diperlukan..."
mkdir -p data/backup
mkdir -p logs
mkdir -p whatsapp-session

# 4. Set permissions
echo "🔐 Mengatur permissions..."
chmod 755 data/
chmod 755 logs/
chmod 755 whatsapp-session/
chmod 644 settings.json

# 5. Restart aplikasi (jika menggunakan PM2)
echo "🔄 Restart aplikasi..."
pm2 restart gembok-bill || pm2 start app.js --name gembok-bill

# 6. Verifikasi
echo "✅ Verifikasi deploy..."
pm2 status gembok-bill

echo "🎉 Deploy selesai!"
