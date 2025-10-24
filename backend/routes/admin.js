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
    getTeam,
    getUsers,
    createTeam,
    deleteTeam,
    addTeamMembers,
    removeTeamMember,
    changeTeamLeader,
    getTeamStats,
    getStorageStats,
    cleanupStorage
} = require('../controllers/adminController');

router.get('/stats', getDashboardStats);
router.post('/create-teams', createTeams);
router.get('/users', getUsers);

// Team routes
router.get('/teams', getTeams);
router.post('/teams', createTeam);
router.get('/teams/:id', getTeam);
router.delete('/teams/:id', deleteTeam);

// Team member management routes
router.put('/teams/:id/members/add', addTeamMembers);
router.put('/teams/:id/members/remove', removeTeamMember);
router.put('/teams/:id/leader', changeTeamLeader);
router.get('/teams/:id/stats', getTeamStats);

// Storage management endpoints (Hybrid Approach)
router.get('/storage/stats', getStorageStats);
router.post('/storage/cleanup', cleanupStorage);

module.exports = router;