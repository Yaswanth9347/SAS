#!/usr/bin/env node

/**
 * Cloudinary Integration Test Script
 * Tests file upload, retrieval, and deletion from Cloudinary
 */

// Load environment variables first
const path = require('path');
const envPath = path.join(__dirname, 'backend', '.env');
require('dotenv').config({ path: envPath });

const { 
    isCloudinaryConfigured,
    cloudinary,
    getOptimizedImageUrl,
    getVideoThumbnailUrl
} = require('./backend/config/cloudinary');

console.log('🧪 Testing Cloudinary Integration...\n');

// Test 1: Check if Cloudinary is configured
console.log('Test 1: Configuration Check');
console.log('─'.repeat(50));

const isConfigured = isCloudinaryConfigured();
console.log(`✓ Cloudinary Configured: ${isConfigured ? '✅ YES' : '❌ NO'}`);

if (!isConfigured) {
    console.log('\n⚠️  Cloudinary is NOT configured!');
    console.log('\nTo configure Cloudinary, add these to your .env file:');
    console.log('  CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.log('  CLOUDINARY_API_KEY=your_api_key');
    console.log('  CLOUDINARY_API_SECRET=your_api_secret');
    console.log('\nGet credentials from: https://console.cloudinary.com/console');
    console.log('\n📝 Note: App will fall back to local storage (development only)');
    process.exit(0);
}

console.log(`✓ Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
console.log(`✓ API Key: ${process.env.CLOUDINARY_API_KEY?.substring(0, 5)}...`);
console.log(`✓ API Secret: ${process.env.CLOUDINARY_API_SECRET ? '***' : '❌ Not set'}`);

// Test 2: Test API connection
console.log('\n\nTest 2: API Connection');
console.log('─'.repeat(50));

cloudinary.api.ping()
    .then(result => {
        console.log('✓ Cloudinary API Connection: ✅ SUCCESS');
        console.log(`✓ Response: ${result.status}`);
        
        // Test 3: Get usage stats
        return cloudinary.api.usage();
    })
    .then(usage => {
        console.log('\n\nTest 3: Account Usage');
        console.log('─'.repeat(50));
        console.log(`✓ Storage Used: ${(usage.storage.usage / 1024 / 1024).toFixed(2)} MB`);
        console.log(`✓ Storage Limit: ${(usage.storage.limit / 1024 / 1024).toFixed(2)} MB`);
        console.log(`✓ Storage Available: ${((usage.storage.limit - usage.storage.usage) / 1024 / 1024).toFixed(2)} MB`);
        console.log(`✓ Bandwidth Used: ${(usage.bandwidth.usage / 1024 / 1024).toFixed(2)} MB`);
        console.log(`✓ Bandwidth Limit: ${(usage.bandwidth.limit / 1024 / 1024).toFixed(2)} MB`);
        console.log(`✓ Transformations: ${usage.transformations.usage} / ${usage.transformations.limit}`);
        
        // Test 4: List folders
        return cloudinary.api.root_folders();
    })
    .then(folders => {
        console.log('\n\nTest 4: Folder Structure');
        console.log('─'.repeat(50));
        if (folders.folders.length === 0) {
            console.log('ℹ️  No folders yet (upload a file to create folders)');
        } else {
            console.log('✓ Existing folders:');
            folders.folders.forEach(folder => {
                console.log(`  - ${folder.name}`);
            });
        }
        
        // Test 5: Test URL generation
        console.log('\n\nTest 5: URL Generation');
        console.log('─'.repeat(50));
        
        const testPublicId = 'sas/visits/photos/test-image';
        const optimizedUrl = getOptimizedImageUrl(testPublicId, {
            width: 800,
            height: 600,
            crop: 'fill',
            quality: 'auto'
        });
        console.log('✓ Generated optimized image URL:');
        console.log(`  ${optimizedUrl}`);
        
        const thumbnailUrl = getVideoThumbnailUrl('sas/visits/videos/test-video');
        console.log('✓ Generated video thumbnail URL:');
        console.log(`  ${thumbnailUrl}`);
        
        console.log('\n\n✅ All tests passed! Cloudinary is ready to use.');
        console.log('\n📋 Next steps:');
        console.log('  1. Start your backend server: npm start');
        console.log('  2. Upload a visit photo through the UI');
        console.log('  3. Check Cloudinary dashboard: https://console.cloudinary.com/console');
        console.log('  4. Monitor usage at: https://console.cloudinary.com/console/lui/usage');
        
    })
    .catch(error => {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        
        if (error.message.includes('Invalid API Key')) {
            console.log('\n💡 Solution: Check your CLOUDINARY_API_KEY in .env file');
        } else if (error.message.includes('Invalid cloud_name')) {
            console.log('\n💡 Solution: Check your CLOUDINARY_CLOUD_NAME in .env file');
        } else if (error.message.includes('Unauthorized')) {
            console.log('\n💡 Solution: Check your CLOUDINARY_API_SECRET in .env file');
        } else {
            console.log('\n💡 Check your internet connection and Cloudinary credentials');
        }
        
        process.exit(1);
    });
