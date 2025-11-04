/**
 * Test Report Validation - Issue 3 and Issue 4
 * 
 * This script tests the validation for:
 * - Issue 3: Empty or Malformed Sections Object
 * - Issue 4: Invalid Template Name
 */

const reportGenerator = require('./report/services/reportGenerator');

console.log('='.repeat(70));
console.log('Testing Report Configuration Validation (Issue 3 & 4)');
console.log('='.repeat(70));
console.log();

// Test cases
const testCases = [
    {
        name: 'Test 1: Valid Configuration (Should PASS)',
        config: {
            title: 'Monthly Report',
            template: 'visit-summary',
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: {
                summary: true,
                visitDetails: true,
                topicsCovered: true,
                schoolInfo: false,
                teamInfo: true,
                otherActivities: false
            }
        }
    },
    {
        name: 'Test 2: Issue 4 - Invalid Template Name',
        config: {
            title: 'Monthly Report',
            template: 'invalid-template',  // ❌ Invalid template
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: {
                summary: true,
                visitDetails: true
            }
        }
    },
    {
        name: 'Test 3: Issue 4 - Typo in Template Name',
        config: {
            title: 'Monthly Report',
            template: 'visit-sumary',  // ❌ Typo: "sumary" instead of "summary"
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: {
                summary: true
            }
        }
    },
    {
        name: 'Test 4: Issue 4 - Missing Template',
        config: {
            title: 'Monthly Report',
            // ❌ template: undefined
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: {
                summary: true
            }
        }
    },
    {
        name: 'Test 5: Issue 3 - All Sections Disabled',
        config: {
            title: 'Monthly Report',
            template: 'visit-summary',
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: {
                summary: false,          // ❌ All sections are false
                visitDetails: false,
                topicsCovered: false,
                schoolInfo: false,
                teamInfo: false,
                otherActivities: false
            }
        }
    },
    {
        name: 'Test 6: Issue 3 - Missing Sections Object',
        config: {
            title: 'Monthly Report',
            template: 'visit-summary',
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            }
            // ❌ sections: undefined
        }
    },
    {
        name: 'Test 7: Issue 3 - Invalid Section Names',
        config: {
            title: 'Monthly Report',
            template: 'visit-summary',
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: {
                summary: true,
                invalidSection: true,        // ❌ Invalid section name
                anotherWrongSection: true    // ❌ Invalid section name
            }
        }
    },
    {
        name: 'Test 8: Issue 3 - Sections is Not an Object',
        config: {
            title: 'Monthly Report',
            template: 'visit-summary',
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: 'summary,visitDetails'  // ❌ String instead of object
        }
    },
    {
        name: 'Test 9: Combined - Multiple Issues',
        config: {
            title: 'Monthly Report',
            template: 'wrong-template',  // ❌ Invalid template
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: {
                summary: false,          // ❌ All disabled
                visitDetails: false
            }
        }
    },
    {
        name: 'Test 10: Valid with Minimal Sections',
        config: {
            title: 'Minimal Report',
            template: 'executive',
            dateRange: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            sections: {
                summary: true  // ✅ At least one enabled
            }
        }
    }
];

// Run tests
testCases.forEach((test, index) => {
    console.log(`\n${index + 1}. ${test.name}`);
    console.log('-'.repeat(70));
    
    const validation = reportGenerator.validateConfig(test.config);
    
    if (validation.valid) {
        console.log('✅ Result: VALID');
    } else {
        console.log('❌ Result: INVALID');
        console.log('   Errors:');
        validation.errors.forEach((error, i) => {
            console.log(`   ${i + 1}) ${error}`);
        });
    }
});

console.log('\n' + '='.repeat(70));
console.log('Validation Testing Complete');
console.log('='.repeat(70));
console.log();
console.log('Summary:');
console.log('✅ Valid templates: visit-summary, executive, detailed');
console.log('✅ Valid sections: summary, visitDetails, topicsCovered, schoolInfo, teamInfo, otherActivities');
console.log('❌ At least ONE section must be enabled (cannot all be false)');
console.log('❌ Template name must be valid (no typos, must exist)');
console.log();
