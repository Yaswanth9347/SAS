#!/bin/bash

# Mobile Access Testing Script
# This script helps test and verify network accessibility

echo "=================================="
echo "SAS Mobile Access Testing"
echo "=================================="
echo ""

# Get network IP
NETWORK_IP=$(ip addr show | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}' | cut -d'/' -f1)
echo "📱 Your Network IP: $NETWORK_IP"
echo ""

# Check if server is running
if lsof -Pi :5001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Server is running on port 5001"
    
    # Test localhost
    echo ""
    echo "🧪 Testing localhost connection..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/health | grep -q "200"; then
        echo "✅ Localhost connection: SUCCESS"
    else
        echo "❌ Localhost connection: FAILED"
    fi
    
    # Test network IP
    echo ""
    echo "🧪 Testing network IP connection..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$NETWORK_IP:5001/api/health)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Network IP connection: SUCCESS (HTTP $HTTP_CODE)"
        echo ""
        echo "🎉 Your server is accessible on the network!"
        echo "📱 Access from mobile/tablet: http://$NETWORK_IP:5001"
    else
        echo "❌ Network IP connection: FAILED (HTTP $HTTP_CODE)"
        echo ""
        echo "⚠️  Possible issues:"
        echo "   1. Firewall blocking port 5001"
        echo "   2. Server not binding to 0.0.0.0"
        echo "   3. Network configuration issue"
    fi
    
else
    echo "❌ Server is NOT running on port 5001"
    echo ""
    echo "▶️  To start the server:"
    echo "   cd /home/yaswanth/Desktop/Projects/Main/SAS/backend"
    echo "   npm run dev"
fi

echo ""
echo "=================================="
echo "Firewall Status:"
echo "=================================="
sudo ufw status 2>/dev/null || echo "Firewall: inactive or ufw not installed"

echo ""
echo "=================================="
echo "Listening Ports:"
echo "=================================="
ss -tulpn 2>/dev/null | grep :5001 || echo "Port 5001: Not listening"

echo ""
echo "=================================="
echo "Quick Test from Another Terminal:"
echo "=================================="
echo "curl http://$NETWORK_IP:5001/api/health"
echo ""
