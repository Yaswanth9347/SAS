#!/usr/bin/env bash
# Render build script for Puppeteer dependencies

set -e  # Exit on error

echo "🔨 Starting Render build process..."

# Navigate to backend
cd backend

# Clean install to ensure Puppeteer is properly installed
echo "📦 Installing Node.js dependencies..."
npm ci --omit=dev --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

echo "✅ Build completed successfully!"
