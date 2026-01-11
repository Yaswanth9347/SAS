/**
 * Test Script for Cloudinary File Deletion
 * 
 * This script tests the Cloudinary deletion functionality
 * Run with: node test-cloudinary-deletion.js
 */

const { 
    extractPublicId, 
    getResourceType,
    deleteFromCloudinary,
    batchDeleteFromCloudinary,
    isCloudinaryConfigured 
} = require('./backend/config/cloudinary');

// Test URLs
const testUrls = {
    image: 'https://res.cloudinary.com/dfgdlphv8/image/upload/v1234567890/sas/visits/photos/abc123/photo-test-1234.jpg',
    video: 'https://res.cloudinary.com/dfgdlphv8/video/upload/v1234567890/sas/visits/videos/abc123/video-test-1234.mp4',
    doc: 'https://res.cloudinary.com/dfgdlphv8/raw/upload/v1234567890/sas/visits/docs/abc123/doc-test-1234.pdf',
    imageNoVersion: 'https://res.cloudinary.com/dfgdlphv8/image/upload/sas/visits/photos/abc123/photo.jpg',
    local: '/uploads/photos/abc123/local-photo.jpg'
};

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Cloudinary File Deletion Test Suite                  ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Test 1: Check Cloudinary Configuration
console.log('📋 Test 1: Check Cloudinary Configuration');
console.log('─────────────────────────────────────────');
const isConfigured = isCloudinaryConfigured();
console.log(`Cloudinary Configured: ${isConfigured ? '✅ YES' : '❌ NO'}`);
if (isConfigured) {
    console.log('✅ Test 1 PASSED\n');
} else {
    console.log('⚠️  Warning: Cloudinary not configured. Set CLOUDINARY_* env vars.\n');
}

// Test 2: Extract Public IDs
console.log('📋 Test 2: Extract Public IDs from URLs');
console.log('─────────────────────────────────────────');
Object.entries(testUrls).forEach(([type, url]) => {
    const publicId = extractPublicId(url);
    console.log(`${type}:`);
    console.log(`  URL: ${url}`);
    console.log(`  Public ID: ${publicId || 'null'}`);
    console.log(`  Status: ${publicId ? '✅ EXTRACTED' : '❌ FAILED'}\n`);
});

// Test 3: Detect Resource Types
console.log('📋 Test 3: Detect Resource Types');
console.log('─────────────────────────────────────────');
Object.entries(testUrls).forEach(([type, url]) => {
    const resourceType = getResourceType(url);
    console.log(`${type}:`);
    console.log(`  URL: ${url}`);
    console.log(`  Resource Type: ${resourceType}`);
    
    // Validate expected types
    let expectedType = 'image';
    if (type === 'video') expectedType = 'video';
    if (type === 'doc') expectedType = 'raw';
    
    const isCorrect = resourceType === expectedType || type === 'local';
    console.log(`  Status: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}\n`);
});

// Test 4: URL Pattern Detection
console.log('📋 Test 4: URL Pattern Detection');
console.log('─────────────────────────────────────────');
Object.entries(testUrls).forEach(([type, url]) => {
    const isCloudinary = url.includes('cloudinary.com');
    const isLocal = url.startsWith('/uploads/');
    console.log(`${type}:`);
    console.log(`  URL: ${url}`);
    console.log(`  Is Cloudinary: ${isCloudinary ? '✅ YES' : '❌ NO'}`);
    console.log(`  Is Local: ${isLocal ? '✅ YES' : '❌ NO'}\n`);
});

// Test 5: Simulate Deletion Logic (Dry Run)
console.log('📋 Test 5: Simulate Deletion Logic (Dry Run)');
console.log('─────────────────────────────────────────');
Object.entries(testUrls).forEach(([type, url]) => {
    console.log(`${type}:`);
    
    if (url.includes('cloudinary.com')) {
        const publicId = extractPublicId(url);
        const resourceType = getResourceType(url);
        
        if (publicId) {
            console.log(`  ✅ Would call: deleteFromCloudinary('${publicId}', '${resourceType}')`);
        } else {
            console.log(`  ❌ Cannot delete: Failed to extract public ID`);
        }
    } else {
        console.log(`  ✅ Would delete local file: ${url}`);
    }
    console.log('');
});

// Test 6: Test File Metadata Detection
console.log('📋 Test 6: Test File Metadata Detection');
console.log('─────────────────────────────────────────');

const testMetadata = [
    {
        name: 'Cloudinary with publicId',
        metadata: {
            path: testUrls.image,
            cloudinaryPublicId: 'sas/visits/photos/abc123/photo-test-1234',
            storageType: 'cloud'
        }
    },
    {
        name: 'Cloudinary URL only',
        metadata: {
            path: testUrls.video,
            cloudUrl: testUrls.video
        }
    },
    {
        name: 'Local file',
        metadata: {
            path: testUrls.local,
            storageType: 'local'
        }
    },
    {
        name: 'Multer Cloudinary upload',
        metadata: {
            path: testUrls.image,
            public_id: 'sas/visits/photos/abc123/photo-test-1234',
            resource_type: 'image',
            format: 'jpg'
        }
    }
];

testMetadata.forEach(({ name, metadata }) => {
    console.log(`${name}:`);
    
    const isCloudinaryFile = 
        (metadata.storageType === 'cloud') || 
        (metadata.cloudinaryPublicId) ||
        (metadata.path && metadata.path.includes('cloudinary.com')) ||
        (metadata.cloudUrl);
    
    let publicId = metadata.cloudinaryPublicId || 
                   metadata.public_id || 
                   (isCloudinaryFile ? extractPublicId(metadata.path || metadata.cloudUrl) : null);
    
    console.log(`  Is Cloudinary: ${isCloudinaryFile ? '✅ YES' : '❌ NO'}`);
    console.log(`  Public ID: ${publicId || 'N/A'}`);
    console.log(`  Can Delete: ${(isCloudinaryFile && publicId) || !isCloudinaryFile ? '✅ YES' : '❌ NO'}\n`);
});

// Summary
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Test Summary                                          ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('');
console.log('✅ All detection and extraction tests completed');
console.log('');
console.log('⚠️  NOTE: This is a dry run. No actual deletions performed.');
console.log('');
console.log('To test actual deletion:');
console.log('1. Ensure Cloudinary credentials are set in .env');
console.log('2. Upload a test file to Cloudinary');
console.log('3. Use the API endpoints to delete it');
console.log('4. Check Cloudinary dashboard to verify deletion');
console.log('');
console.log('API Endpoints:');
console.log('  DELETE /api/visits/:id/media - Delete single media');
console.log('  DELETE /api/visits/:id - Delete entire visit with all media');
console.log('  POST /api/auth/profile/avatar - Upload avatar (deletes old)');
console.log('');

// Optional: Test actual deletion if configured and CLI argument provided
if (process.argv.includes('--delete-test')) {
    console.log('⚠️  WARNING: --delete-test flag detected!');
    console.log('This will attempt actual deletion from Cloudinary.');
    console.log('');
    
    if (!isConfigured) {
        console.log('❌ Cannot test deletion: Cloudinary not configured');
        process.exit(1);
    }
    
    // You can add actual deletion tests here if needed
    console.log('📝 To implement actual deletion tests:');
    console.log('1. Create test file in Cloudinary');
    console.log('2. Get its public ID');
    console.log('3. Call deleteFromCloudinary()');
    console.log('4. Verify result');
    console.log('');
    console.log('Example:');
    console.log(`
    const testPublicId = 'test/sample-file';
    const result = await deleteFromCloudinary(testPublicId, 'image');
    console.log('Deletion result:', result);
    `);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Test suite completed!');
console.log('═══════════════════════════════════════════════════════════\n');
