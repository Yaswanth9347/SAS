#!/bin/bash

echo "Starting SAS Application Tests..."
echo "=================================="

# Check if MongoDB is running
if ! pgrep mongod > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first."
    exit 1
fi

echo "🧪 Running API Tests..."
npm run test:api

echo "🧪 Running Integration Tests..."
npm run test:integration

echo "🧪 Running Performance Tests..."
npm run test:performance

echo "🧪 Running Security Tests..."
npm run test:security

echo "🧪 Running Frontend Tests..."
npm run test:frontend

echo "📊 Generating Coverage Report..."
npm run test:coverage

echo "=================================="
echo "✅ All tests completed!"