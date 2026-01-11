const express = require('express');
const debugUpload = require('../middleware/debugUpload');
const { hybridUploadAny } = require('../middleware/hybridUpload');
const { 
    enforceFileSizeLimits, 
    logFileStatistics, 
    checkTotalUploadSize 
} = require('../middleware/fileSizeEnforcement');
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
    getAllGalleryMedia,
    updateVisit,
    deleteVisit,
    deleteMedia
} = require('../controllers/visitController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getVisits);
router.get('/stats', protect, getVisitStats);
router.get('/gallery/all', protect, getAllGalleryMedia); // Must be BEFORE /:id routes
router.get('/:id', protect, getVisit);
router.get('/:id/gallery', protect, getVisitGallery);
router.post('/', protect, createVisit); // Both admin and volunteers can create visits
router.post(
    '/:id/upload', 
    protect, 
    debugUpload, 
    hybridUploadAny, 
    enforceFileSizeLimits, 
    logFileStatistics, 
    checkTotalUploadSize(), 
    handleFileUpload
);
router.put('/:id/submit', protect, submitVisitReport);
router.put('/:id', protect, updateVisit);
router.delete('/:id', protect, deleteVisit);
router.delete('/:id/media', protect, deleteMedia);
router.put('/:id/complete-report', protect, submitCompleteReport);
router.put('/:id/cancel', protect, cancelVisit); // All users can cancel visits (removed role restriction)

module.exports = router;