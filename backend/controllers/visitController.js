const Visit = require('../models/Visit');
const Team = require('../models/Team');
const School = require('../models/School');

// @desc    Get all visits
// @route   GET /api/visits
// @access  Private
exports.getVisits = async (req, res, next) => {
    try {
        let query;
        const { status, month, year } = req.query;
        
        // Build query based on user role and filters
        if (req.user.role === 'volunteer') {
            query = Visit.find({ team: req.user.team });
        } else {
            query = Visit.find();
        }

        // Apply filters
        if (status) {
            query = query.where('status').equals(status);
        }

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            query = query.where('date').gte(startDate).lte(endDate);
        }

        const visits = await query
            .populate('school', 'name address contactPerson')
            .populate('team', 'name')
            .populate('submittedBy', 'name')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: visits.length,
            data: visits
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get single visit
// @route   GET /api/visits/:id
// @access  Private
exports.getVisit = async (req, res, next) => {
    try {
        const visit = await Visit.findById(req.params.id)
            .populate('school')
            .populate('team')
            .populate('submittedBy', 'name email');

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        res.status(200).json({
            success: true,
            data: visit
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Create new visit
// @route   POST /api/visits
// @access  Private/Admin
exports.createVisit = async (req, res, next) => {
    try {
        // Check if team is available on that date
        const existingVisit = await Visit.findOne({
            team: req.body.team,
            date: req.body.date,
            status: { $in: ['scheduled', 'completed'] }
        });

        if (existingVisit) {
            return res.status(400).json({
                success: false,
                message: 'Team already has a visit scheduled on this date'
            });
        }

        const visit = await Visit.create(req.body);

        // Populate the created visit for response
        const populatedVisit = await Visit.findById(visit._id)
            .populate('school', 'name address')
            .populate('team', 'name');

        res.status(201).json({
            success: true,
            data: populatedVisit
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Submit visit report
// @route   PUT /api/visits/:id/submit
// @access  Private
exports.submitVisitReport = async (req, res, next) => {
    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // Check if user is in the team assigned to this visit
        if (req.user.role === 'volunteer' && !req.user.team.equals(visit.team)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to submit report for this visit'
            });
        }

        const reportData = {
            ...req.body,
            status: 'completed',
            submittedBy: req.user.id,
            submissionDate: new Date()
        };

        const updatedVisit = await Visit.findByIdAndUpdate(
            req.params.id, 
            reportData, 
            { new: true, runValidators: true }
        )
        .populate('school')
        .populate('team')
        .populate('submittedBy', 'name');

        res.status(200).json({
            success: true,
            data: updatedVisit
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get visits statistics
// @route   GET /api/visits/stats
// @access  Private
exports.getVisitStats = async (req, res, next) => {
    try {
        let matchQuery = {};
        
        if (req.user.role === 'volunteer') {
            matchQuery.team = req.user.team;
        }

        const stats = await Visit.aggregate([
            { $match: matchQuery },
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

        // Get monthly stats
        const monthlyStats = await Visit.aggregate([
            { $match: matchQuery },
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
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 }
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...(stats[0] || {
                    totalVisits: 0,
                    completedVisits: 0,
                    scheduledVisits: 0,
                    totalChildren: 0,
                    averageChildren: 0
                }),
                monthlyStats
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Cancel a visit
// @route   PUT /api/visits/:id/cancel
// @access  Private/Admin
exports.cancelVisit = async (req, res, next) => {
    try {
        const visit = await Visit.findByIdAndUpdate(
            req.params.id,
            { status: 'cancelled' },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        res.status(200).json({
            success: true,
            data: visit
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};



const { uploadVisitFiles } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// @desc    Upload files for visit report
// @route   POST /api/visits/:id/upload
// @access  Private
exports.uploadVisitFiles = uploadVisitFiles;

exports.handleFileUpload = async (req, res, next) => {
    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            // Clean up uploaded files if visit doesn't exist
            if (req.files) {
                Object.values(req.files).forEach(files => {
                    files.forEach(file => {
                        fs.unlinkSync(file.path);
                    });
                });
            }
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // Check if user is authorized to upload files for this visit
        if (req.user.role === 'volunteer' && !req.user.team.equals(visit.team)) {
            // Clean up uploaded files if not authorized
            if (req.files) {
                Object.values(req.files).forEach(files => {
                    files.forEach(file => {
                        fs.unlinkSync(file.path);
                    });
                });
            }
            return res.status(403).json({
                success: false,
                message: 'Not authorized to upload files for this visit'
            });
        }

        const fileUrls = {
            photos: [],
            videos: []
        };

        // Process uploaded files
        if (req.files) {
            if (req.files.photos) {
                fileUrls.photos = req.files.photos.map(file => 
                    `/uploads/${visit._id}/${path.basename(file.filename)}`
                );
            }
            if (req.files.videos) {
                fileUrls.videos = req.files.videos.map(file => 
                    `/uploads/${visit._id}/${path.basename(file.filename)}`
                );
            }
        }

        res.status(200).json({
            success: true,
            data: fileUrls
        });
    } catch (error) {
        // Clean up files on error
        if (req.files) {
            Object.values(req.files).forEach(files => {
                files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Submit complete visit report with files
// @route   PUT /api/visits/:id/complete-report
// @access  Private
exports.submitCompleteReport = async (req, res, next) => {
    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // Check authorization
        if (req.user.role === 'volunteer' && !req.user.team.equals(visit.team)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to submit report for this visit'
            });
        }

        const reportData = {
            ...req.body,
            topicsCovered: req.body.topicsCovered ? req.body.topicsCovered.split(',').map(topic => topic.trim()) : [],
            teachingMethods: req.body.teachingMethods ? req.body.teachingMethods.split(',').map(method => method.trim()) : [],
            status: 'completed',
            submittedBy: req.user.id,
            submissionDate: new Date()
        };

        const updatedVisit = await Visit.findByIdAndUpdate(
            req.params.id, 
            reportData, 
            { new: true, runValidators: true }
        )
        .populate('school')
        .populate('team')
        .populate('submittedBy', 'name');

        res.status(200).json({
            success: true,
            data: updatedVisit
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get visit gallery (photos and videos)
// @route   GET /api/visits/:id/gallery
// @access  Private
exports.getVisitGallery = async (req, res, next) => {
    try {
        const visit = await Visit.findById(req.params.id)
            .select('photos videos school date')
            .populate('school', 'name');

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                photos: visit.photos || [],
                videos: visit.videos || [],
                school: visit.school,
                date: visit.date
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};