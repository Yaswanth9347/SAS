const express = require('express');
const {
    getSchools,
    getSchool,
    createSchool,
    updateSchool
} = require('../controllers/schoolController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getSchools);
router.get('/:id', protect, getSchool);
router.post('/', protect, authorize('admin'), createSchool);
router.put('/:id', protect, authorize('admin'), updateSchool);

module.exports = router;