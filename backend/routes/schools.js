const express = require('express');
const {
    getSchools,
    getSchool,
    createSchool,
    updateSchool
} = require('../controllers/schoolController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getSchools);
router.get('/:id', protect, getSchool);
router.post('/', protect, createSchool);
router.put('/:id', protect, updateSchool);
router.delete('/:id', protect, require('../controllers/schoolController').deleteSchool);

module.exports = router;