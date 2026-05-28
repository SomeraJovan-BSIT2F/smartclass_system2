const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/authController');

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6 }),
  validate,
], asyncHandler(ctl.login));

router.get('/me', authenticate, asyncHandler(ctl.me));

router.post('/change-password', authenticate, [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8 }),
  validate,
], asyncHandler(ctl.changePassword));

module.exports = router;
