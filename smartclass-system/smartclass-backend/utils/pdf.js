const PDFDocument = require('pdfkit');

const COLORS = {
  ink:    '#0F1419',
  paper:  '#FAF7F2',
  rule:   '#E5DFD3',
  muted:  '#6B655B',
  accent: '#B6452C',
  ok:     '#3B7A57',
  warn:   '#C28A2C',
  bad:    '#A33A2A',
};

function header(doc, title, subtitle) {
  doc.fillColor(COLORS.accent)
     .fontSize(9)
     .text('SMARTCLASS QR — CLASSROOM INTELLIGENCE', { characterSpacing: 1.5 });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.ink).fontSize(22).font('Helvetica-Bold').text(title);
  if (subtitle) {
    doc.moveDown(0.1);
    doc.fillColor(COLORS.muted).fontSize(11).font('Helvetica').text(subtitle);
  }
  doc.moveDown(0.5);
  doc.strokeColor(COLORS.rule).lineWidth(0.5)
     .moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.8);
}

function footer(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - 40;
    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
       .text(`Generated ${new Date().toLocaleString()} · SmartClass QR`,
             doc.page.margins.left, y);
    doc.text(`Page ${i + 1} of ${range.count}`,
             doc.page.margins.left, y, {
               align: 'right',
               width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
             });
  }
}

function tableRow(doc, cells, widths, opts = {}) {
  const startX = doc.x;
  const startY = doc.y;
  const rowHeight = opts.height || 20;
  if (opts.header) {
    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold');
  } else {
    doc.fillColor(COLORS.ink).fontSize(10).font('Helvetica');
  }
  let x = startX;
  cells.forEach((cell, i) => {
    doc.text(String(cell ?? '—'), x + 4, startY + 5, {
      width: widths[i] - 8, height: rowHeight - 8, ellipsis: true,
    });
    x += widths[i];
  });
  doc.strokeColor(COLORS.rule).lineWidth(0.4)
     .moveTo(startX, startY + rowHeight)
     .lineTo(startX + widths.reduce((a, b) => a + b, 0), startY + rowHeight)
     .stroke();
  doc.x = startX;
  doc.y = startY + rowHeight;
}

// Generate an attendance summary PDF for a section
async function attendanceReport(res, { section, students, sessions, summary }) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="attendance-${section.code}-${Date.now()}.pdf"`
  );
  doc.pipe(res);

  header(doc, 'Attendance Summary',
         `${section.code} — ${section.subject}`);

  doc.fillColor(COLORS.muted).fontSize(9)
     .text(`Generated ${new Date().toLocaleDateString()} · ${sessions.length} sessions covered`);
  doc.moveDown(0.8);

  // Summary cards
  const cards = [
    ['Students',     summary.total_students || students.length],
    ['Avg attendance', `${summary.attendance_pct ?? '—'}%`],
    ['Sessions',     sessions.length],
    ['At risk',      summary.at_risk || 0],
  ];
  const cardW = (doc.page.width - 100) / 4;
  let cx = 50;
  const cy = doc.y;
  cards.forEach(([label, val]) => {
    doc.roundedRect(cx, cy, cardW - 8, 50, 6).fillAndStroke('#FAF7F2', COLORS.rule);
    doc.fillColor(COLORS.muted).fontSize(7).font('Helvetica-Bold')
       .text(label.toUpperCase(), cx + 10, cy + 8, { characterSpacing: 1 });
    doc.fillColor(COLORS.ink).fontSize(18).font('Helvetica-Bold')
       .text(String(val), cx + 10, cy + 22);
    cx += cardW;
  });
  doc.y = cy + 70;

  // Roster table
  doc.moveDown(0.5);
  doc.fillColor(COLORS.ink).fontSize(13).font('Helvetica-Bold').text('Student roster');
  doc.moveDown(0.3);

  const widths = [110, 200, 90, 90];
  tableRow(doc, ['STUDENT NUMBER', 'NAME', 'ATTENDANCE %', 'STATUS'], widths,
           { header: true });

  for (const s of students) {
    if (doc.y > doc.page.height - 80) doc.addPage();
    tableRow(doc, [
      s.student_number, s.name,
      s.attendance_pct != null ? `${s.attendance_pct}%` : '—',
      s.risk === 'high' ? 'At risk' :
        s.risk === 'medium' ? 'Watch' : 'On track',
    ], widths);
  }

  footer(doc);
  doc.end();
}

// Generate a performance report for a single student
async function studentPerformanceReport(res, { student, grades, attendance }) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="performance-${student.student_number}.pdf"`
  );
  doc.pipe(res);

  header(doc, 'Academic Performance Report',
         `${student.name} · ${student.student_number}`);

  // Attendance summary
  const a = attendance.summary;
  doc.fillColor(COLORS.ink).fontSize(13).font('Helvetica-Bold').text('Attendance');
  doc.moveDown(0.3);
  doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica').text(
    `${a.percentage}% across ${a.total} sessions  ·  ` +
    `${a.present} present, ${a.late} late, ${a.absent} absent, ${a.excused} excused`
  );
  doc.moveDown(1);

  // Grades table
  doc.fillColor(COLORS.ink).fontSize(13).font('Helvetica-Bold').text('Grades');
  doc.moveDown(0.3);
  const widths = [180, 110, 70, 70, 80];
  tableRow(doc, ['ASSESSMENT', 'CATEGORY', 'SCORE', 'MAX', 'PERCENT'], widths,
           { header: true });

  for (const g of grades) {
    if (doc.y > doc.page.height - 80) doc.addPage();
    const pct = ((g.score / g.max_score) * 100).toFixed(1) + '%';
    tableRow(doc, [g.title, g.category, g.score, g.max_score, pct], widths);
  }

  footer(doc);
  doc.end();
}

async function institutionReport(res, pool, semesterId) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  doc.pipe(res);

  // Semester info
  const [[sem]] = await pool.query(
    `SELECT * FROM semesters ${semesterId ? 'WHERE id = ?' : 'WHERE is_active = 1 LIMIT 1'}`,
    semesterId ? [semesterId] : []
  );
  const semLabel = sem ? sem.label : 'Current term';

  header(doc, 'Institution-Wide Report', semLabel);

  doc.fillColor(COLORS.accent).fontSize(9).text('OVERVIEW', { characterSpacing: 1.2 });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(13).text('At a glance');
  doc.moveDown(0.4);

  const [[users]] = await pool.query(
    `SELECT
       SUM(role='student') AS students,
       SUM(role='teacher') AS teachers,
       SUM(role='admin')   AS admins
     FROM users WHERE status='active'`
  );
  const [[sectionCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM sections ${sem ? 'WHERE semester_id = ?' : ''}`,
    sem ? [sem.id] : []
  );
  const [[overallAtt]] = await pool.query(
    `SELECT ROUND(SUM(a.status IN ('present','late')) * 100.0 /
                  NULLIF(COUNT(*),0), 1) AS pct
     FROM attendance a
     JOIN class_sessions cs ON cs.id = a.session_id
     ${sem ? `JOIN sections sec ON sec.id = cs.section_id WHERE sec.semester_id = ?` : ''}`,
    sem ? [sem.id] : []
  );

  doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink);
  const summary = [
    ['Active students:', String(users.students || 0)],
    ['Active teachers:', String(users.teachers || 0)],
    ['Administrators:',  String(users.admins   || 0)],
    ['Sections this term:', String(sectionCount.c || 0)],
    ['Overall attendance:', overallAtt.pct == null ? '—' : `${overallAtt.pct}%`],
  ];
  for (const [k, v] of summary) {
    doc.text(`${k}  `, { continued: true })
       .font('Helvetica-Bold').text(v).font('Helvetica');
    doc.moveDown(0.15);
  }
  doc.moveDown(0.8);

  doc.fillColor(COLORS.accent).fontSize(9).text('BREAKDOWN', { characterSpacing: 1.2 });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(13).text('Sections');
  doc.moveDown(0.4);

  const [sections] = await pool.query(
    `SELECT s.id, s.code, s.subject, s.status,
            CONCAT(u.first_name,' ',u.last_name) AS teacher,
            (SELECT COUNT(*) FROM enrollments WHERE section_id = s.id AND status='enrolled') AS students,
            (SELECT ROUND(SUM(a.status IN ('present','late')) * 100.0 / NULLIF(COUNT(*),0), 1)
             FROM attendance a JOIN class_sessions cs ON cs.id=a.session_id
             WHERE cs.section_id = s.id) AS att_pct,
            (SELECT ROUND(AVG((g.score / gi.max_score) * 100), 1)
             FROM grades g JOIN grade_items gi ON gi.id=g.grade_item_id
             WHERE gi.section_id = s.id) AS avg_score
     FROM sections s
     JOIN teachers t ON t.id = s.teacher_id
     JOIN users u    ON u.id = t.user_id
     ${sem ? 'WHERE s.semester_id = ?' : ''}
     ORDER BY s.code`,
    sem ? [sem.id] : []
  );

  if (sections.length === 0) {
    doc.font('Helvetica-Oblique').fillColor(COLORS.muted).text('No sections in this semester.');
  } else {
    tableRow(doc,
      ['CODE', 'SUBJECT', 'TEACHER', 'STUDENTS', 'ATT.', 'AVG.'],
      [60, 140, 130, 50, 50, 50],
      { header: true }
    );
    for (const s of sections) {
      tableRow(doc,
        [
          s.code,
          s.subject || '—',
          s.teacher,
          String(s.students),
          s.att_pct == null ? '—' : `${s.att_pct}%`,
          s.avg_score == null ? '—' : String(s.avg_score),
        ],
        [60, 140, 130, 50, 50, 50]
      );
    }
  }

  doc.moveDown(1);

  doc.fillColor(COLORS.accent).fontSize(9).text('ATTENTION', { characterSpacing: 1.2 });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(13).text('Students needing follow-up');
  doc.moveDown(0.4);

  const [atRisk] = await pool.query(
    `SELECT s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            sec.code AS section_code,
            (SELECT ROUND(SUM(a.status IN ('present','late')) * 100.0 / NULLIF(COUNT(*),0), 1)
             FROM attendance a JOIN class_sessions cs ON cs.id=a.session_id
             WHERE cs.section_id = sec.id AND a.student_id = s.id) AS att_pct,
            (SELECT ROUND(AVG((g.score / gi.max_score) * 100), 1)
             FROM grades g JOIN grade_items gi ON gi.id=g.grade_item_id
             WHERE gi.section_id = sec.id AND g.student_id = s.id) AS avg
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     JOIN sections sec ON sec.id = e.section_id
     WHERE e.status = 'enrolled'
       ${sem ? 'AND sec.semester_id = ?' : ''}
     HAVING att_pct < 85 OR avg < 75
     ORDER BY att_pct ASC, avg ASC
     LIMIT 25`,
    sem ? [sem.id] : []
  );

  if (atRisk.length === 0) {
    doc.font('Helvetica-Oblique').fillColor(COLORS.ok).text(
      'No students currently flagged. Good work.'
    );
  } else {
    tableRow(doc,
      ['STUDENT #', 'NAME', 'SECTION', 'ATT.', 'AVG.'],
      [80, 180, 100, 60, 60],
      { header: true }
    );
    for (const a of atRisk) {
      tableRow(doc,
        [
          a.student_number || '—',
          a.name,
          a.section_code,
          a.att_pct == null ? '—' : `${a.att_pct}%`,
          a.avg == null ? '—' : String(a.avg),
        ],
        [80, 180, 100, 60, 60]
      );
    }
  }

  footer(doc);
  doc.end();
}

module.exports = { attendanceReport, studentPerformanceReport, institutionReport };
