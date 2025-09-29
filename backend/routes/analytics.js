const express = require('express');
const {
    getOverviewAnalytics,
    getVolunteerAnalytics,
    getSchoolAnalytics
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', protect, authorize('admin'), getOverviewAnalytics);
router.get('/volunteers', protect, authorize('admin'), getVolunteerAnalytics);
router.get('/schools', protect, authorize('admin'), getSchoolAnalytics);

module.exports = router;