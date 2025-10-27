const express = require('express');
const router = express.Router();

// Require authentication middleware
const auth = require('../middleware/auth');

// Apply authentication and admin authorization for all routes
router.use(auth.protect);
router.use(auth.authorize('admin'));

const { 
    getDashboardStats,
    createTeams,
    getTeams,
    getTeam,
    getUsers,
    approveUser,
    rejectUser,
    updateUserRole,
    bulkUpdateUsers,
    getActivityLogs,
    createTeam,
    deleteTeam,
    addTeamMembers,
    removeTeamMember,
    changeTeamLeader,
    getTeamStats,
    getStorageStats,
    cleanupStorage,
    deleteUser,
    bulkDeleteUsers
} = require('../controllers/adminController');

// Root endpoint for admin access verification
router.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Admin access confirmed',
        user: {
            id: req.user.id,
            role: req.user.role
        }
    });
});

router.get('/stats', getDashboardStats);
router.post('/create-teams', createTeams);
router.get('/users', getUsers);
router.put('/users/:id/approve', approveUser);
router.put('/users/:id/reject', rejectUser);
router.put('/users/:id/role', updateUserRole);
router.put('/users/bulk', bulkUpdateUsers);
router.delete('/users/:id', deleteUser);
router.delete('/users/bulk', bulkDeleteUsers);
router.get('/activity', getActivityLogs);

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
