// Script to clean up test database
const mongoose = require('mongoose');

async function cleanupTestDatabase() {
    try {
        await mongoose.connect('mongodb://localhost:27017/sas_test', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const collections = mongoose.connection.collections;

        for (const key in collections) {
            const collection = collections[key];
            await collection.deleteMany({});
            console.log(`✅ Cleared collection: ${key}`);
        }

        console.log('🎉 Test database cleaned up successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error cleaning test database:', error);
        process.exit(1);
    }
}

cleanupTestDatabase();