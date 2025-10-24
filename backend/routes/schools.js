const express = require('express');
const {
    getSchools,
    getSchool,
    createSchool,
    updateSchool
} = require('../controllers/schoolController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All school routes require admin access
router.get('/', protect, adminOnly, getSchools);
router.get('/:id', protect, adminOnly, getSchool);
router.post('/', protect, adminOnly, createSchool);
router.put('/:id', protect, adminOnly, updateSchool);
router.delete('/:id', protect, adminOnly, require('../controllers/schoolController').deleteSchool);

module.exports = router;