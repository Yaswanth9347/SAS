const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../models/User');

async function createAdminUser() {
    try {
        // Connect to production MongoDB
        const mongoUri = process.env.MONGODB_URI;
        
        if (!mongoUri) {
            console.error('❌ MONGODB_URI not found in environment variables');
            console.log('💡 Make sure .env file exists with MONGODB_URI');
            process.exit(1);
        }

        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB successfully!\n');

        // Admin user details
        const adminData = {
            name: 'Administrator',
            username: 'Admin',  // Username as requested
            email: 'admin@spreadasmile.org',  // Required field
            password: 'Admin@13',  // Will be hashed automatically by pre-save hook
            role: 'admin',
            collegeId: 'ADMIN001',  // Required field
            department: 'Administration',  // Required field
            year: 5,  // 'Others' category (no validation required)
            phone: '0000000000',  // Required field
            isActive: true
        };

        // Check if admin already exists (by username or email)
        const existingByUsername = await User.findOne({ username: adminData.username });
        const existingByEmail = await User.findOne({ email: adminData.email });

        if (existingByUsername) {
            console.log('⚠️  User with username "Admin" already exists!');
            console.log('📊 Existing user details:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('👤 Name:', existingByUsername.name);
            console.log('🔑 Username:', existingByUsername.username);
            console.log('📧 Email:', existingByUsername.email);
            console.log('🎯 Role:', existingByUsername.role);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            // Update to admin role if not already
            if (existingByUsername.role !== 'admin') {
                console.log('🔄 Updating user role to admin...');
                existingByUsername.role = 'admin';
                await existingByUsername.save();
                console.log('✅ User role updated to admin!\n');
            }

            // Update password
            console.log('🔄 Updating password to: Admin@13');
            existingByUsername.password = 'Admin@13';  // Will be hashed by pre-save hook
            await existingByUsername.save();
            console.log('✅ Password updated successfully!\n');
            
            console.log('✅ Admin user is ready!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔑 Username: Admin');
            console.log('🔒 Password: Admin@13');
            console.log('🌐 Login at: https://sas-ozgf.onrender.com/login.html');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            await mongoose.connection.close();
            process.exit(0);
        }

        if (existingByEmail) {
            console.log('⚠️  User with email already exists but different username');
            console.log('Updating existing user...\n');
            
            existingByEmail.username = adminData.username;
            existingByEmail.role = 'admin';
            existingByEmail.password = 'Admin@13';  // Will be hashed
            existingByEmail.name = adminData.name;
            await existingByEmail.save();
            
            console.log('✅ Existing user updated to admin!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔑 Username: Admin');
            console.log('🔒 Password: Admin@13');
            console.log('🌐 Login at: https://sas-ozgf.onrender.com/login.html');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            await mongoose.connection.close();
            process.exit(0);
        }

        // Create new admin user
        console.log('🔄 Creating new admin user...\n');
        const admin = await User.create(adminData);

        console.log('🎉 Admin user created successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ ADMIN USER CREDENTIALS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👤 Name:', admin.name);
        console.log('🔑 Username:', admin.username);
        console.log('🔒 Password: Admin@13');
        console.log('📧 Email:', admin.email);
        console.log('🎯 Role:', admin.role);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n🌐 Login URL: https://sas-ozgf.onrender.com/login.html');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        
        if (error.code === 11000) {
            console.log('\n💡 Duplicate key error. User might already exist.');
            console.log('Field causing conflict:', Object.keys(error.keyPattern)[0]);
        }
        
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run the script
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 SAS Admin User Creation Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

createAdminUser();
