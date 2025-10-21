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
            // Volunteers can only see visits assigned to their team
            if (!req.user.team) {
                return res.status(200).json({
                    success: true,
                    count: 0,
                    data: [],
                    message: 'User is not assigned to any team'
                });
            }
            query = Visit.find({ team: req.user.team });
        } else if (req.user.role === 'admin') {
            // Admins can see all visits across all teams
            query = Visit.find();
        } else {
            // Fallback for any other roles
            query = Visit.find();
        }

        // Apply status filter if provided
        if (status && ['scheduled', 'completed', 'cancelled'].includes(status)) {
            query = query.where('status').equals(status);
        }

        // Apply date filter if provided
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            query = query.where('date').gte(startDate).lte(endDate);
        }

        const visits = await query
            .populate('school', 'name address contactPerson')
            .populate('team', 'name')
            .populate('submittedBy', 'name role')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: visits.length,
            data: visits
        });
    } catch (error) {
        console.error('Error in getVisits:', error);
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
            .populate('school', 'name address contactPerson')
            .populate('team', 'name')
            .populate('submittedBy', 'name email role');

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // Check if volunteer has access to this visit (must be for their team)
        if (req.user.role === 'volunteer') {
            if (!req.user.team) {
                return res.status(403).json({
                    success: false,
                    message: 'User is not assigned to any team'
                });
            }
            if (!req.user.team.equals(visit.team._id)) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to view this visit'
                });
            }
        }
        // Admins can view all visits, so no additional check needed

        res.status(200).json({
            success: true,
            data: visit
        });
    } catch (error) {
        console.error('Error in getVisit:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Create new visit
// @route   POST /api/visits
// @access  Private (Both admin and volunteer with appropriate validation)
const mongoose = require('mongoose');

exports.createVisit = async (req, res, next) => {
    try {
        // Validate required fields
        if (!req.body.team || !mongoose.Types.ObjectId.isValid(req.body.team)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing team ID' });
        }
        if (!req.body.school || !mongoose.Types.ObjectId.isValid(req.body.school)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing school ID' });
        }
        if (!req.body.date) {
            return res.status(400).json({ success: false, message: 'Visit date is required' });
        }
        if (!req.body.assignedClass) {
            return res.status(400).json({ success: false, message: 'Assigned class is required' });
        }

        // Ensure referenced team and school exist
        const teamExists = await Team.findById(req.body.team).select('_id name');
        if (!teamExists) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }
        
        const schoolExists = await School.findById(req.body.school).select('_id name');
        if (!schoolExists) {
            return res.status(404).json({ success: false, message: 'School not found' });
        }

        // For volunteer users, ensure they're creating visits only for their own team
        if (req.user.role === 'volunteer') {
            if (!req.user.team) {
                return res.status(403).json({
                    success: false, 
                    message: 'User is not assigned to any team'
                });
            }
            if (!req.user.team.equals(req.body.team)) {
                return res.status(403).json({
                    success: false, 
                    message: 'Volunteers can only create visits for their own team'
                });
            }
        }

        // Check if team is available on that date (prevent double booking)
        const visitDate = new Date(req.body.date);
        const startOfDay = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
        const endOfDay = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate(), 23, 59, 59);
        
        const existingVisit = await Visit.findOne({
            team: req.body.team,
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ['scheduled', 'completed'] }
        });

        if (existingVisit) {
            return res.status(400).json({
                success: false,
                message: 'Team already has a visit scheduled on this date'
            });
        }

        // Create the visit with proper default values
        const visitData = {
            ...req.body,
            status: req.body.status || 'scheduled', // Ensure default status
            submittedBy: req.user.id, // Track who created the visit
            childrenCount: req.body.childrenCount || 30, // Default expected children
            totalClasses: req.body.totalClasses || 1, // Default total classes
            classesVisited: req.body.classesVisited || 0 // Default classes visited
        };
        
        const visit = await Visit.create(visitData);

        // Populate the created visit for response
        const populatedVisit = await Visit.findById(visit._id)
            .populate('school', 'name address contactPerson')
            .populate('team', 'name')
            .populate('submittedBy', 'name role');

        res.status(201).json({
            success: true,
            data: populatedVisit,
            message: `Visit created successfully and assigned to ${teamExists.name}`
        });
    } catch (error) {
        console.error('Error in createVisit:', error);
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
        
        // Apply role-based filtering
        if (req.user.role === 'volunteer') {
            if (!req.user.team) {
                return res.status(200).json({
                    success: true,
                    data: {
                        totalVisits: 0,
                        completedVisits: 0,
                        scheduledVisits: 0,
                        cancelledVisits: 0,
                        totalChildren: 0,
                        averageChildren: 0,
                        monthlyStats: []
                    },
                    message: 'User is not assigned to any team'
                });
            }
            matchQuery.team = req.user.team;
        }
        // Admin can see all stats, so no additional filter needed

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
                    cancelledVisits: { 
                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } 
                    },
                    totalChildren: { $sum: '$childrenCount' },
                    averageChildren: { $avg: '$childrenCount' }
                }
            }
        ]);

        // Get monthly stats for the last 6 months
        const monthlyStats = await Visit.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    visits: { $sum: 1 },
                    children: { $sum: '$childrenCount' },
                    completedVisits: { 
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
                    }
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
                    cancelledVisits: 0,
                    totalChildren: 0,
                    averageChildren: 0
                }),
                monthlyStats
            }
        });
    } catch (error) {
        console.error('Error in getVisitStats:', error);
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
        console.log('HandleFileUpload received files:', req.files);
        console.log('HandleFileUpload received body:', req.body);
        
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            // Clean up uploaded files if visit doesn't exist
            if (req.files) {
                if (Array.isArray(req.files)) {
                    // Handle array of files from multer.any()
                    req.files.forEach(file => {
                        try { fs.unlinkSync(file.path); } catch (e) { console.error('Error deleting file:', e); }
                    });
                } else {
                    // Handle object of file arrays from multer.fields()
                    Object.values(req.files).forEach(files => {
                        files.forEach(file => {
                            try { fs.unlinkSync(file.path); } catch (e) { console.error('Error deleting file:', e); }
                        });
                    });
                }
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
                if (Array.isArray(req.files)) {
                    // Handle array of files from multer.any()
                    req.files.forEach(file => {
                        try { fs.unlinkSync(file.path); } catch (e) { console.error('Error deleting file:', e); }
                    });
                } else {
                    // Handle object of file arrays from multer.fields()
                    Object.values(req.files).forEach(files => {
                        files.forEach(file => {
                            try { fs.unlinkSync(file.path); } catch (e) { console.error('Error deleting file:', e); }
                        });
                    });
                }
            }
            return res.status(403).json({
                success: false,
                message: 'Not authorized to upload files for this visit'
            });
        }

        const fileUrls = {
            photos: [],
            videos: [],
            docs: []
        };

        // Process uploaded files - handle both multer.any() and multer.fields()
        if (req.files) {
            if (Array.isArray(req.files)) {
                // Handle files from multer.any()
                const photoFiles = req.files.filter(file => file.fieldname === 'photos');
                const videoFiles = req.files.filter(file => file.fieldname === 'videos');
                const docFiles = req.files.filter(file => file.fieldname === 'docs');
                
                if (photoFiles.length > 0) {
                    const urls = photoFiles.map(file => `/uploads/${visit._id}/${path.basename(file.filename)}`);
                    fileUrls.photos = urls;
                    visit.photos = (visit.photos || []).concat(urls);
                }
                
                if (videoFiles.length > 0) {
                    const urls = videoFiles.map(file => `/uploads/${visit._id}/${path.basename(file.filename)}`);
                    fileUrls.videos = urls;
                    visit.videos = (visit.videos || []).concat(urls);
                }
                
                if (docFiles.length > 0) {
                    const urls = docFiles.map(file => `/uploads/${visit._id}/${path.basename(file.filename)}`);
                    fileUrls.docs = urls;
                    visit.docs = (visit.docs || []).concat(urls);
                }
            } else {
                // Handle files from multer.fields()
                if (req.files.photos) {
                    const urls = req.files.photos.map(file => `/uploads/${visit._id}/${path.basename(file.filename)}`);
                    fileUrls.photos = urls;
                    visit.photos = (visit.photos || []).concat(urls);
                }
                if (req.files.videos) {
                    const urls = req.files.videos.map(file => `/uploads/${visit._id}/${path.basename(file.filename)}`);
                    fileUrls.videos = urls;
                    visit.videos = (visit.videos || []).concat(urls);
                }
                if (req.files.docs) {
                    const urls = req.files.docs.map(file => `/uploads/${visit._id}/${path.basename(file.filename)}`);
                    fileUrls.docs = urls;
                    visit.docs = (visit.docs || []).concat(urls);
                }
            }
            // persist visit with new media
            await visit.save();
        }

        res.status(200).json({
            success: true,
            data: fileUrls
        });
    } catch (error) {
        // Clean up files on error
        if (req.files) {
            if (Array.isArray(req.files)) {
                // Handle array of files from multer.any()
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        try { fs.unlinkSync(file.path); } catch (e) { console.error('Error deleting file:', e); }
                    }
                });
            } else {
                // Handle object of file arrays from multer.fields()
                Object.values(req.files).forEach(files => {
                    files.forEach(file => {
                        if (fs.existsSync(file.path)) {
                            try { fs.unlinkSync(file.path); } catch (e) { console.error('Error deleting file:', e); }
                        }
                    });
                });
            }
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

// @desc    Update visit
// @route   PUT /api/visits/:id
// @access  Private
exports.updateVisit = async (req, res, next) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

        // basic auth: volunteers can only update their team visits
        if (req.user.role === 'volunteer' && !req.user.team.equals(visit.team)) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this visit' });
        }

        // If team or school are provided in update, validate them
        if (req.body.team && !mongoose.Types.ObjectId.isValid(req.body.team)) {
            return res.status(400).json({ success: false, message: 'Invalid team id' });
        }
        if (req.body.school && !mongoose.Types.ObjectId.isValid(req.body.school)) {
            return res.status(400).json({ success: false, message: 'Invalid school id' });
        }
        if (req.body.team) {
            const teamExists = await Team.findById(req.body.team).select('_id');
            if (!teamExists) return res.status(404).json({ success: false, message: 'Team not found' });
        }
        if (req.body.school) {
            const schoolExists = await School.findById(req.body.school).select('_id');
            if (!schoolExists) return res.status(404).json({ success: false, message: 'School not found' });
        }

        const updated = await Visit.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
            .populate('school')
            .populate('team')
            .populate('submittedBy', 'name');

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete visit
// @route   DELETE /api/visits/:id
// @access  Private
exports.deleteVisit = async (req, res, next) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

        // basic auth: volunteers only allowed to delete their own team's visits
        if (req.user.role === 'volunteer' && !req.user.team.equals(visit.team)) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this visit' });
        }

        // delete upload directory if exists
        const uploadDir = path.join(__dirname, '../uploads', String(visit._id));
        if (fs.existsSync(uploadDir)) {
            fs.rmSync(uploadDir, { recursive: true, force: true });
        }

        await Visit.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: 'Visit deleted' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete a media URL from visit (photos/videos/docs)
// @route   DELETE /api/visits/:id/media
// @access  Private
exports.deleteMedia = async (req, res, next) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: 'Media url required' });
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

        // auth check
        if (req.user.role === 'volunteer' && !req.user.team.equals(visit.team)) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete media for this visit' });
        }

        const removeFrom = (arr) => {
            if (!arr) return false;
            const idx = arr.indexOf(url);
            if (idx === -1) return false;
            arr.splice(idx, 1);
            return true;
        };

        let removed = removeFrom(visit.photos) || removeFrom(visit.videos) || removeFrom(visit.docs);
        if (!removed) return res.status(404).json({ success: false, message: 'Media not found on visit' });

        // delete file on disk
        const filename = path.basename(url);
        const filePath = path.join(__dirname, '../uploads', String(visit._id), filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await visit.save();

        res.status(200).json({ success: true, message: 'Media removed' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};