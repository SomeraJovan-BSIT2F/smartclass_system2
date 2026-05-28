const { pool } = require('../config/db');

// Institution-wide summary (admin)
async function institutionOverview(req, res) {
  const [[users]] = await pool.query(
    `SELECT
       SUM(role='student') AS students,
       SUM(role='teacher') AS teachers,
       SUM(role='admin')   AS admins
     FROM users WHERE status='active'`
  );
  // Coerce nulls/strings to plain numbers so the frontend always sees 0 for empty.
  const userCounts = {
    students: Number(users?.students) || 0,
    teachers: Number(users?.teachers) || 0,
    admins:   Number(users?.admins)   || 0,
  };

  const [[att]] = await pool.query(
    `SELECT
       ROUND(SUM(a.status IN ('present','late')) * 100.0 /
             NULLIF(COUNT(*),0), 1) AS pct
     FROM attendance a
     JOIN class_sessions cs ON cs.id = a.session_id
     WHERE cs.session_date >= CURDATE() - INTERVAL 7 DAY`
  );
  const [trend] = await pool.query(
    `SELECT cs.session_date AS day,
            SUM(a.status='present') AS present,
            SUM(a.status='late')    AS late,
            SUM(a.status='absent')  AS absent
     FROM attendance a
     JOIN class_sessions cs ON cs.id = a.session_id
     WHERE cs.session_date >= CURDATE() - INTERVAL 14 DAY
     GROUP BY cs.session_date ORDER BY cs.session_date`
  );
  res.json({
    users: userCounts,
    attendancePct: att?.pct == null ? 0 : Number(att.pct),
    trend: trend.map(t => ({
      day: t.day,
      present: Number(t.present) || 0,
      late:    Number(t.late)    || 0,
      absent:  Number(t.absent)  || 0,
    })),
  });
}

// Section-level analytics (teacher)
async function sectionAnalytics(req, res) {
  const { sectionId } = req.params;

  const [trend] = await pool.query(
    `SELECT cs.session_date AS day,
            SUM(a.status='present') AS present,
            SUM(a.status='late')    AS late,
            SUM(a.status='absent')  AS absent,
            SUM(a.status='excused') AS excused
     FROM attendance a
     JOIN class_sessions cs ON cs.id = a.session_id
     WHERE cs.section_id = ?
     GROUP BY cs.session_date
     ORDER BY cs.session_date`,
    [sectionId]
  );

  const [perfTrend] = await pool.query(
    `SELECT DATE_FORMAT(g.recorded_at, '%Y-%u') AS week,
            ROUND(AVG((g.score / gi.max_score) * 100), 2) AS avg
     FROM grades g
     JOIN grade_items gi ON gi.id = g.grade_item_id
     WHERE gi.section_id = ?
     GROUP BY week ORDER BY week`,
    [sectionId]
  );

  const [[summary]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM enrollments
         WHERE section_id = ? AND status='enrolled') AS total_students,
       (SELECT ROUND(SUM(a.status IN ('present','late')) * 100.0 /
                     NULLIF(COUNT(*),0), 1)
        FROM attendance a JOIN class_sessions cs ON cs.id=a.session_id
        WHERE cs.section_id = ?) AS attendance_pct,
       (SELECT ROUND(AVG((g.score / gi.max_score) * 100), 1)
        FROM grades g JOIN grade_items gi ON gi.id = g.grade_item_id
        WHERE gi.section_id = ?) AS class_average`,
    [sectionId, sectionId, sectionId]
  );

  res.json({
    summary: {
      total_students: Number(summary?.total_students) || 0,
      attendance_pct: summary?.attendance_pct == null ? 0 : Number(summary.attendance_pct),
      class_average:  summary?.class_average  == null ? null : Number(summary.class_average),
    },
    trend: trend.map(t => ({
      day:     t.day,
      present: Number(t.present) || 0,
      late:    Number(t.late)    || 0,
      absent:  Number(t.absent)  || 0,
      excused: Number(t.excused) || 0,
    })),
    performanceTrend: perfTrend.map(p => ({
      week: p.week,
      avg:  Number(p.avg) || 0,
    })),
  });
}

async function atRiskStudents(req, res) {
  const { sectionId } = req.query;

  // Teachers only see their own sections
  let teacherFilter = '';
  const params = [];
  if (req.user.role === 'teacher') {
    teacherFilter = `AND e.section_id IN (
      SELECT id FROM sections WHERE teacher_id = (
        SELECT id FROM teachers WHERE user_id = ?
      )
    )`;
    params.push(req.user.sub);
  }
  if (sectionId) {
    teacherFilter += ` AND e.section_id = ?`;
    params.push(sectionId);
  }

  const [rows] = await pool.query(
    `SELECT
       s.id AS student_id,
       s.student_number,
       CONCAT(u.first_name,' ',u.last_name) AS name,
       u.email,
       sec.id AS section_id,
       sec.code AS section_code,
       sec.subject,
       (SELECT ROUND(SUM(a.status IN ('present','late')) * 100.0 /
                     NULLIF(COUNT(*),0), 1)
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.session_id
        WHERE cs.section_id = e.section_id AND a.student_id = s.id
       ) AS attendance_pct,
       (SELECT ROUND(AVG((g.score / gi.max_score) * 100), 1)
        FROM grades g
        JOIN grade_items gi ON gi.id = g.grade_item_id
        WHERE gi.section_id = e.section_id AND g.student_id = s.id
       ) AS average,
       (SELECT COUNT(*) FROM attendance a
        JOIN class_sessions cs ON cs.id = a.session_id
        WHERE cs.section_id = e.section_id AND a.student_id = s.id
          AND a.status = 'absent'
       ) AS absences,
       (SELECT MAX(cs.session_date) FROM attendance a
        JOIN class_sessions cs ON cs.id = a.session_id
        WHERE cs.section_id = e.section_id AND a.student_id = s.id
          AND a.status IN ('present','late')
       ) AS last_attended
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     JOIN sections sec ON sec.id = e.section_id
     WHERE e.status = 'enrolled' ${teacherFilter}
     ORDER BY u.last_name`,
    params
  );

  // Compute risk + reasons
  const flagged = rows
    .map(r => {
      const reasons = [];
      let level = 'low';
      const att = r.attendance_pct == null ? null : Number(r.attendance_pct);
      const avg = r.average == null ? null : Number(r.average);

      if (att != null && att < 75) {
        reasons.push(`Low attendance (${att}%)`);
        level = 'high';
      } else if (att != null && att < 85) {
        reasons.push(`Watch attendance (${att}%)`);
        if (level !== 'high') level = 'medium';
      }
      if (avg != null && avg < 70) {
        reasons.push(`Failing average (${avg})`);
        level = 'high';
      } else if (avg != null && avg < 78) {
        reasons.push(`Low average (${avg})`);
        if (level !== 'high') level = 'medium';
      }
      if (r.absences >= 3) {
        reasons.push(`${r.absences} absences`);
        if (level !== 'high') level = 'medium';
      }

      return { ...r, risk: level, reasons };
    })
    .filter(r => r.risk !== 'low' && r.reasons.length > 0);

  // Group by section
  const bySection = {};
  for (const f of flagged) {
    if (!bySection[f.section_id]) {
      bySection[f.section_id] = {
        section_id: f.section_id,
        section_code: f.section_code,
        subject: f.subject,
        students: [],
      };
    }
    bySection[f.section_id].students.push(f);
  }

  const summary = {
    total: flagged.length,
    high: flagged.filter(f => f.risk === 'high').length,
    medium: flagged.filter(f => f.risk === 'medium').length,
  };

  res.json({ summary, sections: Object.values(bySection) });
}

async function classRanking(req, res) {
  const { sectionId } = req.params;

  const [rows] = await pool.query(
    `SELECT
       s.id,
       s.student_number,
       CONCAT(u.first_name,' ',u.last_name) AS name,
       ROUND(AVG((g.score / gi.max_score) * 100 * gi.weight) /
             NULLIF(AVG(gi.weight), 0), 2) AS average,
       (SELECT ROUND(SUM(a.status IN ('present','late')) * 100.0 /
                     NULLIF(COUNT(*),0), 1)
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.session_id
        WHERE cs.section_id = ? AND a.student_id = s.id
       ) AS attendance_pct,
       COUNT(g.id) AS items_graded
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     LEFT JOIN grades g       ON g.student_id = s.id
     LEFT JOIN grade_items gi ON gi.id = g.grade_item_id
                              AND gi.section_id = e.section_id
     WHERE e.section_id = ? AND e.status = 'enrolled'
     GROUP BY s.id, s.student_number, u.first_name, u.last_name
     ORDER BY average DESC, attendance_pct DESC, u.last_name`,
    [sectionId, sectionId]
  );

  // Assign rank (skip rank for nulls; ties share rank)
  let lastAvg = null;
  let lastRank = 0;
  let position = 0;
  const ranking = rows.map(r => {
    position++;
    if (r.average == null) {
      return { ...r, rank: null };
    }
    if (Number(r.average) !== lastAvg) {
      lastRank = position;
      lastAvg = Number(r.average);
    }
    return { ...r, rank: lastRank };
  });

  // Class statistics
  const validAverages = rows.filter(r => r.average != null).map(r => Number(r.average));
  const stats = {
    total: rows.length,
    graded: validAverages.length,
    mean: validAverages.length
      ? Math.round(validAverages.reduce((a, b) => a + b, 0) / validAverages.length * 100) / 100
      : null,
    median: validAverages.length
      ? validAverages.sort((a, b) => a - b)[Math.floor(validAverages.length / 2)]
      : null,
    highest: validAverages.length ? Math.max(...validAverages) : null,
    lowest: validAverages.length ? Math.min(...validAverages) : null,
  };

  res.json({ ranking, stats });
}

async function engagementMetrics(req, res) {
  const { sectionId } = req.params;

  // Total sessions and average attendance per session
  const [[sessions]] = await pool.query(
    `SELECT COUNT(DISTINCT cs.id) AS total_sessions,
            ROUND(AVG(present_count), 1) AS avg_present_per_session
     FROM class_sessions cs
     LEFT JOIN (
       SELECT session_id, SUM(status IN ('present','late')) AS present_count
       FROM attendance GROUP BY session_id
     ) p ON p.session_id = cs.id
     WHERE cs.section_id = ?`,
    [sectionId]
  );

  // Recitation calls breakdown
  const [[recitation]] = await pool.query(
    `SELECT COUNT(*) AS total_calls,
            COUNT(DISTINCT student_id) AS unique_students
     FROM recitation_calls
     WHERE section_id = ?`,
    [sectionId]
  );

  // Excuse letter counts
  const [[excuses]] = await pool.query(
    `SELECT
       SUM(status='pending')  AS pending,
       SUM(status='approved') AS approved,
       SUM(status='rejected') AS rejected
     FROM excuse_letters
     WHERE section_id = ?`,
    [sectionId]
  );

  // Top streaks (students with most consecutive present)
  const [streakRows] = await pool.query(
    `SELECT s.id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name,
            SUM(a.status IN ('present','late')) AS attended_count,
            COUNT(a.id) AS total_recorded
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u    ON u.id = s.user_id
     LEFT JOIN attendance a ON a.student_id = s.id
     LEFT JOIN class_sessions cs ON cs.id = a.session_id
                                 AND cs.section_id = e.section_id
     WHERE e.section_id = ? AND e.status = 'enrolled'
     GROUP BY s.id, s.student_number, u.first_name, u.last_name
     HAVING attended_count IS NOT NULL
     ORDER BY attended_count DESC
     LIMIT 5`,
    [sectionId]
  );

  res.json({
    sessions: {
      total_sessions: Number(sessions?.total_sessions) || 0,
      avg_present_per_session: sessions?.avg_present_per_session == null ? 0 : Number(sessions.avg_present_per_session),
    },
    recitation: {
      total_calls: Number(recitation?.total_calls) || 0,
      unique_students: Number(recitation?.unique_students) || 0,
    },
    excuses: {
      pending:  Number(excuses?.pending)  || 0,
      approved: Number(excuses?.approved) || 0,
      rejected: Number(excuses?.rejected) || 0,
    },
    topAttenders: streakRows.map(s => ({
      id: s.id,
      student_number: s.student_number,
      name: s.name,
      attended_count: Number(s.attended_count) || 0,
      total_recorded: Number(s.total_recorded) || 0,
    })),
  });
}

module.exports = {
  institutionOverview, sectionAnalytics,
  atRiskStudents, classRanking, engagementMetrics,
};
