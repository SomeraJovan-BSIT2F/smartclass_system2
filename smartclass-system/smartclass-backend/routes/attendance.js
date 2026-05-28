const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/attendanceController');

router.use(authenticate);

// Teacher: open today's session for a section
router.post('/sessions', authorize('teacher','admin'), [
  body('sectionId').isInt(),
  validate,
], asyncHandler(ctl.openSession));

// Teacher: close a session (locks attendance, marks remaining absent)
router.patch('/sessions/:id/close', authorize('teacher','admin'),
  asyncHandler(ctl.closeSession));

// Teacher: record a scan (qrToken OR studentId)
router.post('/scan', authorize('teacher','admin'), [
  body('sessionId').isInt(),
  validate,
], asyncHandler(ctl.recordScan));

// Teacher: list attendance for a session
router.get('/sessions/:id', authorize('teacher','admin'),
  asyncHandler(ctl.listForSession));

// Student: own attendance history with summary
router.get('/me', authorize('student'), asyncHandler(ctl.myHistory));

// Teacher: full attendance grid for a section (date range)
router.get('/sections/:sectionId/grid', authorize('teacher','admin'),
  asyncHandler(ctl.attendanceGrid));

module.exports = router;
