const express = require('express');
const {
    getVisits,
    getVisit,
    createVisit,
    submitVisitReport,
    getVisitStats,
    cancelVisit,
    uploadVisitFiles,
    handleFileUpload,
    submitCompleteReport,
    getVisitGallery
} = require('../controllers/visitController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getVisits);
router.get('/stats', protect, getVisitStats);
router.get('/:id', protect, getVisit);
router.get('/:id/gallery', protect, getVisitGallery);
router.post('/', protect, authorize('admin'), createVisit);
router.post('/:id/upload', protect, uploadVisitFiles, handleFileUpload);
router.put('/:id/submit', protect, submitVisitReport);
router.put('/:id/complete-report', protect, submitCompleteReport);
router.put('/:id/cancel', protect, authorize('admin'), cancelVisit);

module.exports = router;