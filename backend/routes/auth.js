const express = require('express');
const { register, login, getMe, checkUsername } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.get('/check-username', checkUsername);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;