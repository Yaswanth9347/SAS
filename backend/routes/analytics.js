const express = require('express');
const {
    getOverviewAnalytics,
    getVolunteerAnalytics,
    getSchoolAnalytics
} = require('../controllers/analyticsController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All analytics routes require admin privileges
router.use(protect);
router.use(adminOnly);

router.get('/overview', getOverviewAnalytics);
router.get('/volunteers', getVolunteerAnalytics);
router.get('/schools', getSchoolAnalytics);

module.exports = router;