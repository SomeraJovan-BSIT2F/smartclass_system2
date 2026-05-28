const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/reportController');

router.use(authenticate);

// Section attendance report (teacher / admin)
router.get('/attendance/sections/:sectionId.pdf',
  authorize('teacher','admin'),
  asyncHandler(ctl.attendancePdf));

// Student's own performance report
router.get('/performance/me.pdf',
  authorize('student'),
  asyncHandler(ctl.myPerformancePdf));

// Admin: institution-wide aggregate report
router.get('/institution.pdf',
  authorize('admin'),
  asyncHandler(ctl.institutionPdf));

module.exports = router;
