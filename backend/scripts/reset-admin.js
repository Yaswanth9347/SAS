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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Admin@13', salt);
        
        // Check if admin user exists
        const existingAdmin = await usersCollection.findOne({ role: 'admin' });
        
        if (existingAdmin) {
            console.log('Updating existing admin user...');
            
            // Update the admin user with new credentials
            await usersCollection.updateOne(
                { role: 'admin' },
                { 
                    $set: {
                        name: 'Admin',
                        username: 'admin',
                        email: 'admin@sas.org',
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
            
            // Create a new admin user
            await usersCollection.insertOne({
                name: 'Admin',
                username: 'admin',
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
        }
        
        console.log('✅ Admin credentials reset successfully!');
        console.log('Username: Admin');
        console.log('Password: Admin@13');

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