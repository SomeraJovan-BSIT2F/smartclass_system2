const router = require('express').Router();
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');
const ctl = require('../controllers/gradeController');
const subCtl = require('../controllers/submissionController');

const SUBMISSIONS_DIR = path.join(__dirname, '..', 'uploads', 'submissions');
if (!fs.existsSync(SUBMISSIONS_DIR)) {
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SUBMISSIONS_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').slice(0, 100);
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    cb(null, `${stamp}-${safe}`);
  },
});

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
];

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed. Accepted: PDF, Word, Excel, PowerPoint, images, text, ZIP.'));
  },
});

router.use(authenticate);

router.get('/items', authorize('teacher','admin'), asyncHandler(ctl.listItems));

router.post('/items', authorize('teacher','admin'), [
  body('sectionId').isInt(),
  body('title').isString().notEmpty(),
  body('category').isIn(['quiz','activity','participation','exam','recitation']),
  body('maxScore').isFloat({ gt: 0 }),
  body('submissionType').optional().isIn(['none', 'file', 'quiz']),
  validate,
], asyncHandler(ctl.createItem));

router.delete('/items/:id', authorize('teacher','admin'),
  asyncHandler(ctl.deleteItem));

router.post('/', authorize('teacher','admin'), [
  body('gradeItemId').isInt(),
  body('studentId').isInt(),
  body('score').isFloat(),
  validate,
], asyncHandler(ctl.recordGrade));

router.get('/me', authorize('student'), asyncHandler(ctl.myGrades));
router.get('/me/tasks', authorize('student'), asyncHandler(ctl.myTasks));
router.get('/me/tasks/:itemId', authorize('student'),
  asyncHandler(ctl.getTaskDetail));

router.post('/items/:itemId/submit',
  authorize('student'),
  upload.single('file'),
  asyncHandler(subCtl.submitFile)
);
router.get('/items/:itemId/submission/me', authorize('student'),
  asyncHandler(subCtl.mySubmission));
router.get('/items/:itemId/submissions', authorize('teacher','admin'),
  asyncHandler(subCtl.listSubmissions));
router.get('/submissions/:submissionId/file',
  authorize('student','teacher','admin'),
  asyncHandler(subCtl.downloadSubmission));

router.get('/sections/:sectionId/roster', authorize('teacher','admin'),
  asyncHandler(ctl.classRoster));

router.get('/sections/:sectionId/grid', authorize('teacher','admin'),
  asyncHandler(ctl.gradeGrid));

router.post('/sections/:sectionId/recitation', authorize('teacher','admin'),
  asyncHandler(ctl.recitationCall));

router.get('/sections/:sectionId/recitation/history', authorize('teacher','admin'),
  asyncHandler(ctl.recitationHistory));

router.get('/sections/:sectionId/groups', authorize('teacher','admin'),
  asyncHandler(ctl.generateGroups));

router.get('/sections/:sectionId/trend', authorize('teacher','admin'),
  asyncHandler(ctl.attendanceTrend));

const quizCtl = require('../controllers/quizController');

// Teacher manages questions
router.get('/items/:itemId/questions', authorize('teacher','admin'),
  asyncHandler(quizCtl.listQuestions));
router.post('/items/:itemId/questions', authorize('teacher','admin'),
  asyncHandler(quizCtl.upsertQuestion));
router.delete('/items/:itemId/questions/:questionId', authorize('teacher','admin'),
  asyncHandler(quizCtl.deleteQuestion));

// Student takes / sees results
router.get('/items/:itemId/quiz', authorize('student'),
  asyncHandler(quizCtl.getQuizForStudent));
router.post('/items/:itemId/quiz/submit', authorize('student'),
  asyncHandler(quizCtl.submitQuiz));
router.get('/items/:itemId/quiz/results', authorize('student'),
  asyncHandler(quizCtl.getMyQuizResults));

// Teacher reviews submissions / grades essays
router.get('/items/:itemId/quiz/submissions', authorize('teacher','admin'),
  asyncHandler(quizCtl.listQuizSubmissions));
router.get('/items/:itemId/quiz/submissions/:studentId', authorize('teacher','admin'),
  asyncHandler(quizCtl.getStudentSubmission));
router.patch('/items/:itemId/quiz/answers/:answerId/grade', authorize('teacher','admin'),
  asyncHandler(quizCtl.gradeEssay));

module.exports = router;
