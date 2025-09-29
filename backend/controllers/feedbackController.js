const Visit = require('../models/Visit');

// @desc    Submit school feedback for a visit
// @route   POST /api/feedback/visit/:id
// @access  Public (special token or via admin)
exports.submitSchoolFeedback = async (req, res, next) => {
    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        if (visit.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Feedback can only be submitted for completed visits'
            });
        }

        const feedbackData = {
            feedbackFromSchool: {
                rating: req.body.rating,
                comments: req.body.comments,
                submittedBy: req.body.submittedBy,
                contactInfo: req.body.contactInfo,
                submittedDate: new Date()
            }
        };

        const updatedVisit = await Visit.findByIdAndUpdate(
            req.params.id,
            feedbackData,
            { new: true, runValidators: true }
        ).populate('school team');

        res.status(200).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: updatedVisit
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get feedback statistics
// @route   GET /api/feedback/stats
// @access  Private/Admin
exports.getFeedbackStats = async (req, res, next) => {
    try {
        const feedbackStats = await Visit.aggregate([
            { 
                $match: { 
                    'feedbackFromSchool.rating': { $exists: true } 
                } 
            },
            {
                $group: {
                    _id: null,
                    totalFeedback: { $sum: 1 },
                    averageRating: { $avg: '$feedbackFromSchool.rating' },
                    ratingDistribution: {
                        $push: '$feedbackFromSchool.rating'
                    }
                }
            }
        ]);

        // Rating distribution
        const ratingDistribution = await Visit.aggregate([
            { 
                $match: { 
                    'feedbackFromSchool.rating': { $exists: true } 
                } 
            },
            {
                $group: {
                    _id: '$feedbackFromSchool.rating',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Recent feedback
        const recentFeedback = await Visit.find({
            'feedbackFromSchool.rating': { $exists: true }
        })
        .populate('school', 'name')
        .populate('team', 'name')
        .sort({ 'feedbackFromSchool.submittedDate': -1 })
        .limit(10)
        .select('school team date feedbackFromSchool');

        res.status(200).json({
            success: true,
            data: {
                overview: feedbackStats[0] || { totalFeedback: 0, averageRating: 0 },
                ratingDistribution,
                recentFeedback
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};