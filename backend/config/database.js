const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
        if (!mongoUri) {
            throw new Error('Missing MongoDB connection string. Set MONGODB_URI (recommended) or MONGO_URI.');
        }

        const conn = await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Database connection error:', error);
        // Never exit the process in serverless environments.
        throw error;
    }
};

module.exports = connectDB;