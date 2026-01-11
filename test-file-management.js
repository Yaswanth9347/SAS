/**
 * Test File Management Features
 * Tests for file size limits, validation, compression, and bulk operations
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

// Test configuration
const TESTS = {
  fileSizeLimits: true,
  fileTypeValidation: true,
  fileCountLimits: true,
  bulkOperations: true,
  totalUploadSize: true
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createTestFile(name, sizeInBytes, type = 'image/jpeg') {
  const buffer = Buffer.alloc(sizeInBytes);
  return {
    name,
    buffer,
    type,
    size: sizeInBytes
  };
}

async function uploadFile(endpoint, files, fieldName = 'photos', token = TEST_AUTH_TOKEN) {
  const formData = new FormData();
  
  files.forEach(file => {
    formData.append(fieldName, file.buffer, {
      filename: file.name,
      contentType: file.type
    });
  });
  
  try {
    const response = await axios.post(`${API_URL}${endpoint}`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Test 1: File Size Limits
async function testFileSizeLimits() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('Test 1: File Size Limits Enforcement', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  const tests = [
    {
      name: 'Photo within limit (5MB)',
      file: createTestFile('valid-photo.jpg', 5 * 1024 * 1024, 'image/jpeg'),
      fieldName: 'photos',
      shouldPass: true
    },
    {
      name: 'Photo exceeding limit (15MB)',
      file: createTestFile('large-photo.jpg', 15 * 1024 * 1024, 'image/jpeg'),
      fieldName: 'photos',
      shouldPass: false
    },
    {
      name: 'Video within limit (50MB)',
      file: createTestFile('valid-video.mp4', 50 * 1024 * 1024, 'video/mp4'),
      fieldName: 'videos',
      shouldPass: true
    },
    {
      name: 'Video exceeding limit (150MB)',
      file: createTestFile('large-video.mp4', 150 * 1024 * 1024, 'video/mp4'),
      fieldName: 'videos',
      shouldPass: false
    },
    {
      name: 'Avatar within limit (3MB)',
      file: createTestFile('valid-avatar.jpg', 3 * 1024 * 1024, 'image/jpeg'),
      fieldName: 'avatar',
      shouldPass: true
    },
    {
      name: 'Avatar exceeding limit (7MB)',
      file: createTestFile('large-avatar.jpg', 7 * 1024 * 1024, 'image/jpeg'),
      fieldName: 'avatar',
      shouldPass: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    log(`\n  Testing: ${test.name}`, 'blue');
    const result = await uploadFile('/test/upload', [test.file], test.fieldName);
    
    const actualPass = result.success === true;
    const expectedPass = test.shouldPass;
    
    if (actualPass === expectedPass) {
      log(`  ✓ PASS: Expected ${expectedPass ? 'success' : 'failure'}, got ${actualPass ? 'success' : 'failure'}`, 'green');
      passed++;
    } else {
      log(`  ✗ FAIL: Expected ${expectedPass ? 'success' : 'failure'}, got ${actualPass ? 'success' : 'failure'}`, 'red');
      if (!result.success) {
        log(`  Error: ${JSON.stringify(result.error)}`, 'yellow');
      }
      failed++;
    }
  }
  
  log(`\n  Results: ${passed} passed, ${failed} failed`, passed === tests.length ? 'green' : 'red');
  return { passed, failed };
}

// Test 2: File Type Validation
async function testFileTypeValidation() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('Test 2: File Type Validation', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  const tests = [
    {
      name: 'Valid image type (JPEG)',
      file: createTestFile('photo.jpg', 1024 * 1024, 'image/jpeg'),
      fieldName: 'photos',
      shouldPass: true
    },
    {
      name: 'Valid image type (PNG)',
      file: createTestFile('photo.png', 1024 * 1024, 'image/png'),
      fieldName: 'photos',
      shouldPass: true
    },
    {
      name: 'Invalid image type (BMP)',
      file: createTestFile('photo.bmp', 1024 * 1024, 'image/bmp'),
      fieldName: 'photos',
      shouldPass: false
    },
    {
      name: 'Invalid type for photos (PDF)',
      file: createTestFile('document.pdf', 1024 * 1024, 'application/pdf'),
      fieldName: 'photos',
      shouldPass: false
    },
    {
      name: 'Valid video type (MP4)',
      file: createTestFile('video.mp4', 5 * 1024 * 1024, 'video/mp4'),
      fieldName: 'videos',
      shouldPass: true
    },
    {
      name: 'Invalid video type (AVI)',
      file: createTestFile('video.avi', 5 * 1024 * 1024, 'video/x-msvideo'),
      fieldName: 'videos',
      shouldPass: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    log(`\n  Testing: ${test.name}`, 'blue');
    const result = await uploadFile('/test/upload', [test.file], test.fieldName);
    
    const actualPass = result.success === true;
    const expectedPass = test.shouldPass;
    
    if (actualPass === expectedPass) {
      log(`  ✓ PASS: Expected ${expectedPass ? 'success' : 'failure'}, got ${actualPass ? 'success' : 'failure'}`, 'green');
      passed++;
    } else {
      log(`  ✗ FAIL: Expected ${expectedPass ? 'success' : 'failure'}, got ${actualPass ? 'success' : 'failure'}`, 'red');
      if (!result.success) {
        log(`  Error: ${JSON.stringify(result.error)}`, 'yellow');
      }
      failed++;
    }
  }
  
  log(`\n  Results: ${passed} passed, ${failed} failed`, passed === tests.length ? 'green' : 'red');
  return { passed, failed };
}

// Test 3: File Count Limits
async function testFileCountLimits() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('Test 3: File Count Limits', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  const tests = [
    {
      name: 'Photos within count limit (5 photos)',
      files: Array(5).fill(null).map((_, i) => 
        createTestFile(`photo-${i}.jpg`, 1024 * 1024, 'image/jpeg')
      ),
      fieldName: 'photos',
      shouldPass: true
    },
    {
      name: 'Photos exceeding count limit (15 photos)',
      files: Array(15).fill(null).map((_, i) => 
        createTestFile(`photo-${i}.jpg`, 1024 * 1024, 'image/jpeg')
      ),
      fieldName: 'photos',
      shouldPass: false
    },
    {
      name: 'Videos within count limit (2 videos)',
      files: Array(2).fill(null).map((_, i) => 
        createTestFile(`video-${i}.mp4`, 5 * 1024 * 1024, 'video/mp4')
      ),
      fieldName: 'videos',
      shouldPass: true
    },
    {
      name: 'Videos exceeding count limit (6 videos)',
      files: Array(6).fill(null).map((_, i) => 
        createTestFile(`video-${i}.mp4`, 5 * 1024 * 1024, 'video/mp4')
      ),
      fieldName: 'videos',
      shouldPass: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    log(`\n  Testing: ${test.name}`, 'blue');
    const result = await uploadFile('/test/upload', test.files, test.fieldName);
    
    const actualPass = result.success === true;
    const expectedPass = test.shouldPass;
    
    if (actualPass === expectedPass) {
      log(`  ✓ PASS: Expected ${expectedPass ? 'success' : 'failure'}, got ${actualPass ? 'success' : 'failure'}`, 'green');
      passed++;
    } else {
      log(`  ✗ FAIL: Expected ${expectedPass ? 'success' : 'failure'}, got ${actualPass ? 'success' : 'failure'}`, 'red');
      if (!result.success) {
        log(`  Error: ${JSON.stringify(result.error)}`, 'yellow');
      }
      failed++;
    }
  }
  
  log(`\n  Results: ${passed} passed, ${failed} failed`, passed === tests.length ? 'green' : 'red');
  return { passed, failed };
}

// Test 4: Total Upload Size
async function testTotalUploadSize() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('Test 4: Total Upload Size Limit', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  const tests = [
    {
      name: 'Total size within limit (100MB)',
      files: Array(10).fill(null).map((_, i) => 
        createTestFile(`photo-${i}.jpg`, 10 * 1024 * 1024, 'image/jpeg')
      ),
      fieldName: 'photos',
      shouldPass: true
    },
    {
      name: 'Total size exceeding limit (200MB)',
      files: Array(20).fill(null).map((_, i) => 
        createTestFile(`photo-${i}.jpg`, 10 * 1024 * 1024, 'image/jpeg')
      ),
      fieldName: 'photos',
      shouldPass: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    log(`\n  Testing: ${test.name}`, 'blue');
    const result = await uploadFile('/test/upload', test.files, test.fieldName);
    
    const actualPass = result.success === true;
    const expectedPass = test.shouldPass;
    
    if (actualPass === expectedPass) {
      log(`  ✓ PASS: Expected ${expectedPass ? 'success' : 'failure'}, got ${actualPass ? 'success' : 'failure'}`, 'green');
      passed++;
    } else {
      log(`  ✗ FAIL: Expected ${expectedPass ? 'success' : 'failure'}, got ${actualPass ? 'success' : 'failure'}`, 'red');
      if (!result.success) {
        log(`  Error: ${JSON.stringify(result.error)}`, 'yellow');
      }
      failed++;
    }
  }
  
  log(`\n  Results: ${passed} passed, ${failed} failed`, passed === tests.length ? 'green' : 'red');
  return { passed, failed };
}

// Main test runner
async function runTests() {
  log('\n╔═══════════════════════════════════════════════╗', 'cyan');
  log('║   File Management System - Test Suite        ║', 'cyan');
  log('╚═══════════════════════════════════════════════╝', 'cyan');
  
  if (!TEST_AUTH_TOKEN) {
    log('\n⚠ WARNING: TEST_AUTH_TOKEN not set. Some tests may fail.', 'yellow');
    log('  Set TEST_AUTH_TOKEN environment variable with a valid JWT token.\n', 'yellow');
  }
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  try {
    // Run tests based on configuration
    if (TESTS.fileSizeLimits) {
      const result = await testFileSizeLimits();
      results.passed += result.passed;
      results.failed += result.failed;
      results.total += result.passed + result.failed;
    }
    
    if (TESTS.fileTypeValidation) {
      const result = await testFileTypeValidation();
      results.passed += result.passed;
      results.failed += result.failed;
      results.total += result.passed + result.failed;
    }
    
    if (TESTS.fileCountLimits) {
      const result = await testFileCountLimits();
      results.passed += result.passed;
      results.failed += result.failed;
      results.total += result.passed + result.failed;
    }
    
    if (TESTS.totalUploadSize) {
      const result = await testTotalUploadSize();
      results.passed += result.passed;
      results.failed += result.failed;
      results.total += result.passed + result.failed;
    }
    
    // Print summary
    log('\n╔═══════════════════════════════════════════════╗', 'cyan');
    log('║              Test Summary                     ║', 'cyan');
    log('╚═══════════════════════════════════════════════╝', 'cyan');
    log(`\n  Total Tests:  ${results.total}`, 'blue');
    log(`  Passed:       ${results.passed}`, 'green');
    log(`  Failed:       ${results.failed}`, results.failed > 0 ? 'red' : 'green');
    log(`  Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%\n`, 
      results.failed === 0 ? 'green' : 'yellow');
    
    if (results.failed === 0) {
      log('✓ All tests passed!', 'green');
    } else {
      log('✗ Some tests failed. Please review the output above.', 'red');
    }
    
  } catch (error) {
    log(`\n✗ Test execution error: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run tests
if (require.main === module) {
  runTests().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  testFileSizeLimits,
  testFileTypeValidation,
  testFileCountLimits,
  testTotalUploadSize
};
