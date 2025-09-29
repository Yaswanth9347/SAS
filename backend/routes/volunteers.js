const express = require('express');
const { 
    getVolunteers, 
    getProfile, 
    updateProfile, 
    createTeams 
} = require('../controllers/volunteerController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, authorize('admin'), getVolunteers);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/create-teams', protect, authorize('admin'), createTeams);

module.exports = router;