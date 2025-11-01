const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Production MongoDB URI
const PRODUCTION_MONGO_URI = 'mongodb+srv://spreadasmile22_db_user:DYRtTZl0bxwXQc74@sas.qs5tfqz.mongodb.net/sas_database?retryWrites=true&w=majority&appName=SAS';

async function createProductionAdmin() {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔧 Creating Admin User in PRODUCTION Database');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('🔄 Connecting to PRODUCTION MongoDB...');
        console.log('📍 Database: sas_database (Production)\n');
        
        await mongoose.connect(PRODUCTION_MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connected to PRODUCTION MongoDB!\n');

        // Admin user details
        const adminData = {
            name: 'Administrator',
            username: 'admin',  // Lowercase (schema enforces this)
            email: 'admin@spreadasmile.org',
            password: 'Admin@13',  // Will be hashed by pre-save hook
            role: 'admin',
            collegeId: 'ADMIN001',
            department: 'Administration',
            year: 5,  // 'Others' category
            phone: '0000000000',
            isActive: true
        };

        // Check if admin already exists
        const existingByUsername = await User.findOne({ username: 'admin' });
        const existingByEmail = await User.findOne({ email: adminData.email });

        if (existingByUsername) {
            console.log('⚠️  Admin user already exists in PRODUCTION!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('👤 Name:', existingByUsername.name);
            console.log('🔑 Username:', existingByUsername.username);
            console.log('📧 Email:', existingByUsername.email);
            console.log('🎯 Role:', existingByUsername.role);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            // Update role to admin if needed
            if (existingByUsername.role !== 'admin') {
                console.log('🔄 Updating role to admin...');
                existingByUsername.role = 'admin';
                await existingByUsername.save();
                console.log('✅ Role updated!\n');
            }

            // Update password
            console.log('🔄 Updating password to: Admin@13');
            existingByUsername.password = 'Admin@13';  // Will be hashed
            await existingByUsername.save();
            console.log('✅ Password updated!\n');
        } else if (existingByEmail) {
            console.log('⚠️  User with email exists, updating...\n');
            existingByEmail.username = 'admin';
            existingByEmail.role = 'admin';
            existingByEmail.password = 'Admin@13';
            existingByEmail.name = 'Administrator';
            await existingByEmail.save();
            console.log('✅ User updated to admin!\n');
        } else {
            // Create new admin
            console.log('🔄 Creating new admin user in PRODUCTION...\n');
            const admin = await User.create(adminData);
            console.log('✅ Admin user created in PRODUCTION!\n');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ PRODUCTION ADMIN CREDENTIALS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔑 Username: Admin (or admin)');
        console.log('🔒 Password: Admin@13');
        console.log('🌐 Login at: https://sas-ozgf.onrender.com/login.html');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('✅ You can now login to production!');

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        
        if (error.code === 11000) {
            console.log('\n💡 Duplicate key error.');
            console.log('Field:', Object.keys(error.keyPattern)[0]);
        }
        
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

createProductionAdmin();
