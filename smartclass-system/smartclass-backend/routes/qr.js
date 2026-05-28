const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/qrController');

router.use(authenticate);

// Student fetches their own QR (PNG data URL)
router.get('/me', authorize('student'), asyncHandler(ctl.myQrImage));

// Admin: list all QRs with filters
router.get('/', authorize('admin'), asyncHandler(ctl.listAllQrs));

// Admin issues / rotates a single student's QR
router.post('/issue', authorize('admin'), asyncHandler(ctl.issueForStudent));

// Admin batch-issues for an entire section
router.post('/issue-batch', authorize('admin'),
  asyncHandler(ctl.issueBatchForSection));

// Admin: bulk revoke
router.post('/bulk-revoke', authorize('admin'),
  asyncHandler(ctl.bulkRevokeQrs));

// Admin: revoke a single QR
router.patch('/:id/revoke', authorize('admin'),
  asyncHandler(ctl.revokeQr));

// Admin: restore a revoked QR
router.patch('/:id/restore', authorize('admin'),
  asyncHandler(ctl.restoreQr));

// Teachers resolve a token before recording (used by the scanner)
router.post('/resolve', authorize('teacher','admin'),
  asyncHandler(ctl.resolveToken));

module.exports = router;
