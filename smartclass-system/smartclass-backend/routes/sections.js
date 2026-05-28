const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/sectionController');

router.use(authenticate);

router.get('/', asyncHandler(ctl.listSections));

// Helper endpoints — MUST be declared before /:id so paths don't collide
router.get('/teachers', authorize('admin', 'teacher'),
  asyncHandler(ctl.listTeachers));
router.get('/students', authorize('admin', 'teacher'),
  asyncHandler(ctl.listStudents));
router.get('/semesters', authorize('admin', 'teacher'),
  asyncHandler(ctl.listSemesters));

router.post('/semesters', authorize('admin'), [
  body('code').isString().notEmpty(),
  body('label').isString().notEmpty(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  validate,
], asyncHandler(ctl.createSemester));

router.patch('/semesters/:id/archive', authorize('admin'),
  asyncHandler(ctl.archiveSemester));

router.patch('/semesters/:id/unarchive', authorize('admin'),
  asyncHandler(ctl.unarchiveSemester));

router.get('/:id', asyncHandler(ctl.getSection));

router.post('/', authorize('admin'), [
  body('semesterId').isInt(),
  body('teacherId').isInt(),
  body('code').isString().notEmpty(),
  body('subject').isString().notEmpty(),
  validate,
], asyncHandler(ctl.createSection));

router.post('/:id/enrollments', authorize('admin'),
  asyncHandler(ctl.enrollStudent));

router.patch('/:id/archive', authorize('admin'),
  asyncHandler(ctl.archiveSection));

module.exports = router;
