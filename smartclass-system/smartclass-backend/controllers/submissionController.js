const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');

// Student submits a file for a task
async function submitFile(req, res) {
  const itemId = Number(req.params.itemId);

  // Find the grade item, verify it accepts submissions
  const [[item]] = await pool.query(
    'SELECT id, section_id, submission_type, title FROM grade_items WHERE id = ?',
    [itemId]
  );
  if (!item) throw new HttpError(404, 'Task not found');
  if (item.submission_type !== 'file') {
    throw new HttpError(400, 'This task does not accept file submissions');
  }

  // Get the student row for this user, and verify enrollment
  const [[student]] = await pool.query(
    'SELECT id FROM students WHERE user_id = ?',
    [req.user.sub]
  );
  if (!student) throw new HttpError(403, 'Only students can submit');

  const [[enrolled]] = await pool.query(
    `SELECT 1 FROM enrollments
     WHERE student_id = ? AND section_id = ? AND status = 'enrolled' LIMIT 1`,
    [student.id, item.section_id]
  );
  if (!enrolled) throw new HttpError(403, 'You are not enrolled in this section');

  // Block re-submission if already graded
  const [[existingGrade]] = await pool.query(
    'SELECT 1 FROM grades WHERE grade_item_id = ? AND student_id = ? LIMIT 1',
    [itemId, student.id]
  );
  if (existingGrade) {
    throw new HttpError(400, 'This task has already been graded — submissions are locked');
  }

  if (!req.file) throw new HttpError(400, 'No file was uploaded');

  const comment = (req.body.comment || '').slice(0, 2000);

  // If a previous submission exists, delete its file and replace the row
  const [[prev]] = await pool.query(
    'SELECT id, file_path FROM task_submissions WHERE grade_item_id = ? AND student_id = ?',
    [itemId, student.id]
  );
  if (prev && prev.file_path) {
    try { fs.unlinkSync(prev.file_path); } catch { /* ignore */ }
  }

  await pool.query(
    `INSERT INTO task_submissions
       (grade_item_id, student_id, file_path, file_name, file_size, file_mime, comment)
     VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       file_path = VALUES(file_path),
       file_name = VALUES(file_name),
       file_size = VALUES(file_size),
       file_mime = VALUES(file_mime),
       comment   = VALUES(comment),
       updated_at = NOW()`,
    [
      itemId, student.id,
      req.file.path, req.file.originalname,
      req.file.size, req.file.mimetype,
      comment,
    ]
  );

  res.status(201).json({ ok: true });
}

// Student fetches their own submission for a task
async function mySubmission(req, res) {
  const itemId = Number(req.params.itemId);
  const [[student]] = await pool.query(
    'SELECT id FROM students WHERE user_id = ?',
    [req.user.sub]
  );
  if (!student) return res.json({ submission: null });

  const [[sub]] = await pool.query(
    `SELECT id, file_name, file_size, file_mime, comment,
            submitted_at, updated_at
     FROM task_submissions
     WHERE grade_item_id = ? AND student_id = ?`,
    [itemId, student.id]
  );
  res.json({ submission: sub || null });
}

// Teacher fetches all submissions for a task
async function listSubmissions(req, res) {
  const itemId = Number(req.params.itemId);
  const [[item]] = await pool.query(
    `SELECT gi.id, gi.title, gi.max_score, gi.section_id,
            s.code AS section_code, s.subject
     FROM grade_items gi
     JOIN sections s ON s.id = gi.section_id
     WHERE gi.id = ?`,
    [itemId]
  );
  if (!item) throw new HttpError(404, 'Task not found');

  const [rows] = await pool.query(
    `SELECT
        stu.id AS student_id,
        stu.student_number,
        CONCAT(u.first_name,' ',u.last_name) AS student_name,
        ts.id AS submission_id,
        ts.file_name, ts.file_size, ts.file_mime,
        ts.comment, ts.submitted_at, ts.updated_at,
        g.score, g.remarks
     FROM enrollments e
     JOIN students stu ON stu.id = e.student_id
     JOIN users u     ON u.id = stu.user_id
     LEFT JOIN task_submissions ts ON ts.grade_item_id = ? AND ts.student_id = stu.id
     LEFT JOIN grades g            ON g.grade_item_id  = ? AND g.student_id  = stu.id
     WHERE e.section_id = ? AND e.status = 'enrolled'
     ORDER BY u.last_name, u.first_name`,
    [itemId, itemId, item.section_id]
  );

  res.json({ item, submissions: rows });
}

// Download a submission's file (teacher or the student who owns it)
async function downloadSubmission(req, res) {
  const subId = Number(req.params.submissionId);

  const [[sub]] = await pool.query(
    `SELECT ts.*, gi.section_id, s.teacher_id, t.user_id AS teacher_user_id,
            stu.user_id AS student_user_id
     FROM task_submissions ts
     JOIN grade_items gi ON gi.id = ts.grade_item_id
     JOIN sections s    ON s.id = gi.section_id
     JOIN teachers t    ON t.id = s.teacher_id
     JOIN students stu  ON stu.id = ts.student_id
     WHERE ts.id = ?`,
    [subId]
  );
  if (!sub) throw new HttpError(404, 'Submission not found');

  const isOwner   = req.user.sub === sub.student_user_id;
  const isTeacher = req.user.sub === sub.teacher_user_id;
  const isAdmin   = req.user.role === 'admin';
  if (!isOwner && !isTeacher && !isAdmin) {
    throw new HttpError(403, 'Not authorized to view this submission');
  }

  if (!sub.file_path || !fs.existsSync(sub.file_path)) {
    throw new HttpError(404, 'File no longer exists');
  }

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${sub.file_name || 'submission'}"`
  );
  res.setHeader('Content-Type', sub.file_mime || 'application/octet-stream');
  fs.createReadStream(sub.file_path).pipe(res);
}

module.exports = {
  submitFile, mySubmission, listSubmissions, downloadSubmission,
};
