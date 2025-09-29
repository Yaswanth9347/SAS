const User = require('../models/User');
const Team = require('../models/Team');

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getDashboardStats = async (req, res, next) => {
    try {
        const totalVolunteers = await User.countDocuments({ role: 'volunteer' });
        const activeVolunteers = await User.countDocuments({ role: 'volunteer', isActive: true });
        const totalTeams = await Team.countDocuments();
        const volunteersWithoutTeam = await User.countDocuments({ role: 'volunteer', team: { $exists: false } });

        res.status(200).json({
            success: true,
            data: {
                totalVolunteers,
                activeVolunteers,
                totalTeams,
                volunteersWithoutTeam
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Create teams automatically
// @route   POST /api/admin/create-teams
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

        if (volunteers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No volunteers available for team formation'
            });
        }

        // Shuffle volunteers randomly
        const shuffledVolunteers = volunteers.sort(() => 0.5 - Math.random());
        
        const teams = [];
        let teamCount = await Team.countDocuments() + 1;

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
            message: `Created ${teams.length} teams successfully`,
            data: teams
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get all teams with details
// @route   GET /api/admin/teams
// @access  Private/Admin
exports.getTeams = async (req, res, next) => {
    try {
        const teams = await Team.find()
            .populate('teamLeader', 'name email department year')
            .populate('members', 'name email department year')
            .populate('assignedSchool', 'name');

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