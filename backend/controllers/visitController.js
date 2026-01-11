const Visit = require('../models/Visit');
const Team = require('../models/Team');
const School = require('../models/School');
const { optimizePhoto, generateThumbnail } = require('../utils/imageOptimizer');

// @desc    Get all visits
// @route   GET /api/visits
// @access  Private
exports.getVisits = async (req, res, next) => {
    try {
        let query;
        const { status, month, year, team } = req.query;

        // All users can see all visits (removed role-based restrictions)
        query = Visit.find();

        // Apply team filter if provided
        if (team) {
            query = query.where('team').equals(team);
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

        // All authenticated users can view all visits (removed role-based restrictions)

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

        // All users can create visits for any team (removed role-based restrictions)

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
        // Notify team members about scheduled visit
        try {
            const populatedTeam = await Team.findById(visit.team).populate('members', '_id');
            const memberIds = (populatedTeam?.members || []).map(m => m._id);
            if (memberIds.length > 0) {
                const { notifyUsers } = require('../utils/notificationService');
                await notifyUsers(memberIds, {
                    title: 'Visit Scheduled',
                    message: `A visit has been scheduled on ${new Date(visit.date).toLocaleDateString()}`,
                    type: 'visit',
                    link: `/frontend/visits.html`,
                    meta: { visitId: visit._id, date: visit.date, schoolName: visit.school?.name },
                    emailTemplate: 'visitScheduled'
                });
            }
        } catch (e) { console.warn('Notify visit schedule failed:', e.message); }

        res.status(201).json({
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

        // All users can submit reports (removed role-based restrictions)

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

        // All users can see all statistics (removed role-based restrictions)

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
const { processUploadedFiles } = require('../utils/fileProcessing');
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
            // Clean up uploaded files (both Cloudinary and local)
            if (req.files) {
                const { deleteUploadedFile } = require('../middleware/hybridUpload');
                const filesToDelete = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
                
                for (const file of filesToDelete) {
                    try { 
                        await deleteUploadedFile(file); 
                    } catch (e) { 
                        console.error('Error deleting file:', e); 
                    }
                }
            }
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // All users can upload files (removed role-based restrictions)

        const fileData = {
            photos: [],
            videos: [],
            docs: []
        };

        // Process uploaded files with enhanced metadata (Hybrid Approach)
        if (req.files) {
            if (Array.isArray(req.files)) {
                // Handle files from multer.any()
                const photoFiles = req.files.filter(file => file.fieldname === 'photos');
                const videoFiles = req.files.filter(file => file.fieldname === 'videos');
                const docFiles = req.files.filter(file => file.fieldname === 'docs');

                if (photoFiles.length > 0) {
                    const processedPhotos = await processUploadedFiles(photoFiles, 'photos');
                    fileData.photos = processedPhotos;
                    visit.photos = (visit.photos || []).concat(processedPhotos);
                }

                if (videoFiles.length > 0) {
                    const processedVideos = await processUploadedFiles(videoFiles, 'videos');
                    fileData.videos = processedVideos;
                    visit.videos = (visit.videos || []).concat(processedVideos);
                }

                if (docFiles.length > 0) {
                    const processedDocs = await processUploadedFiles(docFiles, 'docs');
                    fileData.docs = processedDocs;
                    visit.docs = (visit.docs || []).concat(processedDocs);
                }
            } else {
                // Handle files from multer.fields()
                if (req.files.photos) {
                    const processedPhotos = await processUploadedFiles(req.files.photos, 'photos');
                    fileData.photos = processedPhotos;
                    visit.photos = (visit.photos || []).concat(processedPhotos);
                }
                if (req.files.videos) {
                    const processedVideos = await processUploadedFiles(req.files.videos, 'videos');
                    fileData.videos = processedVideos;
                    visit.videos = (visit.videos || []).concat(processedVideos);
                }
                if (req.files.docs) {
                    const processedDocs = await processUploadedFiles(req.files.docs, 'docs');
                    fileData.docs = processedDocs;
                    visit.docs = (visit.docs || []).concat(processedDocs);
                }
            }
            // persist visit with new media metadata
            await visit.save();
        }

        res.status(200).json({
            success: true,
            data: fileData,
            message: 'Files uploaded successfully with metadata'
        });
    } catch (error) {
        console.error('File upload error:', error);
        
        // Clean up uploaded files on error (both Cloudinary and local)
        if (req.files) {
            const { deleteUploadedFile } = require('../middleware/hybridUpload');
            const filesToDelete = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
            
            for (const file of filesToDelete) {
                try { 
                    await deleteUploadedFile(file); 
                } catch (e) { 
                    console.error('Error deleting file:', e); 
                }
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

        // All users can submit reports (removed role-based restrictions)

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

// @desc    Get all gallery media from all visits
// @route   GET /api/visits/gallery/all
// @access  Private
exports.getAllGalleryMedia = async (req, res, next) => {
    try {
        const { team, school, startDate, endDate, limit = 500 } = req.query;

        // Build filter query - REMOVED status filter to show all media regardless of visit status
        const filter = {};

        if (team) filter.team = team;
        if (school) filter.school = school;
        if (startDate && endDate) {
            filter.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        console.log('📊 Gallery filter:', filter);

        // Get visits with media - select all visits that might have media
        const visits = await Visit.find(filter)
            .select('photos videos docs documents school team date status')
            .populate('school', 'name')
            .populate('team', 'name')
            .sort('-date')
            .limit(parseInt(limit));

        console.log(`📸 Found ${visits.length} visits total`);

        // Flatten all media into a single array
        const allMedia = [];

        visits.forEach(visit => {
            console.log(`🔍 Visit ${visit._id} (${visit.status}): ${visit.photos?.length || 0} photos, ${visit.videos?.length || 0} videos, ${visit.docs?.length || 0} docs`);

            // Add photos
            if (visit.photos && visit.photos.length > 0) {
                visit.photos.forEach(photo => {
                    // Handle both string URLs and object formats
                    const photoUrl = typeof photo === 'string' ? photo : (photo.path || photo.url || photo);
                    if (photoUrl) {
                        allMedia.push({
                            type: 'photo',
                            url: photoUrl,
                            visitId: visit._id,
                            visitDate: visit.date,
                            school: visit.school,
                            team: visit.team
                        });
                        console.log('  ✅ Added photo:', photoUrl);
                    }
                });
            }

            // Add videos
            if (visit.videos && visit.videos.length > 0) {
                visit.videos.forEach(video => {
                    const videoUrl = typeof video === 'string' ? video : (video.path || video.url || video);
                    if (videoUrl) {
                        allMedia.push({
                            type: 'video',
                            url: videoUrl,
                            visitId: visit._id,
                            visitDate: visit.date,
                            school: visit.school,
                            team: visit.team
                        });
                        console.log('  ✅ Added video:', videoUrl);
                    }
                });
            }

            // Add documents (check both 'docs' and 'documents' fields)
            const docsList = visit.docs || visit.documents || [];
            if (docsList.length > 0) {
                docsList.forEach(doc => {
                    const docUrl = typeof doc === 'string' ? doc : (doc.path || doc.url || doc);
                    if (docUrl) {
                        allMedia.push({
                            type: 'doc',
                            url: docUrl,
                            name: docUrl.split('/').pop(), // Extract filename
                            visitId: visit._id,
                            visitDate: visit.date,
                            school: visit.school,
                            team: visit.team
                        });
                        console.log('  ✅ Added doc:', docUrl);
                    }
                });
            }
        });

        console.log(`✨ Total media items: ${allMedia.length}`);

        res.status(200).json({
            success: true,
            count: allMedia.length,
            data: allMedia
        });
    } catch (error) {
        console.error('❌ Gallery error:', error);
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

        // All users can update all visits (removed role-based restrictions)

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

        // All users can delete all visits (removed role-based restrictions)

        // Delete all associated files from storage (Cloudinary or Local)
        const { isCloudinaryConfigured, extractPublicId, getResourceType, deleteFromCloudinary } = require('../config/cloudinary');
        
        if (isCloudinaryConfigured()) {
            console.log('🌥️  Deleting visit files from Cloudinary...');
            
            // Collect all media items
            const allMedia = [
                ...(visit.photos || []),
                ...(visit.videos || []),
                ...(visit.docs || [])
            ];
            
            // Delete each file from Cloudinary
            for (const media of allMedia) {
                try {
                    const url = typeof media === 'string' ? media : (media.path || media.cloudUrl);
                    
                    if (url && url.includes('cloudinary.com')) {
                        const publicId = extractPublicId(url);
                        if (publicId) {
                            const resourceType = getResourceType(url);
                            await deleteFromCloudinary(publicId, resourceType);
                            console.log(`✅ Deleted from Cloudinary: ${publicId}`);
                        }
                    }
                } catch (deleteError) {
                    console.error('Error deleting file from Cloudinary:', deleteError);
                    // Continue with other files
                }
            }
        } else {
            // Delete local upload directory if exists
            console.log('💾 Deleting visit files from local storage...');
            const uploadDir = path.join(__dirname, '../uploads', String(visit._id));
            if (fs.existsSync(uploadDir)) {
                fs.rmSync(uploadDir, { recursive: true, force: true });
                console.log(`✅ Deleted local directory: ${uploadDir}`);
            }
        }

        await Visit.findByIdAndDelete(req.params.id);
        console.log(`✅ Visit ${req.params.id} deleted from database`);

        res.status(200).json({ success: true, message: 'Visit deleted' });
    } catch (error) {
        console.error('Error deleting visit:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete a media URL from visit (photos/videos/docs)
// @route   DELETE /api/visits/:id/media
// @access  Private (Admin only)
exports.deleteMedia = async (req, res, next) => {
    try {
        const { url, type } = req.body;
        console.log('🗑️  Delete request received:', { visitId: req.params.id, url, type, userRole: req.user?.role });
        
        if (!url) return res.status(400).json({ success: false, message: 'Media url required' });
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

        console.log('📊 Visit found:', { 
            photos: visit.photos?.length || 0, 
            videos: visit.videos?.length || 0, 
            docs: visit.docs?.length || 0 
        });

        // Only admin role can delete media
        if (req.user.role !== 'admin') {
            console.log('❌ Access denied: User role is', req.user.role);
            return res.status(403).json({
                success: false,
                message: 'Only administrators can delete media files'
            });
        }

        // Remove from array (handles both string URLs and metadata objects)
        const removeFrom = (arr, arrayName) => {
            if (!arr || !Array.isArray(arr)) {
                console.log(`⚠️  ${arrayName} is not an array or is empty`);
                return { removed: false, fileToDelete: null };
            }
            
            console.log(`🔍 Searching in ${arrayName} (${arr.length} items)`);
            
            // Find index - handle both string and object formats
            const idx = arr.findIndex(item => {
                if (typeof item === 'string') {
                    const match = item === url;
                    console.log(`  - String item: "${item}" ${match ? '✅ MATCH' : '❌'}`);
                    return match;
                }
                if (typeof item === 'object' && item.path) {
                    const match = item.path === url;
                    console.log(`  - Object item path: "${item.path}" ${match ? '✅ MATCH' : '❌'}`);
                    return match;
                }
                console.log(`  - Unknown format:`, item);
                return false;
            });
            
            if (idx === -1) {
                console.log(`❌ Not found in ${arrayName}`);
                return { removed: false, fileToDelete: null };
            }
            
            const item = arr[idx];
            arr.splice(idx, 1);
            console.log(`✅ Removed from ${arrayName} at index ${idx}`);
            return { removed: true, fileToDelete: item };
        };

        // Try to remove from each array type
        let result = removeFrom(visit.photos, 'photos');
        if (!result.removed) {
            result = removeFrom(visit.videos, 'videos');
        }
        if (!result.removed) {
            result = removeFrom(visit.docs, 'docs');
        }
        
        if (!result || !result.removed) {
            console.log('❌ Media not found in any array');
            return res.status(404).json({ success: false, message: 'Media not found on visit' });
        }

        console.log('✅ Media removed from database array');

        // Delete file from storage (Cloudinary or Local)
        try {
            // Check if it's a Cloudinary URL
            if (url.includes('cloudinary.com')) {
                console.log('🌥️  Deleting from Cloudinary...');
                const { extractPublicId, getResourceType, deleteFromCloudinary } = require('../config/cloudinary');
                
                const publicId = extractPublicId(url);
                if (publicId) {
                    const resourceType = getResourceType(url);
                    console.log(`📋 Cloudinary deletion: publicId="${publicId}", resourceType="${resourceType}"`);
                    
                    const cloudResult = await deleteFromCloudinary(publicId, resourceType);
                    console.log('✅ Cloudinary deletion result:', cloudResult);
                } else {
                    console.warn('⚠️  Could not extract Cloudinary public ID from URL');
                }
            } else {
                // Local file deletion
                console.log('💾 Deleting from local storage...');
                const filename = path.basename(url);
                
                // Determine file type from URL or type parameter
                let fileType = type;
                if (!fileType) {
                    if (url.includes('/photos/')) fileType = 'photos';
                    else if (url.includes('/videos/')) fileType = 'videos';
                    else if (url.includes('/docs/')) fileType = 'docs';
                }
                
                console.log(`🗂️  File deletion - Type: ${fileType}, Filename: ${filename}`);
                
                // Try new structure first: uploads/{type}/{visitId}/{filename}
                let filePath = path.join(__dirname, '../uploads', fileType, String(visit._id), filename);
                console.log(`🔍 Checking new structure: ${filePath}`);
                
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`✅ Deleted file: ${filePath}`);
                } else {
                    console.log(`⚠️  File not found in new structure, trying old structure...`);
                    // Fallback to old structure: uploads/{visitId}/{filename}
                    filePath = path.join(__dirname, '../uploads', String(visit._id), filename);
                    console.log(`🔍 Checking old structure: ${filePath}`);
                    
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`✅ Deleted file (old structure): ${filePath}`);
                    } else {
                        console.warn(`⚠️  File not found on disk: ${filename}`);
                    }
                }
            }
        } catch (fileError) {
            console.error('❌ Error deleting file from storage:', fileError);
            // Continue anyway - we still want to remove from DB
        }

        console.log('💾 Saving visit to database...');
        await visit.save();
        console.log('✅ Visit saved successfully');

        res.status(200).json({ success: true, message: 'Media deleted successfully' });
    } catch (error) {
        console.error('❌ Delete media error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};