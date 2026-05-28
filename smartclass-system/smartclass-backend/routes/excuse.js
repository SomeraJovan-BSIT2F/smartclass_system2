const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');
const upload = require('../middleware/upload');
const ctl = require('../controllers/excuseController');

router.use(authenticate);

router.get('/', asyncHandler(ctl.list));

router.post('/', authorize('student'), upload.single('attachment'), [
  body('sectionId').isInt(),
  body('absenceDate').isISO8601(),
  body('reasonType').isIn(['medical','family','official','other']),
  body('explanation').isString().isLength({ min: 10 }),
  validate,
], asyncHandler(ctl.submit));

router.patch('/:id/review', authorize('teacher','admin'), [
  body('status').isIn(['approved','rejected']),
  validate,
], asyncHandler(ctl.review));

router.get('/:id/attachment', asyncHandler(ctl.downloadAttachment));

module.exports = router;
