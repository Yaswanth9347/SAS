#!/usr/bin/env bash
# Render build script for Puppeteer dependencies

set -e  # Exit on error

echo "🔨 Starting Render build process..."

# Navigate to backend
cd backend

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Puppeteer with Chromium
echo "🌐 Installing Puppeteer with Chromium..."
npm install puppeteer --save

echo "✅ Build completed successfully!"
