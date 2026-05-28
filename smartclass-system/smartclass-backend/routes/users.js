const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/userController');

router.use(authenticate, authorize('admin'));

router.get('/', asyncHandler(ctl.listUsers));

router.post('/', [
  body('role').isIn(['admin','teacher','student']),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('firstName').isString().notEmpty(),
  body('lastName').isString().notEmpty(),
  validate,
], asyncHandler(ctl.createUser));

router.patch('/:id/status', asyncHandler(ctl.updateUserStatus));

module.exports = router;
