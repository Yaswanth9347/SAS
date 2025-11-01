const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function testLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('Testing login for username: "Admin"');
        console.log('Converting to lowercase: "admin"\n');
        
        const user = await User.findOne({ username: 'Admin'.toLowerCase() }).select('+password');
        
        if (!user) {
            console.log('❌ User not found with username: "admin"\n');
            
            // Check if any users exist
            const allUsers = await User.find({});
            console.log('All users in database:', allUsers.length);
            allUsers.forEach(u => {
                console.log('  • Username:', u.username, '| Role:', u.role);
            });
        } else {
            console.log('✅ User found!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('👤 Name:', user.name);
            console.log('🔑 Username:', user.username);
            console.log('🎯 Role:', user.role);
            console.log('🔒 Has password:', !!user.password);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // Test password match
            const isMatch = await bcrypt.compare('Admin@13', user.password);
            console.log('\n🔐 Password "Admin@13" test result:', isMatch ? '✅ MATCH' : '❌ NO MATCH');
            
            if (!isMatch) {
                console.log('\n⚠️  Password does not match! Need to update it.');
            }
        }
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testLogin();
