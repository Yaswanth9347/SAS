const express = require('express');
const router = express.Router();

// Require authentication middleware (removed role-checking)
const auth = require('../middleware/auth');

// Apply authentication middleware for all routes (removed role restriction)
router.use(auth.protect);

const { 
    getDashboardStats,
    createTeams,
    getTeams,
    getUsers,
    createTeam,
    getStorageStats,
    cleanupStorage
} = require('../controllers/adminController');

router.get('/stats', getDashboardStats);
router.post('/create-teams', createTeams);
router.get('/teams', getTeams);
router.get('/users', getUsers);
router.post('/teams', createTeam);

// Storage management endpoints (Hybrid Approach)
router.get('/storage/stats', getStorageStats);
router.post('/storage/cleanup', cleanupStorage);

module.exports = router;