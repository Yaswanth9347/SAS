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
    getUserIds,
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
const { validate, paginationValidators, userFilterValidators, idParamValidator, bulkUserActionValidators, bulkDeleteValidators, teamCreateValidators, addTeamMembersValidators, removeTeamMemberValidators, changeTeamLeaderValidators } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

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
// Per-route rate limiters for heavy operations
const bulkLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

// Users listing with validation
router.get('/users', [...paginationValidators, ...userFilterValidators], validate, getUsers);
// IDs-only endpoint for select-all with validation
router.get('/users/ids', [...paginationValidators, ...userFilterValidators], validate, getUserIds);

// Per-user actions validation
router.put('/users/:id/approve', idParamValidator, validate, approveUser);
router.put('/users/:id/reject', idParamValidator, validate, rejectUser);
router.put('/users/:id/role', idParamValidator, validate, updateUserRole);

// Bulk operations with validation and tighter rate limit
router.put('/users/bulk', bulkLimiter, bulkUserActionValidators, validate, bulkUpdateUsers);
router.delete('/users/:id', idParamValidator, validate, deleteUser);
router.delete('/users/bulk', bulkLimiter, bulkDeleteValidators, validate, bulkDeleteUsers);
router.get('/activity', getActivityLogs);

// Team routes
router.get('/teams', getTeams);
router.post('/teams', teamCreateValidators, validate, createTeam);
router.get('/teams/:id', idParamValidator, validate, getTeam);
router.delete('/teams/:id', idParamValidator, validate, deleteTeam);

// Team member management routes
router.put('/teams/:id/members/add', addTeamMembersValidators, validate, addTeamMembers);
router.put('/teams/:id/members/remove', removeTeamMemberValidators, validate, removeTeamMember);
router.put('/teams/:id/leader', changeTeamLeaderValidators, validate, changeTeamLeader);
router.get('/teams/:id/stats', idParamValidator, validate, getTeamStats);

// Storage management endpoints (Hybrid Approach)
router.get('/storage/stats', getStorageStats);
// Rate limit cleanup to avoid abuse
const storageLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
router.post('/storage/cleanup', storageLimiter, cleanupStorage);

module.exports = router;
