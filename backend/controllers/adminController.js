const User = require('../models/User');
const Team = require('../models/Team');
const ActivityLog = require('../models/ActivityLog');

// Helper to build user query from filters consistently across endpoints
function buildUserQueryFromReq(req) {
    const { role, status, verified, search, department, year, availableOnly } = req.query || {};
    const query = {};

    if (role) query.role = role;
    if (status) query.verificationStatus = status; // 'pending' | 'approved' | 'rejected'
    if (verified !== undefined) query.isVerified = verified === 'true';
    if (department) query.department = department;
    if (year) query.year = parseInt(year);

    // availableOnly=true => users not currently assigned to a team
    if (availableOnly === 'true') {
        query.$or = [
            { team: { $exists: false } },
            { team: null }
        ];
    }

    if (search) {
        const searchClause = {
            $or: [
                { name: new RegExp(search, 'i') },
                { username: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') }
            ]
        };
        if (query.$or) {
            query.$and = [{ $or: query.$or }, searchClause.$or ? searchClause : {}];
            delete query.$or;
        } else {
            Object.assign(query, searchClause);
        }
    }

    return query;
}

// @desc    Get all users (for team creation UI)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const query = buildUserQueryFromReq(req);

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [users, total] = await Promise.all([
            User.find(
                query,
                '_id username name email role department year isActive isVerified verificationStatus createdAt updatedAt team'
            )
                .populate('team', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            User.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            count: users.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: users
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get only user IDs matching filters (server-assisted select-all)
// @route   GET /api/admin/users/ids
// @access  Private/Admin
exports.getUserIds = async (req, res) => {
    try {
        const { page = 1, limit = 10000 } = req.query; // cap default to 10k per page
        const query = buildUserQueryFromReq(req);

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [ids, total] = await Promise.all([
            User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select('_id').lean(),
            User.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            count: ids.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            ids: ids.map(d => String(d._id))
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Approve a user registration/profile
// @route   PUT /api/admin/users/:id/approve
// @access  Private/Admin
exports.approveUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isVerified: true, verificationStatus: 'approved', verificationNotes: req.body?.notes },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        await ActivityLog.create({
            actor: req.user.id,
            user: user._id,
            action: 'user.approve',
            targetType: 'User',
            targetId: user._id,
            metadata: { notes: req.body?.notes },
            ip: req.ip
        });

        res.json({ success: true, message: 'User approved', data: { id: user._id, isVerified: user.isVerified, verificationStatus: user.verificationStatus } });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Reject a user registration/profile
// @route   PUT /api/admin/users/:id/reject
// @access  Private/Admin
exports.rejectUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isVerified: false, verificationStatus: 'rejected', verificationNotes: req.body?.reason },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        await ActivityLog.create({
            actor: req.user.id,
            user: user._id,
            action: 'user.reject',
            targetType: 'User',
            targetId: user._id,
            metadata: { reason: req.body?.reason },
            ip: req.ip
        });

        res.json({ success: true, message: 'User rejected', data: { id: user._id, isVerified: user.isVerified, verificationStatus: user.verificationStatus } });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        if (!['admin', 'volunteer'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        await ActivityLog.create({
            actor: req.user.id,
            user: user._id,
            action: 'user.role.change',
            targetType: 'User',
            targetId: user._id,
            metadata: { role },
            ip: req.ip
        });

        res.json({ success: true, message: 'Role updated', data: { id: user._id, role: user.role } });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Bulk user operations (approve, reject, role)
// @route   PUT /api/admin/users/bulk
// @access  Private/Admin
exports.bulkUpdateUsers = async (req, res) => {
    try {
        const { action, userIds = [], role, reason, notes, idempotencyKey } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'userIds array is required' });
        }

        // Idempotency: if idempotencyKey present and prior log exists, return that result
        if (idempotencyKey) {
            const prior = await ActivityLog.findOne({
                actor: req.user.id,
                action: `user.bulk.${action}`,
                'metadata.idempotencyKey': idempotencyKey
            }).sort({ createdAt: -1 }).lean();
            if (prior && prior.metadata && (prior.metadata.results || prior.metadata.result)) {
                const data = prior.metadata.results ? { matched: (prior.metadata.results || []).length, modified: prior.metadata.modified || 0, results: prior.metadata.results } : prior.metadata.result;
                return res.json({ success: true, idempotent: true, message: 'Bulk operation already processed', data });
            }
        }

        // Build per-ID results for partial failure handling
        const results = [];
        let modified = 0;
        if (action === 'approve') {
            for (const id of userIds) {
                try {
                    const u = await User.findByIdAndUpdate(id, { isVerified: true, verificationStatus: 'approved', verificationNotes: notes }, { new: true });
                    if (!u) { results.push({ id, ok: false, reason: 'not-found' }); continue; }
                    results.push({ id, ok: true });
                    modified += 1;
                } catch (e) { results.push({ id, ok: false, reason: 'error' }); }
            }
        } else if (action === 'reject') {
            for (const id of userIds) {
                try {
                    const u = await User.findByIdAndUpdate(id, { isVerified: false, verificationStatus: 'rejected', verificationNotes: reason }, { new: true });
                    if (!u) { results.push({ id, ok: false, reason: 'not-found' }); continue; }
                    results.push({ id, ok: true });
                    modified += 1;
                } catch (e) { results.push({ id, ok: false, reason: 'error' }); }
            }
        } else if (action === 'role') {
            if (!['admin', 'volunteer'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
            for (const id of userIds) {
                try {
                    // Prevent demoting the last admin
                    const current = await User.findById(id);
                    if (!current) { results.push({ id, ok: false, reason: 'not-found' }); continue; }
                    if (current.role === 'admin' && role !== 'admin') {
                        const adminsCount = await User.countDocuments({ role: 'admin', _id: { $ne: id } });
                        if (adminsCount === 0) { results.push({ id, ok: false, reason: 'last-admin' }); continue; }
                    }
                    const u = await User.findByIdAndUpdate(id, { role }, { new: true });
                    if (!u) { results.push({ id, ok: false, reason: 'not-found' }); continue; }
                    results.push({ id, ok: true });
                    modified += 1;
                } catch (e) { results.push({ id, ok: false, reason: 'error' }); }
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        await ActivityLog.create({
            actor: req.user.id,
            action: `user.bulk.${action}`,
            targetType: 'User',
            metadata: { userIds, role, reason, notes, idempotencyKey, results, modified },
            ip: req.ip
        });

        res.json({ success: true, message: 'Bulk operation completed', data: { matched: userIds.length, modified, results } });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete a user (with safety checks)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent self-deletion
        if (String(userId) === String(req.user.id)) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // If admin, ensure at least one other admin remains
        if (user.role === 'admin') {
            const adminsCount = await User.countDocuments({ role: 'admin', _id: { $ne: userId } });
            if (adminsCount === 0) {
                return res.status(400).json({ success: false, message: 'Cannot delete the last admin account.' });
            }
        }

        // If the user is a team leader of any team, block deletion (leader is required)
        const leaderTeams = await Team.find({ teamLeader: userId }).select('_id name');
        if (leaderTeams.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete user: they are leader of ${leaderTeams.length} team(s). Change team leader first.`
            });
        }

        // Remove from team members where present
        await Team.updateMany(
            { members: userId },
            { $pull: { members: userId } }
        );

        // Finally, delete the user
        await User.findByIdAndDelete(userId);

        await ActivityLog.create({
            actor: req.user.id,
            user: userId,
            action: 'user.delete',
            targetType: 'User',
            targetId: userId,
            metadata: { username: user.username, role: user.role },
            ip: req.ip
        });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Bulk delete users (with safety checks)
// @route   DELETE /api/admin/users/bulk
// @access  Private/Admin
exports.bulkDeleteUsers = async (req, res) => {
    try {
        const { userIds = [], idempotencyKey } = req.body || {};
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'userIds array is required' });
        }

        // Idempotency: if idempotencyKey present and prior log exists, return that result
        if (idempotencyKey) {
            const prior = await ActivityLog.findOne({
                actor: req.user.id,
                action: 'user.bulk.delete',
                'metadata.idempotencyKey': idempotencyKey
            }).sort({ createdAt: -1 }).lean();
            if (prior && prior.metadata && prior.metadata.results) {
                const deleted = prior.metadata.results.filter(r => r.ok).length;
                return res.json({ success: true, idempotent: true, message: `Deleted ${deleted} user(s).`, data: { results: prior.metadata.results, deleted } });
            }
        }

        const results = [];
        for (const id of userIds) {
            // Skip self
            if (String(id) === String(req.user.id)) {
                results.push({ id, ok: false, reason: 'self' });
                continue;
            }

            const user = await User.findById(id);
            if (!user) { results.push({ id, ok: false, reason: 'not-found' }); continue; }

            if (user.role === 'admin') {
                const adminsCount = await User.countDocuments({ role: 'admin', _id: { $ne: id } });
                if (adminsCount === 0) { results.push({ id, ok: false, reason: 'last-admin' }); continue; }
            }

            const leaderTeams = await Team.find({ teamLeader: id }).select('_id');
            if (leaderTeams.length > 0) { results.push({ id, ok: false, reason: 'team-leader' }); continue; }

            await Team.updateMany({ members: id }, { $pull: { members: id } });
            await User.findByIdAndDelete(id);
            results.push({ id, ok: true });
        }

        await ActivityLog.create({
            actor: req.user.id,
            action: 'user.bulk.delete',
            targetType: 'User',
            metadata: { userIds, results, idempotencyKey },
            ip: req.ip
        });

        const deleted = results.filter(r => r.ok).length;
        res.json({ success: true, message: `Deleted ${deleted} user(s).`, data: { results, deleted } });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get activity logs (optionally filter by user)
// @route   GET /api/admin/activity
// @access  Private/Admin
exports.getActivityLogs = async (req, res) => {
    try {
        const { userId, action, actorId, targetId, targetType, page = 1, limit = 50 } = req.query;
        const query = {};
        if (userId) query.user = userId;
        if (action) query.action = action;
        if (actorId) query.actor = actorId;
        if (targetId) query.targetId = targetId;
        if (targetType) query.targetType = targetType;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .populate('actor', 'name username role')
                .populate('user', 'name username role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            ActivityLog.countDocuments(query)
        ]);

        res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: logs });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
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

        // Verify members exist (and fetch their current team info)
        const foundUsers = await User.find({ _id: { $in: members } }).populate('team', 'name');
        if (foundUsers.length !== members.length) {
            return res.status(400).json({ success: false, message: 'One or more members not found' });
        }

        // Enforce membership uniqueness: none of the selected users should already belong to a different team
        const alreadyAssigned = foundUsers.filter(u => !!u.team);
        if (alreadyAssigned.length > 0) {
            const details = alreadyAssigned.map(u => `${u.username || u.name} (${u.team?.name || 'another team'})`).join(', ');
            return res.status(409).json({
                success: false,
                message: `Some selected members already belong to a team: ${details}`
            });
        }

    // Create team
    const team = await Team.create({ name: name.trim(), teamLeader, members });

        // Update users to reference this team
        await User.updateMany({ _id: { $in: members } }, { team: team._id });

        const populated = await Team.findById(team._id)
            .populate('teamLeader', 'name username')
            .populate('members', 'name username');

        // Audit log
        await ActivityLog.create({
            actor: req.user.id,
            action: 'team.create',
            targetType: 'Team',
            targetId: team._id,
            metadata: { name: name.trim(), teamLeader, members, memberCount: members.length },
            ip: req.ip
        });

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

        // Audit log for auto-create
        await ActivityLog.create({
            actor: req.user.id,
            action: 'teams.auto.create',
            targetType: 'Team',
            metadata: { teamSize, count: teams.length, teamIds: teams.map(t => t._id) },
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: `Created ${teams.length} teams successfully`,
            data: teams
        });
    } catch (error) {
            // Notify members of team assignment
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

        // Audit log
        await ActivityLog.create({
            actor: req.user.id,
            action: 'team.members.add',
            targetType: 'Team',
            targetId: team._id,
            metadata: { added: newMembers, count: newMembers.length },
            ip: req.ip
        });

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

        // Check if member has upcoming scheduled visits (Visit.members contains userId strings)
        const upcomingVisits = await Visit.countDocuments({
            team: team._id,
            status: 'scheduled',
            date: { $gte: new Date() },
            members: memberId
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

        // Audit log
        await ActivityLog.create({
            actor: req.user.id,
            action: 'team.members.remove',
            targetType: 'Team',
            targetId: team._id,
            metadata: { memberId },
            ip: req.ip
        });

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

        // Audit log
        await ActivityLog.create({
            actor: req.user.id,
            action: 'team.leader.change',
            targetType: 'Team',
            targetId: team._id,
            metadata: { from: oldLeaderId, to: leaderId },
            ip: req.ip
        });

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

        // Unassign all members from this team before deleting
        if (team.members && team.members.length > 0) {
            const User = require('../models/User');
            await User.updateMany(
                { _id: { $in: team.members } },
                { $unset: { team: "" } }
            );
        }

        // Delete the team
        await Team.findByIdAndDelete(req.params.id);

        // Audit log
        await ActivityLog.create({
            actor: req.user.id,
            action: 'team.delete',
            targetType: 'Team',
            targetId: team._id,
            metadata: { name: team.name, memberCount: (team.members || []).length },
            ip: req.ip
        });

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

        // Audit log
        await ActivityLog.create({
            actor: req.user.id,
            action: 'storage.cleanup',
            targetType: 'Storage',
            metadata: {
                deletedFolders: cleanupResults.deletedFolders.length,
                deletedSize: cleanupResults.deletedSize,
                deletedSizeFormatted: cleanupResults.deletedSizeFormatted
            },
            ip: req.ip
        });

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