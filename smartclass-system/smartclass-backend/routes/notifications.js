const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/notificationController');

router.use(authenticate);

router.get('/', asyncHandler(ctl.list));
router.patch('/:id/read', asyncHandler(ctl.markRead));
router.patch('/read-all', asyncHandler(ctl.markAllRead));

module.exports = router;
