const School = require('../models/School');
const Visit = require('../models/Visit');

// @desc    Get all schools
// @route   GET /api/schools
// @access  Private
exports.getSchools = async (req, res, next) => {
    try {
        const { city, isActive, hasAvailability } = req.query;
        
        let query = {};
        
        // Filter by active status (default to true)
        query.isActive = isActive !== undefined ? isActive === 'true' : true;
        
        // Filter by city
        if (city) {
            query['address.city'] = new RegExp(city, 'i');
        }
        
        // Filter schools with availability
        if (hasAvailability === 'true') {
            query['availability.preferredDays'] = { $exists: true, $ne: [] };
        }
        
        const schools = await School.find(query)
            .populate('contactHistory.contactedBy', 'name email')
            .populate('ratings.ratedBy', 'name')
            .sort({ name: 1 });

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
        const school = await School.findById(req.params.id)
            .populate('contactHistory.contactedBy', 'name email role')
            .populate('ratings.ratedBy', 'name email')
            .populate('ratings.visitId', 'date status');

        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Get visit statistics
        const visits = await Visit.find({ school: req.params.id });
        school.stats.totalVisits = visits.length;
        school.stats.completedVisits = visits.filter(v => v.status === 'completed').length;
        school.stats.cancelledVisits = visits.filter(v => v.status === 'cancelled').length;
        
        if (visits.length > 0) {
            const completedVisits = visits.filter(v => v.status === 'completed');
            if (completedVisits.length > 0) {
                school.stats.lastVisitDate = completedVisits.sort((a, b) => b.date - a.date)[0].date;
            }
        }
        
        await school.save();

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

// @desc    Add contact person to school
// @route   POST /api/schools/:id/contacts
// @access  Private/Admin
exports.addContactPerson = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // If this is set as primary, remove primary from others
        if (req.body.isPrimary) {
            school.contactPersons.forEach(contact => {
                contact.isPrimary = false;
            });
        }

        school.contactPersons.push(req.body);
        await school.save();

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

// @desc    Update contact person
// @route   PUT /api/schools/:id/contacts/:contactId
// @access  Private/Admin
exports.updateContactPerson = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const contact = school.contactPersons.id(req.params.contactId);
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact person not found'
            });
        }

        // If setting as primary, remove primary from others
        if (req.body.isPrimary) {
            school.contactPersons.forEach(c => {
                if (c._id.toString() !== req.params.contactId) {
                    c.isPrimary = false;
                }
            });
        }

        Object.assign(contact, req.body);
        await school.save();

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

// @desc    Delete contact person
// @route   DELETE /api/schools/:id/contacts/:contactId
// @access  Private/Admin
exports.deleteContactPerson = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        school.contactPersons.pull(req.params.contactId);
        await school.save();

        res.status(200).json({
            success: true,
            message: 'Contact person deleted successfully',
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Add contact history entry
// @route   POST /api/schools/:id/contact-history
// @access  Private
exports.addContactHistory = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const contactData = {
            ...req.body,
            contactedBy: req.user.id
        };

        await school.addContactHistory(contactData);

        res.status(201).json({
            success: true,
            message: 'Contact history added successfully',
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update contact history entry
// @route   PUT /api/schools/:id/contact-history/:historyId
// @access  Private
exports.updateContactHistory = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const history = school.contactHistory.id(req.params.historyId);
        if (!history) {
            return res.status(404).json({
                success: false,
                message: 'Contact history entry not found'
            });
        }

        Object.assign(history, req.body);
        await school.save();

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

// @desc    Delete contact history entry
// @route   DELETE /api/schools/:id/contact-history/:historyId
// @access  Private/Admin
exports.deleteContactHistory = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        school.contactHistory.pull(req.params.historyId);
        await school.save();

        res.status(200).json({
            success: true,
            message: 'Contact history deleted successfully',
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Add school rating
// @route   POST /api/schools/:id/ratings
// @access  Private
exports.addRating = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const ratingData = {
            ...req.body,
            ratedBy: req.user.id
        };

        await school.addRating(ratingData);

        res.status(201).json({
            success: true,
            message: 'Rating added successfully',
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update school rating
// @route   PUT /api/schools/:id/ratings/:ratingId
// @access  Private
exports.updateRating = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const rating = school.ratings.id(req.params.ratingId);
        if (!rating) {
            return res.status(404).json({
                success: false,
                message: 'Rating not found'
            });
        }

        // Only the person who created the rating or admin can update
        if (rating.ratedBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this rating'
            });
        }

        Object.assign(rating, req.body);
        
        // Recalculate average rating
        const totalRatings = school.ratings.reduce((sum, r) => {
            const avg = (
                (r.cooperation || 0) + 
                (r.facilities || 0) + 
                (r.studentEngagement || 0) + 
                (r.overallExperience || 0)
            ) / 4;
            return sum + avg;
        }, 0);
        
        school.stats.averageRating = (totalRatings / school.ratings.length).toFixed(2);
        
        await school.save();

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

// @desc    Delete school rating
// @route   DELETE /api/schools/:id/ratings/:ratingId
// @access  Private
exports.deleteRating = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const rating = school.ratings.id(req.params.ratingId);
        if (!rating) {
            return res.status(404).json({
                success: false,
                message: 'Rating not found'
            });
        }

        // Only the person who created the rating or admin can delete
        if (rating.ratedBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this rating'
            });
        }

        school.ratings.pull(req.params.ratingId);
        
        // Recalculate average rating
        if (school.ratings.length > 0) {
            const totalRatings = school.ratings.reduce((sum, r) => {
                const avg = (
                    (r.cooperation || 0) + 
                    (r.facilities || 0) + 
                    (r.studentEngagement || 0) + 
                    (r.overallExperience || 0)
                ) / 4;
                return sum + avg;
            }, 0);
            school.stats.averageRating = (totalRatings / school.ratings.length).toFixed(2);
        } else {
            school.stats.averageRating = 0;
        }
        
        await school.save();

        res.status(200).json({
            success: true,
            message: 'Rating deleted successfully',
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update school availability
// @route   PUT /api/schools/:id/availability
// @access  Private/Admin
exports.updateAvailability = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        school.availability = {
            ...school.availability,
            ...req.body
        };

        await school.save();

        res.status(200).json({
            success: true,
            message: 'Availability updated successfully',
            data: school
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Check school availability for a date
// @route   GET /api/schools/:id/check-availability
// @access  Private
exports.checkAvailability = async (req, res, next) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a date'
            });
        }

        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const availability = school.isAvailableOn(date);

        res.status(200).json({
            success: true,
            data: {
                date: date,
                ...availability,
                schoolName: school.name
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get pending follow-ups for a school
// @route   GET /api/schools/:id/follow-ups
// @access  Private
exports.getFollowUps = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id)
            .populate('contactHistory.contactedBy', 'name email');
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const followUps = school.contactHistory.filter(contact => 
            contact.followUpDate && 
            !contact.followUpCompleted &&
            new Date(contact.followUpDate) >= new Date()
        ).sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));

        res.status(200).json({
            success: true,
            count: followUps.length,
            data: followUps
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get school statistics
// @route   GET /api/schools/:id/stats
// @access  Private
exports.getSchoolStats = async (req, res, next) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Get detailed visit statistics
        const visits = await Visit.find({ school: req.params.id })
            .populate('team', 'name')
            .sort({ date: -1 });

        const stats = {
            basic: school.stats,
            visits: {
                total: visits.length,
                completed: visits.filter(v => v.status === 'completed').length,
                scheduled: visits.filter(v => v.status === 'scheduled').length,
                cancelled: visits.filter(v => v.status === 'cancelled').length,
                recent: visits.slice(0, 5)
            },
            ratings: {
                count: school.ratings.length,
                average: school.stats.averageRating,
                distribution: {
                    cooperation: school.ratings.reduce((sum, r) => sum + (r.cooperation || 0), 0) / (school.ratings.length || 1),
                    facilities: school.ratings.reduce((sum, r) => sum + (r.facilities || 0), 0) / (school.ratings.length || 1),
                    studentEngagement: school.ratings.reduce((sum, r) => sum + (r.studentEngagement || 0), 0) / (school.ratings.length || 1),
                    overallExperience: school.ratings.reduce((sum, r) => sum + (r.overallExperience || 0), 0) / (school.ratings.length || 1)
                }
            },
            contactHistory: {
                total: school.contactHistory.length,
                recent: school.contactHistory.slice(0, 5),
                byType: {
                    call: school.contactHistory.filter(c => c.type === 'call').length,
                    email: school.contactHistory.filter(c => c.type === 'email').length,
                    visit: school.contactHistory.filter(c => c.type === 'visit').length,
                    meeting: school.contactHistory.filter(c => c.type === 'meeting').length
                },
                pendingFollowUps: school.contactHistory.filter(c => 
                    c.followUpDate && !c.followUpCompleted && new Date(c.followUpDate) >= new Date()
                ).length
            }
        };

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};