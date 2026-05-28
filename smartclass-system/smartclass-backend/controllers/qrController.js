const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');

const tokenHex = () => crypto.randomBytes(32).toString('hex');

// Issue or rotate a student's semester QR
async function issueForStudent(req, res) {
  const { studentId, semesterId } = req.body;

  // Fetch semester end date for expiry
  const [sems] = await pool.query(
    'SELECT end_date FROM semesters WHERE id = ?',
    [semesterId]
  );
  if (!sems[0]) throw new HttpError(404, 'Semester not found');
  const expiresAt = `${sems[0].end_date instanceof Date
    ? sems[0].end_date.toISOString().slice(0, 10)
    : sems[0].end_date} 23:59:59`;

  const token = tokenHex();
  // Upsert: revoke any existing for this student+semester, then insert
  await pool.query(
    `UPDATE qr_codes SET revoked = TRUE
     WHERE student_id = ? AND semester_id = ? AND revoked = FALSE`,
    [studentId, semesterId]
  );
  await pool.query(
    `INSERT INTO qr_codes (student_id, semester_id, token, expires_at)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE
       token = VALUES(token),
       expires_at = VALUES(expires_at),
       revoked = FALSE,
       issued_at = CURRENT_TIMESTAMP`,
    [studentId, semesterId, token, expiresAt]
  );

  res.status(201).json({ token, expiresAt });
}

// Issue QRs for an entire section in one call (admin convenience)
async function issueBatchForSection(req, res) {
  const { sectionId, semesterId } = req.body;
  const [students] = await pool.query(
    `SELECT student_id FROM enrollments
     WHERE section_id = ? AND status='enrolled'`,
    [sectionId]
  );
  const [sems] = await pool.query(
    'SELECT end_date FROM semesters WHERE id = ?', [semesterId]
  );
  if (!sems[0]) throw new HttpError(404, 'Semester not found');
  const expiresAt = `${sems[0].end_date instanceof Date
    ? sems[0].end_date.toISOString().slice(0, 10)
    : sems[0].end_date} 23:59:59`;

  for (const s of students) {
    const token = tokenHex();
    await pool.query(
      `INSERT INTO qr_codes (student_id, semester_id, token, expires_at)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE
         token = VALUES(token),
         expires_at = VALUES(expires_at),
         revoked = FALSE,
         issued_at = CURRENT_TIMESTAMP`,
      [s.student_id, semesterId, token, expiresAt]
    );
  }
  res.status(201).json({ count: students.length });
}

// Get QR for the currently-logged-in student (as PNG data URL)
async function myQrImage(req, res) {
  const [rows] = await pool.query(
    `SELECT q.token, q.expires_at, s.student_number
     FROM qr_codes q
     JOIN students s ON s.id = q.student_id
     WHERE s.user_id = ? AND q.revoked = FALSE
     ORDER BY q.issued_at DESC LIMIT 1`,
    [req.user.sub]
  );
  if (!rows[0]) throw new HttpError(404, 'No active QR code');

  const payload = JSON.stringify({
    t: rows[0].token,
    sn: rows[0].student_number,
  });
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });
  res.json({
    dataUrl,
    studentNumber: rows[0].student_number,
    expiresAt: rows[0].expires_at,
  });
}

// Resolve a token → student (used by scanner before recording attendance)
async function resolveToken(req, res) {
  const { token } = req.body;
  const [rows] = await pool.query(
    `SELECT q.id AS qr_id, q.expires_at, q.revoked,
            s.id AS student_id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name
     FROM qr_codes q
     JOIN students s ON s.id = q.student_id
     JOIN users u    ON u.id = s.user_id
     WHERE q.token = ? LIMIT 1`,
    [token]
  );
  if (!rows[0]) throw new HttpError(404, 'QR token not recognized');
  if (rows[0].revoked) throw new HttpError(410, 'QR has been revoked');
  if (new Date(rows[0].expires_at) < new Date()) {
    throw new HttpError(410, 'QR has expired');
  }
  res.json({ student: rows[0] });
}

// List all QR codes (admin) — with filters
async function listAllQrs(req, res) {
  const { semesterId, status, q } = req.query;
  const conditions = [];
  const params = [];

  if (semesterId) {
    conditions.push('qr.semester_id = ?');
    params.push(semesterId);
  }
  if (status === 'active') {
    conditions.push('qr.revoked = FALSE AND qr.expires_at > NOW()');
  } else if (status === 'expired') {
    conditions.push('qr.expires_at < NOW()');
  } else if (status === 'revoked') {
    conditions.push('qr.revoked = TRUE');
  }
  if (q) {
    conditions.push(
      `(s.student_number LIKE ? OR
        u.first_name LIKE ? OR
        u.last_name LIKE ? OR
        u.email LIKE ?)`
    );
    const pat = `%${q}%`;
    params.push(pat, pat, pat, pat);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const [rows] = await pool.query(
    `SELECT qr.id, qr.token, qr.expires_at, qr.revoked, qr.issued_at,
            qr.semester_id,
            s.id AS student_id, s.student_number,
            CONCAT(u.first_name, ' ', u.last_name) AS student_name,
            u.email,
            sem.label AS semester_label,
            (SELECT COUNT(*) FROM attendance a
             WHERE a.student_id = s.id) AS scan_count
     FROM qr_codes qr
     JOIN students s   ON s.id = qr.student_id
     JOIN users u      ON u.id = s.user_id
     JOIN semesters sem ON sem.id = qr.semester_id
     ${where}
     ORDER BY qr.issued_at DESC
     LIMIT 500`,
    params
  );

  const summary = {
    total: rows.length,
    active: rows.filter(r => !r.revoked && new Date(r.expires_at) > new Date()).length,
    expired: rows.filter(r => new Date(r.expires_at) < new Date()).length,
    revoked: rows.filter(r => r.revoked).length,
  };

  res.json({ qrCodes: rows, summary });
}

// Revoke a single QR code
async function revokeQr(req, res) {
  const { id } = req.params;
  const [r] = await pool.query(
    `UPDATE qr_codes SET revoked = TRUE WHERE id = ?`,
    [id]
  );
  if (r.affectedRows === 0) throw new HttpError(404, 'QR code not found');
  res.json({ ok: true });
}

// Restore a revoked QR (only if not expired)
async function restoreQr(req, res) {
  const { id } = req.params;
  const [rows] = await pool.query(
    `SELECT expires_at FROM qr_codes WHERE id = ?`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'QR code not found');
  if (new Date(rows[0].expires_at) < new Date()) {
    throw new HttpError(400, 'Cannot restore an expired QR. Issue a new one instead.');
  }
  await pool.query(
    `UPDATE qr_codes SET revoked = FALSE WHERE id = ?`,
    [id]
  );
  res.json({ ok: true });
}

// Bulk revoke (by semester or filter)
async function bulkRevokeQrs(req, res) {
  const { semesterId, qrIds } = req.body;
  let result;
  if (qrIds && Array.isArray(qrIds) && qrIds.length > 0) {
    const placeholders = qrIds.map(() => '?').join(',');
    [result] = await pool.query(
      `UPDATE qr_codes SET revoked = TRUE WHERE id IN (${placeholders})`,
      qrIds
    );
  } else if (semesterId) {
    [result] = await pool.query(
      `UPDATE qr_codes SET revoked = TRUE WHERE semester_id = ? AND revoked = FALSE`,
      [semesterId]
    );
  } else {
    throw new HttpError(400, 'Provide either semesterId or qrIds');
  }
  res.json({ ok: true, revoked: result.affectedRows });
}

module.exports = {
  issueForStudent, issueBatchForSection, myQrImage, resolveToken,
  listAllQrs, revokeQr, restoreQr, bulkRevokeQrs,
};
