/**
 * Test script to verify the "Spread A Smile" PDF generation for visit reports
 * This simulates the admin finalize button click workflow
 * 
 * Run from backend directory: cd backend && node ../test-visit-report.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

const Visit = require('./models/Visit');

async function testVisitReport() {
  try {
    console.log('\n🔍 Finding a completed visit...\n');

    // Find a completed visit
    const visit = await Visit.findOne({ status: 'completed' })
      .populate('school', 'name address contactPerson')
      .populate('team', 'name')
      .sort({ date: -1 });

    if (!visit) {
      console.log('❌ No completed visits found. Please complete a visit first.');
      process.exit(1);
    }

    console.log('✅ Found completed visit:');
    console.log(`   Visit ID: ${visit._id}`);
    console.log(`   School: ${visit.school?.name || 'N/A'}`);
    console.log(`   Team: ${visit.team?.name || 'N/A'}`);
    console.log(`   Date: ${new Date(visit.date).toLocaleDateString()}`);
    console.log(`   Children: ${visit.childrenCount || 0}`);
    console.log(`   Current Status: ${visit.reportStatus || 'draft'}`);
    
    console.log('\n📝 To finalize this report with "Spread A Smile" template:');
    console.log(`   1. Login as admin`);
    console.log(`   2. Go to Reports page`);
    console.log(`   3. Click "Visits Report"`);
    console.log(`   4. Find this visit and click "Finalize" button`);
    console.log(`   5. After finalization, click "Download PDF" to get the formatted report`);
    
    console.log('\n🔗 Or test via API:');
    console.log(`   POST http://localhost:5001/api/visits/${visit._id}/report/finalize`);
    console.log(`   Headers: { "Authorization": "Bearer <admin-token>" }`);
    console.log(`   \n   Then download:`);
    console.log(`   GET http://localhost:5001/api/visits/${visit._id}/report/download`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

testVisitReport();
