const School = require('../models/School');

// @desc    Get all schools
// @route   GET /api/schools
// @access  Private
exports.getSchools = async (req, res, next) => {
    try {
        const schools = await School.find({ isActive: true }).sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: schools.length,
            data: schools
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get single school
// @route   GET /api/schools/:id
// @access  Private
exports.getSchool = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);

        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.status(200).json({
            success: true,
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Create new school
// @route   POST /api/schools
// @access  Private/Admin
exports.createSchool = async (req, res, next) => {
    try {
        const school = await School.create(req.body);

        res.status(201).json({
            success: true,
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update school
// @route   PUT /api/schools/:id
// @access  Private/Admin
exports.updateSchool = async (req, res, next) => {
    try {
        const school = await School.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );

        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.status(200).json({
            success: true,
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Delete school (soft delete)
// @route   DELETE /api/schools/:id
// @access  Private/Admin
exports.deleteSchool = async (req, res, next) => {
    try {
        const school = await School.findByIdAndUpdate(
            req.params.id, 
            { isActive: false }, 
            { new: true }
        );

        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'School deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};