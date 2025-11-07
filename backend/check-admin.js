const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function checkAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Check for admin user
        const admin = await User.findOne({ username: 'admin' });
        
        if (admin) {
            console.log('✅ Admin user EXISTS in database');
            console.log('   Username:', admin.username);
            console.log('   Email:', admin.email);
            console.log('   Role:', admin.role);
            console.log('   Active:', admin.isActive);
        } else {
            console.log('❌ NO admin user found in database!');
            console.log('   Run: node scripts/reset-admin.js to create admin');
        }
        
        // Check all users
        const allUsers = await User.find({});
        console.log('\n📊 Total users in database:', allUsers.length);
        
        if (allUsers.length > 0) {
            console.log('\n👥 All users:');
            allUsers.forEach(user => {
                console.log(`   - ${user.username} (${user.email}) - Role: ${user.role}`);
            });
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkAdmin();
