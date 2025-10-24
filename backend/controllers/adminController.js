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

// @desc    Add members to team
// @route   PUT /api/admin/teams/:id/members/add
// @access  Private/Admin
exports.addTeamMembers = async (req, res, next) => {
    try {
        const { memberIds } = req.body;

        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide member IDs as an array'
            });
        }

        const team = await Team.findById(req.params.id);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Verify all users exist and are volunteers
        const users = await User.find({ 
            _id: { $in: memberIds },
            role: 'volunteer'
        });

        if (users.length !== memberIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more users not found or not volunteers'
            });
        }

        // Check if any users are already in other teams
        const usersWithTeams = users.filter(user => user.team && user.team.toString() !== team._id.toString());
        if (usersWithTeams.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Some users are already in other teams: ${usersWithTeams.map(u => u.name).join(', ')}`
            });
        }

        // Add only new members (avoid duplicates)
        const existingMemberIds = team.members.map(m => m.toString());
        const newMembers = memberIds.filter(id => !existingMemberIds.includes(id));

        if (newMembers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'All selected users are already team members'
            });
        }

        // Add members to team
        team.members.push(...newMembers);
        await team.save();

        // Update users to reference this team
        await User.updateMany(
            { _id: { $in: newMembers } },
            { team: team._id }
        );

        // Return populated team
        const updatedTeam = await Team.findById(team._id)
            .populate('teamLeader', 'name username email department year')
            .populate('members', 'name username email department year');

        res.status(200).json({
            success: true,
            message: `${newMembers.length} member(s) added successfully`,
            data: updatedTeam
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Remove member from team
// @route   PUT /api/admin/teams/:id/members/remove
// @access  Private/Admin
exports.removeTeamMember = async (req, res, next) => {
    try {
        const { memberId } = req.body;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide member ID'
            });
        }

        const team = await Team.findById(req.params.id);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Prevent removing team leader
        if (team.teamLeader.toString() === memberId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove team leader. Please transfer leadership first.'
            });
        }

        // Check if member exists in team
        const memberIndex = team.members.findIndex(m => m.toString() === memberId);
        if (memberIndex === -1) {
            return res.status(400).json({
                success: false,
                message: 'User is not a member of this team'
            });
        }

        // Check if member has upcoming scheduled visits
        const upcomingVisits = await Visit.countDocuments({
            team: team._id,
            status: 'scheduled',
            date: { $gte: new Date() },
            'team.members': memberId
        });

        if (upcomingVisits > 0) {
            return res.status(400).json({
                success: false,
                message: `This member has ${upcomingVisits} upcoming visit(s). Please reassign or cancel those visits first.`
            });
        }

        // Remove member from team
        team.members.splice(memberIndex, 1);
        await team.save();

        // Remove team reference from user
        await User.findByIdAndUpdate(memberId, { $unset: { team: 1 } });

        // Return populated team
        const updatedTeam = await Team.findById(team._id)
            .populate('teamLeader', 'name username email department year')
            .populate('members', 'name username email department year');

        res.status(200).json({
            success: true,
            message: 'Member removed successfully',
            data: updatedTeam
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Change team leader
// @route   PUT /api/admin/teams/:id/leader
// @access  Private/Admin
exports.changeTeamLeader = async (req, res, next) => {
    try {
        const { leaderId } = req.body;

        if (!leaderId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide new leader ID'
            });
        }

        const team = await Team.findById(req.params.id);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Check if new leader is a team member
        const isMember = team.members.some(m => m.toString() === leaderId);
        if (!isMember) {
            return res.status(400).json({
                success: false,
                message: 'New leader must be a current team member'
            });
        }

        // Check if already the leader
        if (team.teamLeader.toString() === leaderId) {
            return res.status(400).json({
                success: false,
                message: 'This user is already the team leader'
            });
        }

        // Update team leader
        const oldLeaderId = team.teamLeader;
        team.teamLeader = leaderId;
        await team.save();

        // Return populated team
        const updatedTeam = await Team.findById(team._id)
            .populate('teamLeader', 'name username email department year')
            .populate('members', 'name username email department year');

        res.status(200).json({
            success: true,
            message: 'Team leader changed successfully',
            data: updatedTeam,
            oldLeaderId: oldLeaderId
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get single team details
// @route   GET /api/admin/teams/:id
// @access  Private
exports.getTeam = async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('teamLeader', 'name username email department year')
            .populate('members', 'name username email department year')
            .populate('assignedSchool', 'name');
        
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
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Delete a team
// @route   DELETE /api/admin/teams/:id
// @access  Private/Admin
exports.deleteTeam = async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.id);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Check if team has any upcoming scheduled visits
        const Visit = require('../models/Visit');
        const upcomingVisits = await Visit.countDocuments({
            team: team._id,
            status: 'scheduled',
            date: { $gte: new Date() }
        });

        if (upcomingVisits > 0) {
            return res.status(400).json({
                success: false,
                message: `This team has ${upcomingVisits} upcoming visit(s). Please cancel or reassign those visits before deleting the team.`
            });
        }

        // Remove team reference from all members
        await User.updateMany(
            { _id: { $in: team.members } },
            { $unset: { team: 1 } }
        );

        // Delete the team
        await Team.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Team deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get team statistics
// @route   GET /api/admin/teams/:id/stats
// @access  Private/Admin
exports.getTeamStats = async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.id);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Get team's visits
        const visits = await Visit.find({ team: team._id }).populate('school', 'name');
        
        // Calculate statistics
        const totalVisits = visits.length;
        const completedVisits = visits.filter(v => v.status === 'completed').length;
        const scheduledVisits = visits.filter(v => v.status === 'scheduled').length;
        const cancelledVisits = visits.filter(v => v.status === 'cancelled').length;
        
        const childrenReached = visits
            .filter(v => v.status === 'completed')
            .reduce((sum, v) => sum + (v.numberOfChildren || 0), 0);
        
        const schoolsVisited = [...new Set(visits
            .filter(v => v.status === 'completed' && v.school)
            .map(v => v.school._id.toString()))].length;
        
        const avgChildrenPerVisit = completedVisits > 0 
            ? Math.round(childrenReached / completedVisits) 
            : 0;
        
        // Find most visited school
        const schoolCounts = {};
        visits.filter(v => v.status === 'completed' && v.school).forEach(v => {
            const schoolId = v.school._id.toString();
            schoolCounts[schoolId] = (schoolCounts[schoolId] || 0) + 1;
        });
        
        let mostVisitedSchool = null;
        if (Object.keys(schoolCounts).length > 0) {
            const maxCount = Math.max(...Object.values(schoolCounts));
            const mostVisitedId = Object.keys(schoolCounts).find(
                id => schoolCounts[id] === maxCount
            );
            const visit = visits.find(v => v.school && v.school._id.toString() === mostVisitedId);
            if (visit && visit.school) {
                mostVisitedSchool = {
                    name: visit.school.name,
                    visitCount: maxCount
                };
            }
        }
        
        // Completion rate
        const completionRate = totalVisits > 0 
            ? Math.round((completedVisits / totalVisits) * 100) 
            : 0;

        // Recent visits
        const recentVisits = visits
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5)
            .map(v => ({
                _id: v._id,
                school: v.school?.name || 'Unknown',
                date: v.date,
                status: v.status,
                numberOfChildren: v.numberOfChildren
            }));

        res.status(200).json({
            success: true,
            data: {
                totalVisits,
                completedVisits,
                scheduledVisits,
                cancelledVisits,
                childrenReached,
                schoolsVisited,
                avgChildrenPerVisit,
                completionRate,
                mostVisitedSchool,
                recentVisits,
                memberCount: team.members.length
            }
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