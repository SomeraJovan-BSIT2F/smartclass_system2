const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');

async function submit(req, res) {
  const { sectionId, absenceDate, reasonType, explanation } = req.body;

  const [stu] = await pool.query(
    'SELECT id FROM students WHERE user_id = ?', [req.user.sub]
  );
  if (!stu[0]) throw new HttpError(403, 'Only students can submit excuse letters');

  const attachment = req.file ? req.file.filename : null;
  const [r] = await pool.query(
    `INSERT INTO excuse_letters
       (student_id, section_id, absence_date, reason_type, explanation, attachment_path)
     VALUES (?,?,?,?,?,?)`,
    [stu[0].id, sectionId, absenceDate, reasonType, explanation, attachment]
  );

  // Notify the section's teacher
  const [t] = await pool.query(
    `SELECT u.id AS user_id FROM sections s
     JOIN teachers t ON t.id = s.teacher_id
     JOIN users u    ON u.id = t.user_id
     WHERE s.id = ?`,
    [sectionId]
  );
  if (t[0]) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES (?,?,?,?,?)`,
      [t[0].user_id, 'excuse', 'New excuse letter',
       `Submitted for ${absenceDate}`, `/excuse-letters/${r.insertId}`]
    );
  }
  res.status(201).json({ id: r.insertId });
}

async function list(req, res) {
  const { status, sectionId } = req.query;
  const where = [];
  const params = [];

  // Students see only their own; teachers see their sections; admins see all
  if (req.user.role === 'student') {
    where.push('s.user_id = ?'); params.push(req.user.sub);
  } else if (req.user.role === 'teacher') {
    where.push(`sec.teacher_id = (SELECT id FROM teachers WHERE user_id = ?)`);
    params.push(req.user.sub);
  }
  if (status) { where.push('e.status = ?'); params.push(status); }
  if (sectionId) { where.push('e.section_id = ?'); params.push(sectionId); }

  const [rows] = await pool.query(
    `SELECT e.*,
            CONCAT(u.first_name,' ',u.last_name) AS student_name,
            s.student_number, sec.code AS section_code, sec.subject
     FROM excuse_letters e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     JOIN sections sec ON sec.id = e.section_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY e.submitted_at DESC`,
    params
  );
  res.json({ letters: rows });
}

async function review(req, res) {
  const { id } = req.params;
  const { status, reviewNotes } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    throw new HttpError(400, 'Status must be approved or rejected');
  }
  await pool.query(
    `UPDATE excuse_letters
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
     WHERE id = ?`,
    [status, req.user.sub, reviewNotes || null, id]
  );

  // Notify the student
  const [row] = await pool.query(
    `SELECT s.user_id, e.absence_date, sec.code AS section_code, sec.subject
     FROM excuse_letters e
     JOIN students s   ON s.id = e.student_id
     JOIN sections sec ON sec.id = e.section_id
     WHERE e.id = ?`,
    [id]
  );
  if (row[0]) {
    const dateStr = new Date(row[0].absence_date).toLocaleDateString();
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES (?,?,?,?)`,
      [
        row[0].user_id,
        'excuse',
        `Excuse letter ${status}`,
        `Your excuse letter for ${row[0].subject} (${row[0].section_code}) on ${dateStr} was ${status}.${reviewNotes ? ' Note: ' + reviewNotes : ''}`,
      ]
    );
  }

  // If approved → mark that day's attendance as 'excused'
  if (status === 'approved') {
    await pool.query(
      `UPDATE attendance a
       JOIN class_sessions cs ON cs.id = a.session_id
       JOIN excuse_letters e  ON e.section_id = cs.section_id
                              AND e.absence_date = cs.session_date
                              AND e.student_id = a.student_id
       SET a.status = 'excused', a.source = 'excuse'
       WHERE e.id = ?`,
      [id]
    );
  }

  res.json({ ok: true });
}

async function downloadAttachment(req, res) {
  const { id } = req.params;
  const [rows] = await pool.query(
    'SELECT attachment_path, student_id FROM excuse_letters WHERE id = ?', [id]
  );
  if (!rows[0] || !rows[0].attachment_path) {
    throw new HttpError(404, 'No attachment');
  }
  // Auth check — students can only download their own
  if (req.user.role === 'student') {
    const [own] = await pool.query(
      `SELECT 1 FROM students WHERE id = ? AND user_id = ?`,
      [rows[0].student_id, req.user.sub]
    );
    if (!own[0]) throw new HttpError(403, 'Forbidden');
  }
  const filePath = path.join(
    process.env.UPLOAD_DIR || './uploads', rows[0].attachment_path
  );
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'File missing');
  res.sendFile(path.resolve(filePath));
}

module.exports = { submit, list, review, downloadAttachment };
