const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Team = require('../models/Team');

// Protect all routes - require authentication
router.use(auth.protect);

// Get all teams (for authenticated users)
router.get('/', async (req, res) => {
    try {
        const teams = await Team.find()
            .populate('teamLeader', 'username name')
            .populate('members', 'username name');

        res.status(200).json({
            success: true,
            data: teams
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching teams',
            error: error.message
        });
    }
});

// Get a specific team by ID (for authenticated users)
router.get('/:id', async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('teamLeader', 'username name')
            .populate('members', 'username name');

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        res.status(200).json({
            success: true,
            data: team
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching team',
            error: error.message
        });
    }
});

module.exports = router;
