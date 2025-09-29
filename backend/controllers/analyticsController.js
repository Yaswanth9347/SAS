const Visit = require('../models/Visit');
const User = require('../models/User');
const School = require('../models/School');
const Team = require('../models/Team');

// @desc    Get comprehensive analytics
// @route   GET /api/analytics/overview
// @access  Private/Admin
exports.getOverviewAnalytics = async (req, res, next) => {
    try {
        // Get basic counts
        const totalVolunteers = await User.countDocuments({ role: 'volunteer', isActive: true });
        const totalSchools = await School.countDocuments({ isActive: true });
        const totalTeams = await Team.countDocuments({ isActive: true });

        // Visit statistics
        const visitStats = await Visit.aggregate([
            {
                $group: {
                    _id: null,
                    totalVisits: { $sum: 1 },
                    completedVisits: { 
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
                    },
                    scheduledVisits: { 
                        $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } 
                    },
                    totalChildren: { $sum: '$childrenCount' },
                    averageChildren: { $avg: '$childrenCount' }
                }
            }
        ]);

        // Monthly visit trends
        const monthlyTrends = await Visit.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    visits: { $sum: 1 },
                    children: { $sum: '$childrenCount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 12 }
        ]);

        // School performance
        const schoolPerformance = await Visit.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$school',
                    visitCount: { $sum: 1 },
                    totalChildren: { $sum: '$childrenCount' },
                    averageRating: { $avg: '$feedbackFromSchool.rating' }
                }
            },
            {
                $lookup: {
                    from: 'schools',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'school'
                }
            },
            { $unwind: '$school' },
            { $sort: { visitCount: -1 } },
            { $limit: 10 }
        ]);

        // Team performance
        const teamPerformance = await Visit.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$team',
                    visitCount: { $sum: 1 },
                    totalChildren: { $sum: '$childrenCount' }
                }
            },
            {
                $lookup: {
                    from: 'teams',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'team'
                }
            },
            { $unwind: '$team' },
            { $sort: { visitCount: -1 } },
            { $limit: 10 }
        ]);

        // Children response distribution
        const responseDistribution = await Visit.aggregate([
            { $match: { status: 'completed', childrenResponse: { $exists: true } } },
            {
                $group: {
                    _id: '$childrenResponse',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalVolunteers,
                    totalSchools,
                    totalTeams,
                    ...(visitStats[0] || {
                        totalVisits: 0,
                        completedVisits: 0,
                        scheduledVisits: 0,
                        totalChildren: 0,
                        averageChildren: 0
                    })
                },
                monthlyTrends,
                schoolPerformance,
                teamPerformance,
                responseDistribution
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get volunteer analytics
// @route   GET /api/analytics/volunteers
// @access  Private/Admin
exports.getVolunteerAnalytics = async (req, res, next) => {
    try {
        // Department distribution
        const departmentStats = await User.aggregate([
            { $match: { role: 'volunteer', isActive: true } },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Year distribution
        const yearStats = await User.aggregate([
            { $match: { role: 'volunteer', isActive: true } },
            {
                $group: {
                    _id: '$year',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Top performing volunteers (by visits participated)
        const topVolunteers = await Visit.aggregate([
            { $match: { status: 'completed' } },
            { $unwind: '$team' },
            {
                $lookup: {
                    from: 'teams',
                    localField: 'team',
                    foreignField: '_id',
                    as: 'teamData'
                }
            },
            { $unwind: '$teamData' },
            { $unwind: '$teamData.members' },
            {
                $group: {
                    _id: '$teamData.members',
                    visitCount: { $sum: 1 },
                    totalChildren: { $sum: '$childrenCount' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'volunteer'
                }
            },
            { $unwind: '$volunteer' },
            { $sort: { visitCount: -1 } },
            { $limit: 10 },
            {
                $project: {
                    'volunteer.name': 1,
                    'volunteer.department': 1,
                    'volunteer.year': 1,
                    visitCount: 1,
                    totalChildren: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                departmentStats,
                yearStats,
                topVolunteers
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get school impact report
// @route   GET /api/analytics/schools
// @access  Private/Admin
exports.getSchoolAnalytics = async (req, res, next) => {
    try {
        const schoolImpact = await Visit.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$school',
                    totalVisits: { $sum: 1 },
                    totalChildren: { $sum: '$childrenCount' },
                    averageRating: { $avg: '$feedbackFromSchool.rating' },
                    lastVisit: { $max: '$date' }
                }
            },
            {
                $lookup: {
                    from: 'schools',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'school'
                }
            },
            { $unwind: '$school' },
            { $sort: { totalVisits: -1 } },
            {
                $project: {
                    'school.name': 1,
                    'school.address': 1,
                    'school.contactPerson': 1,
                    totalVisits: 1,
                    totalChildren: 1,
                    averageRating: 1,
                    lastVisit: 1
                }
            }
        ]);

        // Monthly school visits
        const monthlySchoolVisits = await Visit.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: {
                        school: '$school',
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    visits: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'schools',
                    localField: '_id.school',
                    foreignField: '_id',
                    as: 'school'
                }
            },
            { $unwind: '$school' },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 50 }
        ]);

        res.status(200).json({
            success: true,
            data: {
                schoolImpact,
                monthlySchoolVisits
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};