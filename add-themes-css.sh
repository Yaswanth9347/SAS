#!/bin/bash

# Script to add themes.css link to all HTML files in frontend directory

cd "$(dirname "$0")/frontend"

# Find all HTML files
find . -maxdepth 1 -name "*.html" -type f | while read -r file; do
    # Check if themes.css is already linked
    if grep -q "themes.css" "$file"; then
        echo "✓ $file already has themes.css"
    else
        # Find the closing </head> tag and insert before it
        if grep -q "</head>" "$file"; then
            # Create backup
            cp "$file" "$file.bak"
            
            # Insert the link tag before </head>
            sed -i 's|</head>|  <link rel="stylesheet" href="css/themes.css">\n</head>|' "$file"
            
            echo "✓ Added themes.css to $file"
        else
            echo "✗ No </head> tag found in $file"
        fi
    fi
done

echo ""
echo "Theme CSS linking complete!"
