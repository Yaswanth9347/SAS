const express = require('express');
const {
    getSchools,
    getSchool,
    createSchool,
    updateSchool,
    deleteSchool,
    addContactPerson,
    updateContactPerson,
    deleteContactPerson,
    addContactHistory,
    updateContactHistory,
    deleteContactHistory,
    addRating,
    updateRating,
    deleteRating,
    updateAvailability,
    checkAvailability,
    getFollowUps,
    getSchoolStats
} = require('../controllers/schoolController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Basic CRUD routes
router.get('/', protect, getSchools);
router.get('/:id', protect, getSchool);
router.post('/', protect, adminOnly, createSchool);
router.put('/:id', protect, adminOnly, updateSchool);
router.delete('/:id', protect, adminOnly, deleteSchool);

// Contact Persons routes
router.post('/:id/contacts', protect, adminOnly, addContactPerson);
router.put('/:id/contacts/:contactId', protect, adminOnly, updateContactPerson);
router.delete('/:id/contacts/:contactId', protect, adminOnly, deleteContactPerson);

// Contact History routes
router.post('/:id/contact-history', protect, addContactHistory);
router.put('/:id/contact-history/:historyId', protect, updateContactHistory);
router.delete('/:id/contact-history/:historyId', protect, adminOnly, deleteContactHistory);

// Ratings routes
router.post('/:id/ratings', protect, addRating);
router.put('/:id/ratings/:ratingId', protect, updateRating);
router.delete('/:id/ratings/:ratingId', protect, deleteRating);

// Availability routes
router.put('/:id/availability', protect, adminOnly, updateAvailability);
router.get('/:id/check-availability', protect, checkAvailability);

// Statistics and Follow-ups
router.get('/:id/follow-ups', protect, getFollowUps);
router.get('/:id/stats', protect, getSchoolStats);

module.exports = router;
