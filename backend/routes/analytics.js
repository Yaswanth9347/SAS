const express = require('express');
const {
    getOverviewAnalytics,
    getVolunteerAnalytics,
    getSchoolAnalytics
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', protect, getOverviewAnalytics);
router.get('/volunteers', protect, getVolunteerAnalytics);
router.get('/schools', protect, getSchoolAnalytics);

module.exports = router;