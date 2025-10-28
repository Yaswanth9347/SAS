const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/', protect, ctrl.getNotifications);
router.put('/mark-all-read', protect, ctrl.markAllRead);
router.put('/:id/read', protect, ctrl.markRead);
router.put('/:id/unread', protect, ctrl.markUnread);
router.delete('/:id', protect, ctrl.remove);

module.exports = router;
