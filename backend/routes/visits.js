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
    getVisitGallery,
    updateVisit,
    deleteVisit,
    deleteMedia
} = require('../controllers/visitController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getVisits);
router.get('/stats', protect, getVisitStats);
router.get('/:id', protect, getVisit);
router.get('/:id/gallery', protect, getVisitGallery);
router.post('/', protect, createVisit);
router.post('/:id/upload', protect, uploadVisitFiles, handleFileUpload);
router.put('/:id/submit', protect, submitVisitReport);
router.put('/:id', protect, updateVisit);
router.delete('/:id', protect, deleteVisit);
router.delete('/:id/media', protect, deleteMedia);
router.put('/:id/complete-report', protect, submitCompleteReport);
router.put('/:id/cancel', protect, cancelVisit);

module.exports = router;