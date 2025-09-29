const mongoose = require('mongoose');
const User = require('../models/User');
const School = require('../models/School');

const seedTestData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI_TEST, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('🌱 Seeding test data...');

        // Clear existing data
        await User.deleteMany({});
        await School.deleteMany({});

        // Create test admin user
        const adminUser = await User.create({
            name: 'Test Admin',
            email: 'admin@sas.org',
            password: 'admin123',
            collegeId: 'ADMIN001',
            department: 'ADMIN',
            year: 4,
            phone: '9999999999',
            role: 'admin'
        });

        // Create test volunteer user
        const volunteerUser = await User.create({
            name: 'Test Volunteer',
            email: 'volunteer@college.edu',
            password: '123456',
            collegeId: 'VOL001',
            department: 'CSE',
            year: 2,
            phone: '8888888888'
        });

        // Create test schools
        const schools = await School.create([
            {
                name: 'Government High School, Test City',
                address: {
                    street: '123 School Street',
                    city: 'Test City',
                    state: 'Test State',
                    pincode: '500001'
                },
                contactPerson: {
                    name: 'Principal Sharma',
                    position: 'Principal',
                    phone: '7777777777',
                    email: 'principal@ghs.edu'
                },
                totalClasses: 12,
                availableClasses: 12,
                grades: ['6', '7', '8', '9', '10']
            },
            {
                name: 'Sarvodaya School, Test Town',
                address: {
                    street: '456 Education Road',
                    city: 'Test Town',
                    state: 'Test State',
                    pincode: '500002'
                },
                contactPerson: {
                    name: 'Principal Gupta',
                    position: 'Principal',
                    phone: '6666666666',
                    email: 'principal@sarvodaya.edu'
                },
                totalClasses: 8,
                availableClasses: 8,
                grades: ['1', '2', '3', '4', '5']
            }
        ]);

        console.log('✅ Test data seeded successfully!');
        console.log(`👥 Users created: 2 (admin + volunteer)`);
        console.log(`🏫 Schools created: ${schools.length}`);
        console.log('');
        console.log('🔑 Test Credentials:');
        console.log('   Admin: admin@sas.org / admin123');
        console.log('   Volunteer: volunteer@college.edu / 123456');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding test data:', error);
        process.exit(1);
    }
};

// Run if called directly
if (require.main === module) {
    // Load test environment
    require('dotenv').config({ path: './.env.test' });
    seedTestData();
}

module.exports = seedTestData;