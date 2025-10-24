#!/bin/bash

# SAS Application - Quick Migration Script
# This script helps migrate HTML files to use shared JavaScript modules

echo "================================================"
echo "  SAS Application - Module Migration Helper"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Files to migrate
FILES=(
  "visits.html"
  "schools.html"
  "teams.html"
  "visit-gallery.html"
  "schedule-visit.html"
  "visit-report.html"
  "contact.html"
  "analytics.html"
  "reports.html"
)

echo "Files pending migration:"
echo "------------------------"
for file in "${FILES[@]}"; do
  echo "  - $file"
done

echo ""
echo -e "${YELLOW}Note: dashboard.html has already been migrated!${NC}"
echo ""

echo "To manually migrate a file:"
echo "============================="
echo ""
echo "1. Add these script tags before </body>:"
echo "   ----------------------------------"
echo '   <script src="js/config.js"></script>'
echo '   <script src="js/utils.js"></script>'
echo '   <script src="js/auth.js"></script>'
echo '   <script src="js/api.js"></script>'
echo '   <script src="js/navbar.js"></script>'
echo '   <script src="js/notifications.js"></script>'
echo '   <script src="js/loading.js"></script>'
echo '   <script src="js/app.js"></script>'
echo ""

echo "2. Replace authentication code:"
echo "   ---------------------------"
echo "   Remove:"
echo '   const token = localStorage.getItem("token");'
echo '   if (!token) window.location.href = "login.html";'
echo ""
echo "   Add:"
echo '   authManager.requireAuth();'
echo ""

echo "3. Remove navbar setup function:"
echo "   -----------------------------"
echo "   Remove entire setupNavbar() function"
echo "   (Already handled automatically by app.js)"
echo ""

echo "4. Replace API calls:"
echo "   -----------------"
echo "   Replace:"
echo '   const res = await fetch("/api/visits", { headers: {...} });'
echo '   const data = await res.json();'
echo ""
echo "   With:"
echo '   const data = await api.getVisits();'
echo ""

echo "5. Replace notifications:"
echo "   ---------------------"
echo '   Replace: alert("Success!");'
echo '   With: notify.success("Success!");'
echo ""
echo '   Replace: alert("Error: " + message);'
echo '   With: notify.error(message);'
echo ""
echo '   Replace: confirm("Are you sure?");'
echo '   With: notify.confirm("Are you sure?", onConfirm);'
echo ""

echo "6. Add loading states:"
echo "   ------------------"
echo '   loading.show("container-id", "Loading...");'
echo '   // ... fetch data ...'
echo '   loading.hide("container-id");'
echo ""

echo "7. Replace date formatting:"
echo "   -----------------------"
echo '   Replace: new Date(date).toLocaleDateString()'
echo '   With: utils.formatDate(date)'
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Migration guide complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "See frontend/js/README.md for detailed documentation"
echo "See REFACTORING_SUMMARY.md for before/after examples"
echo ""
