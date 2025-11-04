/**
 * Test Report Generation
 * Simple test script to verify PDF generation works
 */

const reportGenerator = require('./services/reportGenerator');
const path = require('path');

// Sample test data matching new format
const sampleData = {
    totalVisits: 8,
    totalSchools: 3,
    totalTeams: 3,
    totalStudents: 890,
    
    // Visit details with date, team, school, count
    visits: [
        {
            date: new Date('2024-10-05'),
            school: { name: 'Green Valley High School' },
            team: { name: 'Team Sunshine' },
            studentsCount: 150
        },
        {
            date: new Date('2024-10-12'),
            school: { name: 'Riverside Elementary School' },
            team: { name: 'Team Hope' },
            studentsCount: 200
        },
        {
            date: new Date('2024-10-18'),
            school: { name: 'St. Mary\'s Convent School' },
            team: { name: 'Team Inspire' },
            studentsCount: 180
        },
        {
            date: new Date('2024-10-25'),
            school: { name: 'Green Valley High School' },
            team: { name: 'Team Sunshine' },
            studentsCount: 160
        },
        {
            date: new Date('2024-10-28'),
            school: { name: 'Riverside Elementary School' },
            team: { name: 'Team Hope' },
            studentsCount: 200
        }
    ],
    
    // School details with topics covered
    schoolDetails: [
        {
            name: 'Green Valley High School',
            visits: [
                {
                    date: new Date('2024-10-05'),
                    topics: 'Career Guidance, Goal Setting, Time Management',
                    team: 'Team Sunshine'
                },
                {
                    date: new Date('2024-10-25'),
                    topics: 'Communication Skills, Teamwork, Leadership Development',
                    team: 'Team Sunshine'
                }
            ]
        },
        {
            name: 'Riverside Elementary School',
            visits: [
                {
                    date: new Date('2024-10-12'),
                    topics: 'Basic Hygiene, Health Awareness, Nutrition Education',
                    team: 'Team Hope'
                },
                {
                    date: new Date('2024-10-28'),
                    topics: 'Environmental Awareness, Waste Management, Recycling',
                    team: 'Team Hope'
                }
            ]
        },
        {
            name: 'St. Mary\'s Convent School',
            visits: [
                {
                    date: new Date('2024-10-18'),
                    topics: 'Art & Craft Activities, Creative Thinking, Self Expression',
                    team: 'Team Inspire'
                }
            ]
        }
    ],
    
    // Complete school information
    schools: [
        {
            name: 'Green Valley High School',
            address: '123 Education Lane, Green Valley District',
            location: 'Green Valley',
            headmaster: 'Dr. Rajesh Kumar',
            principalName: 'Dr. Rajesh Kumar',
            phone: '+91 98765 43210',
            contactNumber: '+91 98765 43210'
        },
        {
            name: 'Riverside Elementary School',
            address: '456 River Road, Riverside Area',
            location: 'Riverside',
            headmaster: 'Mrs. Priya Sharma',
            principalName: 'Mrs. Priya Sharma',
            phone: '+91 98765 43211',
            contactNumber: '+91 98765 43211'
        },
        {
            name: 'St. Mary\'s Convent School',
            address: '789 Church Street, Downtown',
            location: 'Downtown',
            headmaster: 'Sister Maria Joseph',
            principalName: 'Sister Maria Joseph',
            phone: '+91 98765 43212',
            contactNumber: '+91 98765 43212'
        }
    ],
    
    // Teams with members
    teams: [
        {
            name: 'Team Sunshine',
            members: [
                { name: 'Amit Verma' },
                { name: 'Sneha Patel' },
                { name: 'Rahul Singh' },
                { name: 'Pooja Reddy' },
                { name: 'Vikram Joshi' }
            ]
        },
        {
            name: 'Team Hope',
            members: [
                { name: 'Neha Gupta' },
                { name: 'Arjun Mehta' },
                { name: 'Kavya Iyer' },
                { name: 'Rohit Sharma' }
            ]
        },
        {
            name: 'Team Inspire',
            members: [
                { name: 'Divya Krishnan' },
                { name: 'Aditya Kumar' },
                { name: 'Anjali Desai' },
                { name: 'Sanjay Nair' },
                { name: 'Meera Kapoor' },
                { name: 'Karthik Menon' }
            ]
        }
    ],
    
    // Other activities (optional)
    otherActivities: [
        {
            date: new Date('2024-10-12'),
            school: 'Riverside Elementary School',
            team: 'Team Hope',
            description: 'Conducted a health check-up camp with local doctors. Distributed free medicines and health supplements to 50 underprivileged students.'
        },
        {
            date: new Date('2024-10-18'),
            school: 'St. Mary\'s Convent School',
            team: 'Team Inspire',
            description: 'Organized a drawing competition for students. Winners were awarded certificates and art supplies. Total 80 students participated.'
        }
    ]
};

// Test configuration
const testConfig = {
    title: 'Test SAS Report',
    subtitle: 'October 2024 Summary',
    template: 'visit-summary',
    dateRange: {
        start: '2024-10-01',
        end: '2024-10-31'
    },
    sections: {
        summary: true,
        visitDetails: true,
        schoolBreakdown: true,
        teamPerformance: true
    },
    notes: 'This is a test report generated to verify the PDF generation system works correctly.',
    data: sampleData
};

async function runTest() {
    console.log('\n🧪 ========================================');
    console.log('   TESTING REPORT GENERATION SYSTEM');
    console.log('========================================\n');

    try {
        console.log('📋 Test Configuration:');
        console.log('   Title:', testConfig.title);
        console.log('   Template:', testConfig.template);
        console.log('   Sections:', Object.keys(testConfig.sections).filter(k => testConfig.sections[k]).join(', '));
        console.log('   Date Range:', `${testConfig.dateRange.start} to ${testConfig.dateRange.end}`);
        console.log('');

        // Generate report
        console.log('🔄 Generating test report...\n');
        const startTime = Date.now();

        const outputPath = path.join(__dirname, 'test-report.pdf');
        await reportGenerator.generateAndSave(testConfig, outputPath);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n✅ ========================================');
        console.log('   TEST SUCCESSFUL!');
        console.log('========================================');
        console.log(`   ⏱️  Generation time: ${duration}s`);
        console.log(`   📁 Report saved: ${outputPath}`);
        console.log('   🎉 PDF generation system is working correctly!');
        console.log('========================================\n');

        // Close browser
        await reportGenerator.closeBrowser();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ========================================');
        console.error('   TEST FAILED!');
        console.error('========================================');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);
        console.error('========================================\n');

        await reportGenerator.closeBrowser();
        process.exit(1);
    }
}

// Run the test
runTest();
