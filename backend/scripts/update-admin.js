const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const updateAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sas', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('🔍 Finding admin user...');

        // Generate properly hashed password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Admin@13', salt);

        // Check if any admin exists
        const adminExists = await User.findOne({ role: 'admin' });
        
        if (!adminExists) {
            console.log('No admin found. Creating new admin user...');
            
            // Create new admin using direct method to avoid double hashing
            const result = await User.collection.insertOne({
                name: 'Admin',
                username: 'admin', // lowercase to match schema
                email: 'admin@sas.org',
                password: hashedPassword,
                collegeId: 'ADMIN001',
                department: 'ADMIN',
                year: 4,
                phone: '9999999999',
                role: 'admin',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            console.log('Admin created with ID:', result.insertedId);
        } else {
            console.log('Admin found. Updating credentials...');
            
            // Update directly using updateOne to bypass mongoose hooks
            await User.updateOne(
                { role: 'admin' },
                { 
                    $set: {
                        name: 'Admin',
                        username: 'admin', // lowercase to match schema
                        password: hashedPassword,
                        updatedAt: new Date()
                    }
                }
            );
        }

        console.log('✅ Admin credentials updated successfully!');
        console.log('Username: Admin');
        console.log('Password: Admin@13');

        console.log('✅ Admin credentials updated successfully!');
        console.log('Username: Admin');
        console.log('Password: Admin@13');
    } catch (error) {
        console.error('Error updating admin:', error);
    } finally {
        mongoose.disconnect();
    }
};

updateAdmin();