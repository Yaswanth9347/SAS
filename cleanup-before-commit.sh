#!/bin/bash

# ============================================
# CLEANUP SCRIPT FOR GITHUB COMMIT
# ============================================
# This script removes sensitive files and cleans up the project
# before committing to GitHub
#
# Usage: ./cleanup-before-commit.sh
# ============================================

set -e  # Exit on error

echo "🧹 Starting project cleanup..."
echo ""

# ============================================
# 1. REMOVE NODE_MODULES
# ============================================
echo "📦 Step 1: Removing node_modules directories..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo "✅ Removed root node_modules"
fi
if [ -d "backend/node_modules" ]; then
    rm -rf backend/node_modules
    echo "✅ Removed backend/node_modules"
fi
if [ -d "frontend/node_modules" ]; then
    rm -rf frontend/node_modules
    echo "✅ Removed frontend/node_modules"
fi
echo ""

# ============================================
# 2. VERIFY .ENV IS NOT TRACKED
# ============================================
echo "🔒 Step 2: Checking for sensitive .env files..."
if [ -f "backend/.env" ]; then
    echo "⚠️  WARNING: backend/.env exists"
    echo "   Make sure it's in .gitignore and run: git rm --cached backend/.env"
    git rm --cached backend/.env 2>/dev/null || echo "   (File not tracked by Git - OK)"
fi
echo "✅ .env check complete"
echo ""

# ============================================
# 3. CLEAN UPLOADED FILES
# ============================================
echo "📁 Step 3: Cleaning uploaded files (keeping folder structure)..."
if [ -d "backend/uploads" ]; then
    # Remove all files but keep .gitkeep files
    find backend/uploads -type f ! -name '.gitkeep' -delete 2>/dev/null || true
    echo "✅ Cleaned uploads directory"
fi
echo ""

# ============================================
# 4. REMOVE LOG FILES
# ============================================
echo "📄 Step 4: Removing log files..."
find . -name "*.log" -type f -delete 2>/dev/null || true
if [ -d "logs" ]; then
    rm -rf logs/*.log 2>/dev/null || true
fi
if [ -d "backend/logs" ]; then
    rm -rf backend/logs/*.log 2>/dev/null || true
fi
echo "✅ Log files removed"
echo ""

# ============================================
# 5. REMOVE OS FILES
# ============================================
echo "💻 Step 5: Removing OS-generated files..."
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
find . -name "Thumbs.db" -type f -delete 2>/dev/null || true
find . -name "Desktop.ini" -type f -delete 2>/dev/null || true
echo "✅ OS files removed"
echo ""

# ============================================
# 6. REMOVE BUILD ARTIFACTS
# ============================================
echo "🏗️  Step 6: Removing build artifacts..."
if [ -d "dist" ]; then
    rm -rf dist
    echo "✅ Removed dist/"
fi
if [ -d "build" ]; then
    rm -rf build
    echo "✅ Removed build/"
fi
if [ -d ".next" ]; then
    rm -rf .next
    echo "✅ Removed .next/"
fi
echo ""

# ============================================
# 7. REMOVE CACHE DIRECTORIES
# ============================================
echo "🗄️  Step 7: Removing cache directories..."
if [ -d ".cache" ]; then
    rm -rf .cache
    echo "✅ Removed .cache/"
fi
if [ -d ".parcel-cache" ]; then
    rm -rf .parcel-cache
    echo "✅ Removed .parcel-cache/"
fi
if [ -d ".eslintcache" ]; then
    rm -rf .eslintcache
    echo "✅ Removed .eslintcache"
fi
echo ""

# ============================================
# 8. REMOVE TEST COVERAGE
# ============================================
echo "📊 Step 8: Removing test coverage..."
if [ -d "coverage" ]; then
    rm -rf coverage
    echo "✅ Removed coverage/"
fi
if [ -d ".nyc_output" ]; then
    rm -rf .nyc_output
    echo "✅ Removed .nyc_output/"
fi
echo ""

# ============================================
# 9. REMOVE BACKUP FILES
# ============================================
echo "💾 Step 9: Removing backup files..."
find . -name "*.bak" -type f -delete 2>/dev/null || true
find . -name "*.backup" -type f -delete 2>/dev/null || true
find . -name ".env.backup" -type f -delete 2>/dev/null || true
echo "✅ Backup files removed"
echo ""

# ============================================
# 10. VERIFY .GITKEEP FILES EXIST
# ============================================
echo "📌 Step 10: Verifying .gitkeep files..."
mkdir -p backend/uploads/photos backend/uploads/videos backend/uploads/docs backend/uploads/avatars
touch backend/uploads/.gitkeep
touch backend/uploads/photos/.gitkeep
touch backend/uploads/videos/.gitkeep
touch backend/uploads/docs/.gitkeep
touch backend/uploads/avatars/.gitkeep
echo "✅ .gitkeep files verified"
echo ""

# ============================================
# 11. FINAL VERIFICATION
# ============================================
echo "🔍 Step 11: Running final verification..."
echo ""
echo "Project size:"
du -sh . 2>/dev/null || echo "  (unable to calculate)"
echo ""
echo "Checking for sensitive files that should NOT be committed:"
echo "  - Checking for .env files..."
if git ls-files | grep -q "\.env$"; then
    echo "    ⚠️  WARNING: .env files are being tracked by Git!"
    echo "    Run: git rm --cached \$(git ls-files | grep '\.env$')"
else
    echo "    ✅ No .env files tracked"
fi
echo "  - Checking for node_modules..."
if git ls-files | grep -q "node_modules"; then
    echo "    ⚠️  WARNING: node_modules is being tracked by Git!"
else
    echo "    ✅ No node_modules tracked"
fi
echo "  - Checking for uploads content..."
UPLOAD_COUNT=$(git ls-files | grep -c "backend/uploads/.*\.(jpg|jpeg|png|gif|mp4|pdf)" || echo "0")
if [ "$UPLOAD_COUNT" -gt 5 ]; then
    echo "    ⚠️  WARNING: $UPLOAD_COUNT uploaded files are being tracked!"
else
    echo "    ✅ Upload files not tracked (found: $UPLOAD_COUNT .gitkeep files)"
fi
echo ""

# ============================================
# SUMMARY
# ============================================
echo "═══════════════════════════════════════════"
echo "✅ CLEANUP COMPLETE!"
echo "═══════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Verify no sensitive files: git diff --cached"
echo "3. Stage changes: git add ."
echo "4. Commit: git commit -m 'Clean up project before deployment'"
echo "5. Push to GitHub: git push origin main"
echo ""
echo "⚠️  IMPORTANT: Verify backend/.env is NOT in the commit!"
echo ""
