const User = require('../models/User');
const Team = require('../models/Team');

// @desc    Get all volunteers
// @route   GET /api/volunteers
// @access  Private/Admin
exports.getVolunteers = async (req, res, next) => {
    try {
        const volunteers = await User.find({ role: 'volunteer' })
            .populate('team')
            .select('-password');

        res.status(200).json({
            success: true,
            count: volunteers.length,
            data: volunteers
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get volunteer profile
// @route   GET /api/volunteers/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
    try {
        const volunteer = await User.findById(req.user.id)
            .populate('team')
            .select('-password');

        res.status(200).json({
            success: true,
            data: volunteer
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update volunteer profile
// @route   PUT /api/volunteers/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
    try {
        const fieldsToUpdate = {
            name: req.body.name,
            phone: req.body.phone,
            skills: req.body.skills
        };

        const volunteer = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
            new: true,
            runValidators: true
        }).select('-password');

        res.status(200).json({
            success: true,
            data: volunteer
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Create teams automatically
// @route   POST /api/volunteers/create-teams
// @access  Private/Admin
exports.createTeams = async (req, res, next) => {
    try {
        const { teamSize = 4 } = req.body;
        
        // Get all active volunteers without teams
        const volunteers = await User.find({ 
            role: 'volunteer', 
            team: { $exists: false },
            isActive: true 
        });

        // Shuffle volunteers randomly
        const shuffledVolunteers = volunteers.sort(() => 0.5 - Math.random());
        
        const teams = [];
        let teamCount = 1;

        // Create teams
        for (let i = 0; i < shuffledVolunteers.length; i += teamSize) {
            const teamMembers = shuffledVolunteers.slice(i, i + teamSize);
            const teamLeader = teamMembers[0];
            
            const team = await Team.create({
                name: `Team ${teamCount}`,
                teamLeader: teamLeader._id,
                members: teamMembers.map(member => member._id)
            });

            // Update volunteers with team reference
            await User.updateMany(
                { _id: { $in: teamMembers.map(member => member._id) } },
                { team: team._id }
            );

            teams.push(team);
            teamCount++;
        }

        res.status(200).json({
            success: true,
            count: teams.length,
            data: teams
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};