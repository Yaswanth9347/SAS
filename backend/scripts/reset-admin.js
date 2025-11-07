const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const updateAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sas', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');
        
        // Reference the User collection directly
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        
        // Hash the password with bcrypt (the same way our User model does it)
        // Use password from .env or default to Admin@123
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);
        
        // Check if admin user exists
        const existingAdmin = await usersCollection.findOne({ role: 'admin' });
        
        if (existingAdmin) {
            console.log('Updating existing admin user...');
            
            // Update the admin user with new credentials
            const adminUsername = process.env.ADMIN_USERNAME || 'admin';
            const adminEmail = process.env.ADMIN_EMAIL || 'spreadasmile22@gmail.com';
            
            await usersCollection.updateOne(
                { role: 'admin' },
                { 
                    $set: {
                        name: 'Admin',
                        username: adminUsername,
                        email: adminEmail,
                        password: hashedPassword,
                        collegeId: 'ADMIN001',
                        department: 'ADMIN',
                        year: 4,
                        phone: '9999999999',
                        role: 'admin',
                        isActive: true,
                        updatedAt: new Date()
                    }
                }
            );
        } else {
            console.log('Creating new admin user...');
            
            const adminUsername = process.env.ADMIN_USERNAME || 'admin';
            const adminEmail = process.env.ADMIN_EMAIL || 'spreadasmile2025@gmail.com';
            const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
            
            // Create a new admin user
            await usersCollection.insertOne({
                name: 'Admin',
                username: adminUsername,
                email: adminEmail,
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
        }
        
        console.log('✅ Admin credentials reset successfully!');
        console.log('Username:', process.env.ADMIN_USERNAME || 'admin');
        console.log('Email:', process.env.ADMIN_EMAIL || 'spreadasmile2025@gmail.com');
        console.log('Password:', process.env.ADMIN_PASSWORD || 'Admin@123');

        // Verify admin exists
        const admin = await usersCollection.findOne({ role: 'admin' });
        console.log('Admin user found in database:', !!admin);
        console.log('Admin username:', admin.username);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
};

// Run the function
updateAdmin();