const express = require('express');
const { 
    getVolunteers, 
    getProfile, 
    updateProfile, 
    createTeams 
} = require('../controllers/volunteerController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getVolunteers);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/create-teams', protect, createTeams);

module.exports = router;