const User = require('../models/User');
const Team = require('../models/Team');

// @desc    Get all users (for team creation UI)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
    try {
        // Return basic user info used by the frontend (id and username/name)
        const users = await User.find({}, '_id username name role').sort({ username: 1 });

        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Create a team manually
// @route   POST /api/admin/teams
// @access  Private/Admin
exports.createTeam = async (req, res, next) => {
    try {
        const { name, members = [], teamLeader } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Team name is required' });
        }

        if (!Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one member is required' });
        }

        if (!teamLeader) {
            return res.status(400).json({ success: false, message: 'A team leader must be specified' });
        }

        // Ensure leader is one of the members
        if (!members.find(id => String(id) === String(teamLeader))) {
            return res.status(400).json({ success: false, message: 'Team leader must be one of the members' });
        }

        // Verify members exist
        const foundUsers = await User.find({ _id: { $in: members } });
        if (foundUsers.length !== members.length) {
            return res.status(400).json({ success: false, message: 'One or more members not found' });
        }

        // Create team
        const team = await Team.create({ name: name.trim(), teamLeader, members });

        // Update users to reference this team
        await User.updateMany({ _id: { $in: members } }, { team: team._id });

        const populated = await Team.findById(team._id)
            .populate('teamLeader', 'name username')
            .populate('members', 'name username');

        res.status(201).json({ success: true, data: populated });
    } catch (error) {
        // Handle duplicate name error
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'A team with that name already exists' });
        }

        res.status(400).json({ success: false, message: error.message });
    }
};

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

// ============================================
// STORAGE MANAGEMENT ENDPOINTS
// Hybrid Storage Approach Monitoring
// ============================================

const path = require('path');
const Visit = require('../models/Visit');
const {
    getStorageStats: getStorageStatsUtil,
    cleanupOrphanedFiles,
    checkDiskSpace
} = require('../utils/storage');

// @desc    Get storage statistics
// @route   GET /api/admin/storage/stats
// @access  Private
exports.getStorageStats = async (req, res, next) => {
    try {
        const uploadsDir = path.join(__dirname, '../uploads');
        
        // Get storage stats
        const storageStats = await getStorageStatsUtil(uploadsDir);
        
        // Get disk space info
        const diskSpace = await checkDiskSpace(uploadsDir);
        
        // Get database stats
        const totalVisits = await Visit.countDocuments();
        const visitsWithPhotos = await Visit.countDocuments({ 'photos.0': { $exists: true } });
        const visitsWithVideos = await Visit.countDocuments({ 'videos.0': { $exists: true } });
        const visitsWithDocs = await Visit.countDocuments({ 'docs.0': { $exists: true } });
        
        res.status(200).json({
            success: true,
            data: {
                storage: storageStats,
                diskSpace: diskSpace,
                database: {
                    totalVisits,
                    visitsWithPhotos,
                    visitsWithVideos,
                    visitsWithDocs
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Cleanup orphaned files
// @route   POST /api/admin/storage/cleanup
// @access  Private
exports.cleanupStorage = async (req, res, next) => {
    try {
        const uploadsDir = path.join(__dirname, '../uploads');
        
        // Get all valid visit IDs from database
        const visits = await Visit.find({}, '_id');
        const visitIds = visits.map(visit => visit._id);
        
        // Cleanup orphaned files
        const cleanupResults = await cleanupOrphanedFiles(uploadsDir, visitIds);
        
        res.status(200).json({
            success: true,
            data: cleanupResults,
            message: `Cleaned up ${cleanupResults.deletedFolders.length} orphaned folders (${cleanupResults.deletedSizeFormatted})`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};