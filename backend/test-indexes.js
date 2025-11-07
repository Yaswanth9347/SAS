#!/usr/bin/env node

/**
 * Database Indexes Verification Script
 * Checks all indexes across all models
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

// Import all models
const User = require('./models/User');
const School = require('./models/School');
const Visit = require('./models/Visit');
const Team = require('./models/Team');
const Notification = require('./models/Notification');
const ActivityLog = require('./models/ActivityLog');
const Contact = require('./models/Contact');

const models = [
    { name: 'User', model: User, expectedCount: 14 },
    { name: 'School', model: School, expectedCount: 9 },
    { name: 'Visit', model: Visit, expectedCount: 25 },
    { name: 'Team', model: Team, expectedCount: 9 },
    { name: 'Notification', model: Notification, expectedCount: 1 },
    { name: 'ActivityLog', model: ActivityLog, expectedCount: 7 },
    { name: 'Contact', model: Contact, expectedCount: 8 }
];

async function verifyIndexes() {
    try {
        console.log('🔍 Connecting to MongoDB...\n');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas\n');
        console.log('='.repeat(80));
        console.log('📊 DATABASE INDEXES VERIFICATION');
        console.log('='.repeat(80));

        let totalIndexes = 0;
        let allGood = true;

        for (const { name, model, expectedCount } of models) {
            console.log(`\n📁 ${name} Model`);
            console.log('-'.repeat(80));

            try {
                // Sync indexes to ensure they're all created
                await model.syncIndexes();
                
                // Get indexes using listIndexes
                const indexesCursor = model.collection.listIndexes();
                const indexesArray = await indexesCursor.toArray();
                const indexCount = indexesArray.length;
                totalIndexes += indexCount;

                // Check if count matches expected (includes _id index)
                const expectedTotal = expectedCount + 1; // +1 for default _id index
                const status = indexCount >= expectedTotal ? '✅' : '⚠️';
                
                if (indexCount < expectedTotal) {
                    allGood = false;
                }

                console.log(`${status} Total Indexes: ${indexCount} (Expected: ${expectedTotal}+)`);
                console.log('\nIndex Details:');

                // Display all indexes
                indexesArray.forEach((index) => {
                    const indexKeys = Object.keys(index.key).map(k => {
                        const direction = index.key[k] === 1 ? '↑' : 
                                        index.key[k] === -1 ? '↓' : 
                                        index.key[k] === 'text' ? '🔍' : index.key[k];
                        return `${k}: ${direction}`;
                    }).join(', ');

                    const unique = index.unique ? ' [UNIQUE]' : '';
                    const text = index.key[Object.keys(index.key)[0]] === 'text' ? ' [TEXT SEARCH]' : '';
                    
                    console.log(`  • ${index.name}`);
                    console.log(`    Fields: { ${indexKeys} }${unique}${text}`);
                });

            } catch (error) {
                console.error(`❌ Error checking ${name} indexes:`, error.message);
                allGood = false;
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('📈 SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Models: ${models.length}`);
        console.log(`Total Indexes: ${totalIndexes}`);
        console.log(`Status: ${allGood ? '✅ All indexes verified' : '⚠️ Some indexes missing'}`);
        console.log('='.repeat(80));

        // Performance recommendations
        console.log('\n💡 PERFORMANCE TIPS:');
        console.log('   • Indexes are created automatically on server startup');
        console.log('   • Use .explain("executionStats") to verify index usage');
        console.log('   • Monitor slow queries in MongoDB Atlas Performance Advisor');
        console.log('   • Text indexes enable full-text search across multiple fields');
        console.log('   • Unique indexes prevent duplicate entries automatically');

        process.exit(allGood ? 0 : 1);

    } catch (error) {
        console.error('\n❌ Fatal Error:', error.message);
        process.exit(1);
    }
}

// Run verification
console.log('\n🚀 Starting Database Indexes Verification...\n');
verifyIndexes();
