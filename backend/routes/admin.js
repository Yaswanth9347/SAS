const express = require('express');
const router = express.Router();

// Require authentication and role-checking middleware
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// Apply authentication middleware for all admin routes (use the exported protect function)
router.use(auth.protect);

// Apply role-checking middleware to ensure only admin users can access these routes
router.use(role('admin'));

const { 
    getDashboardStats,
    createTeams,
    getTeams
} = require('../controllers/adminController');

router.get('/stats', getDashboardStats);
router.post('/create-teams', createTeams);
router.get('/teams', getTeams);

module.exports = router;