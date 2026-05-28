const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/analyticsController');

router.use(authenticate);

router.get('/institution', authorize('admin'),
  asyncHandler(ctl.institutionOverview));

router.get('/at-risk', authorize('teacher', 'admin'),
  asyncHandler(ctl.atRiskStudents));

router.get('/sections/:sectionId', authorize('teacher', 'admin'),
  asyncHandler(ctl.sectionAnalytics));

router.get('/sections/:sectionId/ranking', authorize('teacher', 'admin'),
  asyncHandler(ctl.classRanking));

router.get('/sections/:sectionId/engagement', authorize('teacher', 'admin'),
  asyncHandler(ctl.engagementMetrics));

module.exports = router;
