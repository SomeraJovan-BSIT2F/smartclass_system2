const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');
const { attendanceReport, studentPerformanceReport } = require('../utils/pdf');

async function attendancePdf(req, res) {
  const { sectionId } = req.params;

  const [secRows] = await pool.query(
    'SELECT * FROM sections WHERE id = ?', [sectionId]
  );
  if (!secRows[0]) throw new HttpError(404, 'Section not found');

  const [students] = await pool.query(
    `SELECT s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            (SELECT ROUND(SUM(a.status IN ('present','late')) * 100.0 /
                          NULLIF(COUNT(*),0), 1)
             FROM attendance a
             JOIN class_sessions cs ON cs.id = a.session_id
             WHERE cs.section_id = ? AND a.student_id = s.id) AS attendance_pct
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     WHERE e.section_id = ? AND e.status='enrolled'
     ORDER BY u.last_name`,
    [sectionId, sectionId]
  );
  students.forEach(s => {
    s.risk = s.attendance_pct == null ? 'unknown'
           : s.attendance_pct < 75 ? 'high'
           : s.attendance_pct < 85 ? 'medium' : 'low';
  });

  const [sessions] = await pool.query(
    `SELECT * FROM class_sessions WHERE section_id = ? ORDER BY session_date`,
    [sectionId]
  );

  const [[summary]] = await pool.query(
    `SELECT COUNT(DISTINCT e.id) AS total_students,
            ROUND(SUM(a.status IN ('present','late')) * 100.0 /
                  NULLIF(COUNT(a.id),0), 1) AS attendance_pct,
            SUM(CASE WHEN sub.pct < 75 THEN 1 ELSE 0 END) AS at_risk
     FROM enrollments e
     LEFT JOIN attendance a       ON a.student_id = e.student_id
     LEFT JOIN class_sessions cs2 ON cs2.id = a.session_id AND cs2.section_id = e.section_id
     LEFT JOIN (
       SELECT a.student_id,
              SUM(a.status IN ('present','late')) * 100.0 /
              NULLIF(COUNT(*),0) AS pct
       FROM attendance a
       JOIN class_sessions cs ON cs.id = a.session_id
       WHERE cs.section_id = ?
       GROUP BY a.student_id
     ) sub ON sub.student_id = e.student_id
     WHERE e.section_id = ? AND e.status='enrolled'`,
    [sectionId, sectionId]
  );

  await attendanceReport(res, { section: secRows[0], students, sessions, summary });
}

async function myPerformancePdf(req, res) {
  const [stuRows] = await pool.query(
    `SELECT s.id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name
     FROM students s JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ?`,
    [req.user.sub]
  );
  if (!stuRows[0]) throw new HttpError(404, 'Student profile not found');
  const student = stuRows[0];

  const [grades] = await pool.query(
    `SELECT gi.title, gi.category, gi.max_score, g.score
     FROM grades g
     JOIN grade_items gi ON gi.id = g.grade_item_id
     WHERE g.student_id = ?
     ORDER BY g.recorded_at DESC`,
    [student.id]
  );

  const [hist] = await pool.query(
    `SELECT a.status FROM attendance a
     WHERE a.student_id = ?`,
    [student.id]
  );
  const total = hist.length;
  const present = hist.filter(h => h.status === 'present').length;
  const late    = hist.filter(h => h.status === 'late').length;
  const absent  = hist.filter(h => h.status === 'absent').length;
  const excused = hist.filter(h => h.status === 'excused').length;

  const attendance = {
    summary: {
      total, present, late, absent, excused,
      percentage: total ? Math.round(((present + late) / total) * 100) : 0,
    },
  };
  await studentPerformanceReport(res, { student, grades, attendance });
}

// Institution-wide aggregate report (admin only)
async function institutionPdf(req, res) {
  const PDFDocument = require('pdfkit');

  // Aggregate data
  const [[userStats]] = await pool.query(
    `SELECT
       SUM(role='student') AS students,
       SUM(role='teacher') AS teachers,
       SUM(role='admin')   AS admins
     FROM users WHERE status='active'`
  );

  const [[secStats]] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(status='active') AS active,
       SUM(status='archived') AS archived
     FROM sections`
  );

  const [[attStats]] = await pool.query(
    `SELECT
       ROUND(SUM(a.status IN ('present','late')) * 100.0 /
             NULLIF(COUNT(*),0), 1) AS attendance_pct,
       COUNT(*) AS total_records
     FROM attendance a`
  );

  const [perSection] = await pool.query(
    `SELECT s.code, s.subject,
            CONCAT(u.first_name,' ',u.last_name) AS teacher,
            (SELECT COUNT(*) FROM enrollments e
              WHERE e.section_id = s.id AND e.status='enrolled') AS students,
            (SELECT ROUND(SUM(a.status IN ('present','late')) * 100.0 /
                          NULLIF(COUNT(*),0), 1)
             FROM attendance a
             JOIN class_sessions cs ON cs.id = a.session_id
             WHERE cs.section_id = s.id) AS attendance_pct,
            s.status
     FROM sections s
     JOIN teachers t ON t.id = s.teacher_id
     JOIN users u    ON u.id = t.user_id
     ORDER BY s.status, s.code`
  );

  // Stream PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `inline; filename="institution-report-${new Date().toISOString().slice(0, 10)}.pdf"`);
  doc.pipe(res);

  // Header
  doc.font('Helvetica-Bold').fontSize(22).text('SmartClass QR', 50, 50);
  doc.font('Helvetica').fontSize(10).fillColor('#666')
    .text('Institution-wide Report', 50, 78);
  doc.fillColor('#000')
    .fontSize(9)
    .text(`Generated ${new Date().toLocaleString()}`, 50, 92);
  doc.moveTo(50, 115).lineTo(545, 115).stroke('#ccc');

  let y = 140;

  // Section: People
  doc.font('Helvetica-Bold').fontSize(14).text('People', 50, y);
  y += 25;
  const peopleData = [
    ['Active students', userStats.students || 0],
    ['Active teachers', userStats.teachers || 0],
    ['Active admins',   userStats.admins || 0],
  ];
  doc.font('Helvetica').fontSize(11);
  for (const [k, v] of peopleData) {
    doc.fillColor('#666').text(k, 70, y);
    doc.fillColor('#000').text(String(v), 250, y);
    y += 18;
  }

  y += 15;

  // Section: Sections
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000').text('Sections', 50, y);
  y += 25;
  const secData = [
    ['Total sections',    secStats.total || 0],
    ['Active sections',   secStats.active || 0],
    ['Archived sections', secStats.archived || 0],
  ];
  doc.font('Helvetica').fontSize(11);
  for (const [k, v] of secData) {
    doc.fillColor('#666').text(k, 70, y);
    doc.fillColor('#000').text(String(v), 250, y);
    y += 18;
  }

  y += 15;

  // Section: Attendance
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000').text('Attendance', 50, y);
  y += 25;
  doc.font('Helvetica').fontSize(11)
    .fillColor('#666').text('Overall percentage', 70, y);
  doc.fillColor('#000').text(`${attStats.attendance_pct || 0}%`, 250, y);
  y += 18;
  doc.fillColor('#666').text('Total records', 70, y);
  doc.fillColor('#000').text(String(attStats.total_records || 0), 250, y);
  y += 30;

  // Per-section table
  doc.font('Helvetica-Bold').fontSize(14).text('Per-section breakdown', 50, y);
  y += 20;

  // Table header
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#666');
  doc.text('CODE',     50, y);
  doc.text('SUBJECT',  120, y);
  doc.text('TEACHER',  280, y);
  doc.text('STUDENTS', 400, y);
  doc.text('ATTND',    450, y);
  doc.text('STATUS',   500, y);
  y += 14;
  doc.moveTo(50, y - 2).lineTo(545, y - 2).stroke('#ccc');
  y += 4;

  doc.font('Helvetica').fontSize(9).fillColor('#000');
  for (const row of perSection) {
    if (y > 770) {
      doc.addPage();
      y = 50;
    }
    doc.text(row.code || '—', 50, y, { width: 65, ellipsis: true });
    doc.text(row.subject || '—', 120, y, { width: 155, ellipsis: true });
    doc.text(row.teacher || '—', 280, y, { width: 115, ellipsis: true });
    doc.text(String(row.students || 0), 400, y);
    doc.text(row.attendance_pct != null ? `${row.attendance_pct}%` : '—', 450, y);
    doc.fillColor(row.status === 'active' ? '#3B7A57' : '#888')
      .text(row.status, 500, y);
    doc.fillColor('#000');
    y += 16;
  }

  // Footer
  doc.font('Helvetica').fontSize(8).fillColor('#888')
    .text('SmartClass QR · Institution Report', 50, 800, { align: 'center', width: 495 });

  doc.end();
}

module.exports = { attendancePdf, myPerformancePdf, institutionPdf };
