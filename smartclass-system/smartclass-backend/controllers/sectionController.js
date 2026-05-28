const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');

async function listSections(req, res) {
  const { semesterId, teacherId } = req.query;
  const where = [];
  const params = [];

  // teachers only see their own
  if (req.user.role === 'teacher') {
    where.push(
      `s.teacher_id = (SELECT id FROM teachers WHERE user_id = ?)`
    );
    params.push(req.user.sub);
  } else if (teacherId) {
    where.push('s.teacher_id = ?'); params.push(teacherId);
  }
  if (semesterId) { where.push('s.semester_id = ?'); params.push(semesterId); }

  const [rows] = await pool.query(
    `SELECT s.*,
            CONCAT(u.first_name,' ',u.last_name) AS teacher_name,
            sem.label AS semester_label,
            (SELECT COUNT(*) FROM enrollments e
              WHERE e.section_id = s.id AND e.status='enrolled') AS student_count
     FROM sections s
     JOIN teachers t  ON t.id = s.teacher_id
     JOIN users u     ON u.id = t.user_id
     JOIN semesters sem ON sem.id = s.semester_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY s.code`,
    params
  );
  res.json({ sections: rows });
}

async function getSection(req, res) {
  const { id } = req.params;
  const [rows] = await pool.query(
    `SELECT s.*, CONCAT(u.first_name,' ',u.last_name) AS teacher_name
     FROM sections s
     JOIN teachers t ON t.id = s.teacher_id
     JOIN users u    ON u.id = t.user_id
     WHERE s.id = ?`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'Section not found');

  const [students] = await pool.query(
    `SELECT s.id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            u.email
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     WHERE e.section_id = ? AND e.status='enrolled'
     ORDER BY u.last_name, u.first_name`,
    [id]
  );
  res.json({ section: rows[0], students });
}

async function createSection(req, res) {
  const { semesterId, teacherId, code, subject, schedule, room } = req.body;
  const [r] = await pool.query(
    `INSERT INTO sections (semester_id, teacher_id, code, subject, schedule, room)
     VALUES (?,?,?,?,?,?)`,
    [semesterId, teacherId, code, subject, schedule, room]
  );
  res.status(201).json({ id: r.insertId });
}

// List all teachers (id + display name) — for picking in section forms
async function listTeachers(req, res) {
  const [rows] = await pool.query(
    `SELECT t.id,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            u.email,
            t.employee_number,
            t.department
     FROM teachers t
     JOIN users u ON u.id = t.user_id
     WHERE u.status = 'active'
     ORDER BY u.last_name, u.first_name`
  );
  res.json({ teachers: rows });
}

// List all students — for enrolling into sections
async function listStudents(req, res) {
  const [rows] = await pool.query(
    `SELECT s.id,
            s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            u.email,
            s.program,
            s.year_level
     FROM students s
     JOIN users u ON u.id = s.user_id
     WHERE u.status = 'active'
     ORDER BY u.last_name, u.first_name`
  );
  res.json({ students: rows });
}

// List all semesters
async function listSemesters(req, res) {
  const [rows] = await pool.query(
    `SELECT id, code, label, start_date, end_date, is_active
     FROM semesters
     ORDER BY start_date DESC`
  );
  res.json({ semesters: rows });
}

// Create a new semester
async function createSemester(req, res) {
  const { code, label, startDate, endDate, isActive } = req.body;
  if (isActive) {
    await pool.query(`UPDATE semesters SET is_active = 0`);
  }
  const [r] = await pool.query(
    `INSERT INTO semesters (code, label, start_date, end_date, is_active)
     VALUES (?,?,?,?,?)`,
    [code, label, startDate, endDate, isActive ? 1 : 0]
  );
  res.status(201).json({ id: r.insertId });
}

// Archive a semester: close all its sections and revoke unused QRs
async function archiveSemester(req, res) {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Archive all sections in this semester
    const [secRes] = await conn.query(
      `UPDATE sections SET status = 'archived' WHERE semester_id = ?`,
      [id]
    );

    // Revoke all QR codes for this semester
    const [qrRes] = await conn.query(
      `UPDATE qr_codes SET revoked = 1 WHERE semester_id = ?`,
      [id]
    );

    // Close any still-open class sessions
    const [sesRes] = await conn.query(
      `UPDATE class_sessions cs
       JOIN sections s ON s.id = cs.section_id
       SET cs.status = 'closed'
       WHERE s.semester_id = ? AND cs.status = 'open'`,
      [id]
    );

    // Mark the semester inactive
    await conn.query(
      `UPDATE semesters SET is_active = 0 WHERE id = ?`,
      [id]
    );

    await conn.commit();
    res.json({
      ok: true,
      archived: {
        sections: secRes.affectedRows,
        qrCodes: qrRes.affectedRows,
        sessions: sesRes.affectedRows,
      },
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Unarchive a semester (only flips section status back to active)
async function unarchiveSemester(req, res) {
  const { id } = req.params;
  await pool.query(
    `UPDATE sections SET status = 'active' WHERE semester_id = ?`,
    [id]
  );
  res.json({ ok: true });
}

async function enrollStudent(req, res) {
  const { id } = req.params;
  const { studentId } = req.body;
  await pool.query(
    `INSERT INTO enrollments (section_id, student_id) VALUES (?,?)`,
    [id, studentId]
  );
  res.status(201).json({ ok: true });
}

async function archiveSection(req, res) {
  const { id } = req.params;
  await pool.query(`UPDATE sections SET status='archived' WHERE id = ?`, [id]);
  res.json({ ok: true });
}

module.exports = {
  listSections, getSection, createSection, enrollStudent, archiveSection,
  listTeachers, listStudents, listSemesters, createSemester,
  archiveSemester, unarchiveSemester,
};
