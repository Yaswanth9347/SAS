/**
 * Test Script for School Management Features
 * 
 * Run with: node test-school-management.js
 * Make sure to set JWT_TOKEN environment variable
 */

const baseURL = process.env.API_URL || 'http://localhost:5000/api';
const token = process.env.JWT_TOKEN;

if (!token) {
    console.error('❌ Please set JWT_TOKEN environment variable');
    console.log('Example: JWT_TOKEN="your-token" node test-school-management.js');
    process.exit(1);
}

const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

let createdSchoolId = null;
let contactPersonId = null;
let contactHistoryId = null;
let ratingId = null;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  School Management System Test Suite                  ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function makeRequest(method, endpoint, data = null) {
    const url = `${baseURL}${endpoint}`;
    const options = {
        method,
        headers,
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Request failed');
        }
        
        return result;
    } catch (error) {
        console.error(`❌ ${method} ${endpoint} failed:`, error.message);
        throw error;
    }
}

async function runTests() {
    try {
        // Test 1: Create School
        console.log('📋 Test 1: Create School');
        console.log('─────────────────────────────────────────');
        const schoolData = {
            name: "Test School " + Date.now(),
            address: {
                street: "123 Test Street",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001"
            },
            totalClasses: 30,
            availableClasses: 30,
            grades: ["1", "2", "3", "4", "5"],
            notes: "Test school for automated testing"
        };
        
        const createResult = await makeRequest('POST', '/schools', schoolData);
        createdSchoolId = createResult.data._id;
        console.log('✅ School created:', createdSchoolId);
        console.log('   Name:', createResult.data.name);
        console.log('');
        
        // Test 2: Add Contact Person
        console.log('📋 Test 2: Add Contact Person');
        console.log('─────────────────────────────────────────');
        const contactData = {
            name: "Test Principal",
            position: "Principal",
            phone: "+919876543210",
            email: "principal@testschool.com",
            isPrimary: true,
            notes: "Available Mon-Fri 9 AM - 5 PM"
        };
        
        const contactResult = await makeRequest('POST', `/schools/${createdSchoolId}/contacts`, contactData);
        contactPersonId = contactResult.data.contactPersons[0]._id;
        console.log('✅ Contact person added:', contactPersonId);
        console.log('   Name:', contactData.name);
        console.log('   Position:', contactData.position);
        console.log('');
        
        // Test 3: Add Contact History
        console.log('📋 Test 3: Add Contact History');
        console.log('─────────────────────────────────────────');
        const historyData = {
            type: "call",
            contactPerson: "Test Principal",
            subject: "Initial Contact",
            notes: "Discussed potential visit dates for March",
            outcome: "successful",
            followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            followUpCompleted: false
        };
        
        const historyResult = await makeRequest('POST', `/schools/${createdSchoolId}/contact-history`, historyData);
        contactHistoryId = historyResult.data.contactHistory[historyResult.data.contactHistory.length - 1]._id;
        console.log('✅ Contact history added:', contactHistoryId);
        console.log('   Type:', historyData.type);
        console.log('   Outcome:', historyData.outcome);
        console.log('');
        
        // Test 4: Add Rating
        console.log('📋 Test 4: Add School Rating');
        console.log('─────────────────────────────────────────');
        const ratingData = {
            cooperation: 5,
            facilities: 4,
            studentEngagement: 5,
            overallExperience: 5,
            positives: "Excellent cooperation from staff",
            improvements: "Could improve audiovisual equipment",
            generalComments: "Great school for visits",
            wouldRecommend: true
        };
        
        const ratingResult = await makeRequest('POST', `/schools/${createdSchoolId}/ratings`, ratingData);
        ratingId = ratingResult.data.ratings[ratingResult.data.ratings.length - 1]._id;
        console.log('✅ Rating added:', ratingId);
        console.log('   Average rating:', ratingResult.data.stats.averageRating);
        console.log('');
        
        // Test 5: Update Availability
        console.log('📋 Test 5: Update School Availability');
        console.log('─────────────────────────────────────────');
        const availabilityData = {
            preferredDays: ["monday", "wednesday", "friday"],
            preferredTimeSlots: ["morning", "afternoon"],
            unavailableDates: [{
                startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
                reason: "Spring break"
            }],
            maxVisitsPerMonth: 2,
            advanceNoticeDays: 7,
            specialInstructions: "Please call 24 hours in advance"
        };
        
        const availResult = await makeRequest('PUT', `/schools/${createdSchoolId}/availability`, availabilityData);
        console.log('✅ Availability updated');
        console.log('   Preferred days:', availabilityData.preferredDays.join(', '));
        console.log('   Max visits/month:', availabilityData.maxVisitsPerMonth);
        console.log('');
        
        // Test 6: Check Availability
        console.log('📋 Test 6: Check School Availability');
        console.log('─────────────────────────────────────────');
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() + 10);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const availCheckResult = await makeRequest('GET', `/schools/${createdSchoolId}/check-availability?date=${dateStr}`);
        console.log('✅ Availability checked for:', dateStr);
        console.log('   Available:', availCheckResult.data.available);
        if (!availCheckResult.data.available) {
            console.log('   Reason:', availCheckResult.data.reason);
        }
        console.log('');
        
        // Test 7: Get Follow-ups
        console.log('📋 Test 7: Get Pending Follow-ups');
        console.log('─────────────────────────────────────────');
        const followUpsResult = await makeRequest('GET', `/schools/${createdSchoolId}/follow-ups`);
        console.log('✅ Follow-ups retrieved');
        console.log('   Count:', followUpsResult.count);
        console.log('');
        
        // Test 8: Get Statistics
        console.log('📋 Test 8: Get School Statistics');
        console.log('─────────────────────────────────────────');
        const statsResult = await makeRequest('GET', `/schools/${createdSchoolId}/stats`);
        console.log('✅ Statistics retrieved');
        console.log('   Total visits:', statsResult.data.visits.total);
        console.log('   Ratings count:', statsResult.data.ratings.count);
        console.log('   Contact history entries:', statsResult.data.contactHistory.total);
        console.log('   Average rating:', statsResult.data.ratings.average);
        console.log('');
        
        // Test 9: Get All Schools with Filters
        console.log('📋 Test 9: Get Schools with Filters');
        console.log('─────────────────────────────────────────');
        const schoolsResult = await makeRequest('GET', '/schools?city=Mumbai&hasAvailability=true');
        console.log('✅ Schools retrieved with filters');
        console.log('   Count:', schoolsResult.count);
        console.log('');
        
        // Test 10: Update Contact History (mark follow-up complete)
        console.log('📋 Test 10: Update Contact History');
        console.log('─────────────────────────────────────────');
        const updateHistoryData = {
            followUpCompleted: true,
            notes: "Follow-up completed successfully - visit scheduled"
        };
        
        await makeRequest('PUT', `/schools/${createdSchoolId}/contact-history/${contactHistoryId}`, updateHistoryData);
        console.log('✅ Contact history updated');
        console.log('   Follow-up marked as complete');
        console.log('');
        
        // Cleanup: Delete test school
        console.log('📋 Cleanup: Deleting Test School');
        console.log('─────────────────────────────────────────');
        await makeRequest('DELETE', `/schools/${createdSchoolId}`);
        console.log('✅ Test school deleted (soft delete)');
        console.log('');
        
        // Success Summary
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  ✅ All Tests Passed!                                   ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('Tests completed:');
        console.log('  ✅ Create school');
        console.log('  ✅ Add contact person');
        console.log('  ✅ Add contact history');
        console.log('  ✅ Add rating');
        console.log('  ✅ Update availability');
        console.log('  ✅ Check availability');
        console.log('  ✅ Get follow-ups');
        console.log('  ✅ Get statistics');
        console.log('  ✅ Filter schools');
        console.log('  ✅ Update contact history');
        console.log('  ✅ Delete school');
        console.log('');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
        
        // Attempt cleanup
        if (createdSchoolId) {
            try {
                console.log('\nAttempting cleanup...');
                await makeRequest('DELETE', `/schools/${createdSchoolId}`);
                console.log('✅ Cleanup successful');
            } catch (cleanupError) {
                console.error('❌ Cleanup failed:', cleanupError.message);
            }
        }
        
        process.exit(1);
    }
}

// Run tests
console.log('Starting School Management tests...');
console.log('API URL:', baseURL);
console.log('');

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
    console.error('❌ This script requires Node.js 18+ with native fetch support');
    console.log('Or install node-fetch: npm install node-fetch@2');
    process.exit(1);
}

runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
