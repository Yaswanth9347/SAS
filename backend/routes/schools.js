const express = require('express');
const {
    getSchools,
    getSchool,
    createSchool,
    updateSchool
} = require('../controllers/schoolController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// View routes - all authenticated users can view schools
router.get('/', protect, getSchools);
router.get('/:id', protect, getSchool);

// Modify routes - admin only
router.post('/', protect, adminOnly, createSchool);
router.put('/:id', protect, adminOnly, updateSchool);
router.delete('/:id', protect, adminOnly, require('../controllers/schoolController').deleteSchool);

module.exports = router;
