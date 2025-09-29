const express = require('express');
const { 
    getDashboardStats,
    createTeams,
    getTeams
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', protect, authorize('admin'), getDashboardStats);
router.post('/create-teams', protect, authorize('admin'), createTeams);
router.get('/teams', protect, authorize('admin'), getTeams);

module.exports = router;