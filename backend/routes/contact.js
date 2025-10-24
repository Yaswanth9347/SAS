const express = require('express');
const router = express.Router();
const {
  submitContact,
  getAllContacts,
  getContact,
  markAsRead,
  replyToContact,
  archiveContact,
  deleteContact,
  getContactStats,
  bulkUpdateContacts
} = require('../controllers/contactController');

const { protect, authorize } = require('../middleware/auth');

// Public route - anyone can submit a contact form
router.post('/', submitContact);

// Admin routes - require authentication and admin role
router.get('/admin', protect, authorize('admin'), getAllContacts);
router.get('/admin/stats', protect, authorize('admin'), getContactStats);
router.put('/admin/bulk-update', protect, authorize('admin'), bulkUpdateContacts);
router.get('/admin/:id', protect, authorize('admin'), getContact);
router.put('/admin/:id/read', protect, authorize('admin'), markAsRead);
router.put('/admin/:id/reply', protect, authorize('admin'), replyToContact);
router.put('/admin/:id/archive', protect, authorize('admin'), archiveContact);
router.delete('/admin/:id', protect, authorize('admin'), deleteContact);

module.exports = router;
