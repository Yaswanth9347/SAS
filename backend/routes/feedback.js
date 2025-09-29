const express = require('express');
const {
    submitSchoolFeedback,
    getFeedbackStats
} = require('../controllers/feedbackController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/visit/:id', submitSchoolFeedback);
router.get('/stats', protect, authorize('admin'), getFeedbackStats);

module.exports = router;