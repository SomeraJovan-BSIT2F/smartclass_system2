const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');

async function listItems(req, res) {
  const { sectionId } = req.query;
  const [rows] = await pool.query(
    `SELECT * FROM grade_items WHERE section_id = ? ORDER BY created_at DESC`,
    [sectionId]
  );
  res.json({ items: rows });
}

async function createItem(req, res) {
  const {
    sectionId, title, category, maxScore, weight, dueDate,
    submissionType, instructions,
  } = req.body;
  const [r] = await pool.query(
    `INSERT INTO grade_items
       (section_id, title, category, max_score, weight, due_date,
        submission_type, instructions)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      sectionId, title, category, maxScore, weight || 1.0, dueDate || null,
      submissionType || 'none', instructions || null,
    ]
  );

  // Notify every enrolled student in this section
  const [section] = await pool.query(
    `SELECT s.code, s.subject FROM sections s WHERE s.id = ?`,
    [sectionId]
  );
  if (section[0]) {
    const [students] = await pool.query(
      `SELECT stu.user_id
       FROM enrollments e
       JOIN students stu ON stu.id = e.student_id
       WHERE e.section_id = ? AND e.status = 'enrolled'`,
      [sectionId]
    );
    if (students.length > 0) {
      const dueText = dueDate
        ? ` · due ${new Date(dueDate).toLocaleDateString()}`
        : '';
      const action = (submissionType === 'file')
        ? '. Upload your work in My Tasks.'
        : '.';
      const values = students.map(s => [
        s.user_id,
        'task',
        `New ${category}: ${title}`,
        `Posted in ${section[0].code} — ${section[0].subject}${dueText}${action}`,
      ]);
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body) VALUES ?`,
        [values]
      );
    }
  }

  res.status(201).json({ id: r.insertId });
}

async function deleteItem(req, res) {
  const { id } = req.params;
  await pool.query('DELETE FROM grade_items WHERE id = ?', [id]);
  res.json({ ok: true });
}

async function recordGrade(req, res) {
  const { gradeItemId, studentId, score, remarks } = req.body;
  await pool.query(
    `INSERT INTO grades (grade_item_id, student_id, score, remarks, recorded_by)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE score=VALUES(score), remarks=VALUES(remarks),
                             recorded_by=VALUES(recorded_by), recorded_at=NOW()`,
    [gradeItemId, studentId, score, remarks || null, req.user.sub]
  );

  const [stu] = await pool.query(
    'SELECT user_id FROM students WHERE id = ?', [studentId]
  );
  const [item] = await pool.query(
    'SELECT title FROM grade_items WHERE id = ?', [gradeItemId]
  );
  if (stu[0] && item[0]) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES (?,?,?,?)`,
      [stu[0].user_id, 'grade', 'Grade posted',
       `${item[0].title}: ${score}`]
    );
  }
  res.json({ ok: true });
}

async function myGrades(req, res) {
  const [rows] = await pool.query(
    `SELECT g.score, g.recorded_at,
            gi.title, gi.category, gi.max_score, gi.weight,
            sec.code AS section_code, sec.subject
     FROM grades g
     JOIN grade_items gi ON gi.id = g.grade_item_id
     JOIN sections sec   ON sec.id = gi.section_id
     JOIN students s     ON s.id = g.student_id
     WHERE s.user_id = ?
     ORDER BY g.recorded_at DESC`,
    [req.user.sub]
  );
  res.json({ grades: rows });
}

// One task with full details (for the detail page)
async function getTaskDetail(req, res) {
  const itemId = Number(req.params.itemId);
  const [[student]] = await pool.query(
    'SELECT id FROM students WHERE user_id = ?',
    [req.user.sub]
  );
  if (!student) throw new HttpError(403, 'Only students can view tasks');

  const [[task]] = await pool.query(
    `SELECT gi.id, gi.title, gi.category, gi.max_score, gi.weight,
            gi.due_date, gi.submission_type, gi.instructions, gi.created_at,
            sec.id AS section_id, sec.code AS section_code, sec.subject,
            g.score, g.recorded_at, g.remarks,
            ts.id AS submission_id, ts.file_name, ts.file_size,
            ts.comment AS submission_comment,
            ts.submitted_at, ts.updated_at AS submission_updated_at
     FROM grade_items gi
     JOIN sections sec ON sec.id = gi.section_id
     JOIN enrollments e ON e.section_id = sec.id AND e.student_id = ?
                       AND e.status = 'enrolled'
     LEFT JOIN grades g           ON g.grade_item_id = gi.id AND g.student_id = ?
     LEFT JOIN task_submissions ts ON ts.grade_item_id = gi.id AND ts.student_id = ?
     WHERE gi.id = ?`,
    [student.id, student.id, student.id, itemId]
  );

  if (!task) throw new HttpError(404, 'Task not found or you are not enrolled');

  const now = new Date();
  const overdue = task.due_date && !task.recorded_at && new Date(task.due_date) < now;
  const status = task.score != null ? 'graded'
               : overdue            ? 'overdue'
               :                      'pending';

  res.json({ task: { ...task, status } });
}

// Student tasks list (pending + graded), now includes submission status
async function myTasks(req, res) {
  const [rows] = await pool.query(
    `SELECT
        gi.id, gi.title, gi.category, gi.max_score, gi.weight, gi.due_date,
        gi.submission_type, gi.created_at,
        sec.id   AS section_id,
        sec.code AS section_code,
        sec.subject,
        g.score, g.recorded_at, g.remarks,
        ts.id   AS submission_id,
        ts.submitted_at
     FROM enrollments e
     JOIN sections sec   ON sec.id = e.section_id AND sec.status = 'active'
     JOIN students stu   ON stu.id = e.student_id
     JOIN grade_items gi ON gi.section_id = sec.id
     LEFT JOIN grades g           ON g.grade_item_id = gi.id AND g.student_id = stu.id
     LEFT JOIN task_submissions ts ON ts.grade_item_id = gi.id AND ts.student_id = stu.id
     WHERE stu.user_id = ? AND e.status = 'enrolled'
     ORDER BY
        CASE WHEN g.score IS NULL THEN 0 ELSE 1 END,
        gi.due_date IS NULL,
        gi.due_date ASC,
        gi.created_at DESC`,
    [req.user.sub]
  );

  const now = new Date();
  const tasks = rows.map(r => {
    const overdue = r.due_date && !r.recorded_at && new Date(r.due_date) < now;
    return {
      ...r,
      submitted: !!r.submission_id,
      status: r.score != null ? 'graded'
            : overdue         ? 'overdue'
            :                   'pending',
    };
  });

  const summary = {
    total:     tasks.length,
    pending:   tasks.filter(t => t.status === 'pending').length,
    overdue:   tasks.filter(t => t.status === 'overdue').length,
    graded:    tasks.filter(t => t.status === 'graded').length,
    submitted: tasks.filter(t => t.submitted && t.status !== 'graded').length,
  };

  res.json({ tasks, summary });
}

async function classRoster(req, res) {
  const { sectionId } = req.params;
  const [rows] = await pool.query(
    `SELECT s.id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            ROUND(AVG((g.score / gi.max_score) * 100 * gi.weight) /
                  NULLIF(AVG(gi.weight),0), 2) AS average,
            (SELECT ROUND(
                      SUM(CASE WHEN a.status IN ('present','late')
                               THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0), 1)
             FROM attendance a
             JOIN class_sessions cs ON cs.id = a.session_id
             WHERE cs.section_id = ? AND a.student_id = s.id
            ) AS attendance_pct
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     LEFT JOIN grades g       ON g.student_id = s.id
     LEFT JOIN grade_items gi ON gi.id = g.grade_item_id
                              AND gi.section_id = e.section_id
     WHERE e.section_id = ? AND e.status='enrolled'
     GROUP BY s.id, s.student_number, u.first_name, u.last_name
     ORDER BY u.last_name`,
    [sectionId, sectionId]
  );

  const roster = rows.map(r => ({
    ...r,
    risk: r.attendance_pct == null ? 'unknown'
          : r.attendance_pct < 75 || (r.average != null && r.average < 70) ? 'high'
          : r.attendance_pct < 85 || (r.average != null && r.average < 78) ? 'medium'
          : 'low',
  }));

  res.json({ roster });
}

async function gradeGrid(req, res) {
  const { sectionId } = req.params;

  const [items] = await pool.query(
    `SELECT id, title, category, max_score, weight, due_date,
            submission_type
     FROM grade_items WHERE section_id = ? ORDER BY created_at ASC`,
    [sectionId]
  );

  const [students] = await pool.query(
    `SELECT s.id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     WHERE e.section_id = ? AND e.status='enrolled'
     ORDER BY u.last_name, u.first_name`,
    [sectionId]
  );

  const [grades] = await pool.query(
    `SELECT g.grade_item_id, g.student_id, g.score, g.remarks
     FROM grades g
     JOIN grade_items gi ON gi.id = g.grade_item_id
     WHERE gi.section_id = ?`,
    [sectionId]
  );

  // Submission counts per item
  const [subs] = await pool.query(
    `SELECT ts.grade_item_id, COUNT(*) AS submission_count
     FROM task_submissions ts
     JOIN grade_items gi ON gi.id = ts.grade_item_id
     WHERE gi.section_id = ?
     GROUP BY ts.grade_item_id`,
    [sectionId]
  );
  const subCounts = Object.fromEntries(
    subs.map(s => [s.grade_item_id, Number(s.submission_count)])
  );
  const itemsWithCounts = items.map(i => ({
    ...i,
    submission_count: subCounts[i.id] || 0,
  }));

  const grid = {};
  for (const g of grades) {
    grid[`${g.student_id}-${g.grade_item_id}`] = {
      score: Number(g.score),
      remarks: g.remarks,
    };
  }

  res.json({ items: itemsWithCounts, students, grid });
}

// (recitationCall, recitationHistory, generateGroups, attendanceTrend unchanged)

async function recitationCall(req, res) {
  const { sectionId } = req.params;
  const mode = req.query.mode || 'fair';

  const [rows] = await pool.query(
    `SELECT s.id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            COALESCE(rc.call_count, 0) AS call_count
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     LEFT JOIN (
       SELECT student_id, COUNT(*) AS call_count
       FROM recitation_calls
       WHERE section_id = ?
       GROUP BY student_id
     ) rc ON rc.student_id = s.id
     WHERE e.section_id = ? AND e.status='enrolled'`,
    [sectionId, sectionId]
  );

  if (rows.length === 0) {
    throw new HttpError(400, 'No students enrolled in this section');
  }

  let pick;
  if (mode === 'random') {
    pick = rows[Math.floor(Math.random() * rows.length)];
  } else {
    const minCalls = Math.min(...rows.map(r => Number(r.call_count)));
    const candidates = rows.filter(r => Number(r.call_count) === minCalls);
    pick = candidates[Math.floor(Math.random() * candidates.length)];
  }

  await pool.query(
    `INSERT INTO recitation_calls (section_id, student_id, called_by)
     VALUES (?,?,?)`,
    [sectionId, pick.id, req.user.sub]
  );

  res.json({
    student: {
      id: pick.id,
      student_number: pick.student_number,
      name: pick.name,
      previous_calls: Number(pick.call_count),
    }
  });
}

async function recitationHistory(req, res) {
  const { sectionId } = req.params;
  const [rows] = await pool.query(
    `SELECT rc.id, rc.called_at,
            s.id AS student_id,
            s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name
     FROM recitation_calls rc
     JOIN students s ON s.id = rc.student_id
     JOIN users u    ON u.id = s.user_id
     WHERE rc.section_id = ?
     ORDER BY rc.called_at DESC
     LIMIT 50`,
    [sectionId]
  );
  res.json({ history: rows });
}

async function generateGroups(req, res) {
  const { sectionId } = req.params;
  const groupCount = Math.max(2, Math.min(20, Number(req.query.count) || 4));
  const mode = req.query.mode || 'random';

  const [students] = await pool.query(
    `SELECT s.id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            ROUND(AVG((g.score / gi.max_score) * 100), 2) AS average
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     LEFT JOIN grades g       ON g.student_id = s.id
     LEFT JOIN grade_items gi ON gi.id = g.grade_item_id
                              AND gi.section_id = e.section_id
     WHERE e.section_id = ? AND e.status='enrolled'
     GROUP BY s.id, s.student_number, u.first_name, u.last_name`,
    [sectionId]
  );

  if (students.length === 0) {
    throw new HttpError(400, 'No students enrolled in this section');
  }

  const groups = Array.from({ length: groupCount }, () => []);

  if (mode === 'balanced') {
    const sorted = [...students].sort((a, b) => {
      const aa = a.average == null ? -1 : Number(a.average);
      const bb = b.average == null ? -1 : Number(b.average);
      return bb - aa;
    });
    sorted.forEach((s, i) => {
      const round = Math.floor(i / groupCount);
      const pos = i % groupCount;
      const groupIdx = round % 2 === 0 ? pos : groupCount - 1 - pos;
      groups[groupIdx].push(s);
    });
  } else {
    const arr = [...students];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    arr.forEach((s, i) => groups[i % groupCount].push(s));
  }

  const result = groups.map((members, i) => ({
    name: `Group ${i + 1}`,
    members,
    avg: members.filter(m => m.average != null).length
      ? Math.round(
          members.filter(m => m.average != null)
            .reduce((sum, m) => sum + Number(m.average), 0) /
          members.filter(m => m.average != null).length
        )
      : null,
  }));

  res.json({ groups: result, mode, count: groupCount });
}

async function attendanceTrend(req, res) {
  const { sectionId } = req.params;
  const period = req.query.period || 'daily';

  let dateFormat;
  if (period === 'weekly') dateFormat = `DATE_FORMAT(cs.session_date, '%x-W%v')`;
  else if (period === 'monthly') dateFormat = `DATE_FORMAT(cs.session_date, '%Y-%m')`;
  else dateFormat = `DATE_FORMAT(cs.session_date, '%Y-%m-%d')`;

  const [rows] = await pool.query(
    `SELECT ${dateFormat} AS period_key,
            MIN(cs.session_date) AS period_start,
            SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN a.status='late'    THEN 1 ELSE 0 END) AS late,
            SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) AS excused,
            COUNT(*) AS total
     FROM class_sessions cs
     JOIN attendance a ON a.session_id = cs.id
     WHERE cs.section_id = ?
     GROUP BY period_key
     ORDER BY period_key`,
    [sectionId]
  );

  res.json({ period, data: rows });
}

module.exports = {
  listItems, createItem, deleteItem,
  recordGrade, myGrades, myTasks, getTaskDetail, classRoster,
  gradeGrid,
  recitationCall, recitationHistory,
  generateGroups,
  attendanceTrend,
};
