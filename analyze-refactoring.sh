#!/bin/bash

# Quick Find-Replace Script for Common Patterns
# This helps identify what needs to be changed in each file

echo "Analyzing remaining files for refactoring patterns..."
echo "======================================================"
echo ""

FILES=(
  "visits.html"
  "teams.html"
  "visit-gallery.html"
  "schedule-visit.html"
  "visit-report.html"
  "contact.html"
  "analytics.html"
  "reports.html"
)

cd frontend

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📄 $file:"
    echo "  - Auth checks: $(grep -c "const token = localStorage.getItem" "$file" 2>/dev/null || echo "0")"
    echo "  - setupNavbar calls: $(grep -c "function setupNavbar" "$file" 2>/dev/null || echo "0")"
    echo "  - Logout handlers: $(grep -c "localStorage.removeItem('token')" "$file" 2>/dev/null || echo "0")"
    echo "  - fetch() calls: $(grep -c "await fetch(" "$file" 2>/dev/null || echo "0")"
    echo "  - alert() calls: $(grep -c "alert(" "$file" 2>/dev/null || echo "0")"
    echo "  - confirm() calls: $(grep -c "confirm(" "$file" 2>/dev/null || echo "0")"
    echo ""
  fi
done

echo "======================================================"
echo "Summary: These files need script tag additions and"
echo "         replacement of auth, navbar, API calls, and alerts"
