const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');

async function ensureTeacherOwnsItem(itemId, userId, role) {
  if (role === 'admin') return;
  const [[r]] = await pool.query(
    `SELECT t.user_id FROM grade_items gi
     JOIN sections s  ON s.id  = gi.section_id
     JOIN teachers t  ON t.id  = s.teacher_id
     WHERE gi.id = ?`,
    [itemId]
  );
  if (!r) throw new HttpError(404, 'Quiz not found');
  if (r.user_id !== userId) {
    throw new HttpError(403, 'You can only manage your own quizzes');
  }
}

async function ensureStudentEnrolled(itemId, userId) {
  const [[r]] = await pool.query(
    `SELECT stu.id AS student_id
     FROM grade_items gi
     JOIN sections sec     ON sec.id = gi.section_id
     JOIN enrollments e    ON e.section_id = sec.id AND e.status = 'enrolled'
     JOIN students stu     ON stu.id = e.student_id
     WHERE gi.id = ? AND stu.user_id = ?`,
    [itemId, userId]
  );
  if (!r) throw new HttpError(403, 'You are not enrolled in this section');
  return r.student_id;
}

async function recomputeFinalScore(itemId, studentId) {
  const [[item]] = await pool.query(
    `SELECT max_score FROM grade_items WHERE id = ?`, [itemId]
  );
  if (!item) return;

  const [[sum]] = await pool.query(
    `SELECT
        SUM(q.points) AS total_points,
        SUM(CASE WHEN a.awarded_points IS NOT NULL THEN a.awarded_points ELSE 0 END) AS earned,
        SUM(CASE WHEN a.awarded_points IS NULL AND a.id IS NOT NULL THEN 1 ELSE 0 END) AS pending_count,
        COUNT(q.id) AS question_count,
        COUNT(a.id) AS answer_count
     FROM quiz_questions q
     LEFT JOIN quiz_answers a ON a.question_id = q.id AND a.student_id = ?
     WHERE q.grade_item_id = ?`,
    [studentId, itemId]
  );

  if (!sum.question_count || !sum.answer_count) return;

  const totalPoints = Number(sum.total_points) || 0;
  const earned = Number(sum.earned) || 0;
  const pendingCount = Number(sum.pending_count) || 0;

  if (pendingCount > 0) return;

  const finalScore = totalPoints > 0
    ? Math.round((earned / totalPoints) * Number(item.max_score) * 100) / 100
    : 0;

  await pool.query(
    `INSERT INTO grades (grade_item_id, student_id, score, remarks, recorded_by)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       score = VALUES(score),
       remarks = VALUES(remarks),
       recorded_at = NOW()`,
    [itemId, studentId, finalScore, 'Auto-computed from quiz', null]
  );

  const [[stu]] = await pool.query(
    'SELECT user_id FROM students WHERE id = ?', [studentId]
  );
  const [[gi]] = await pool.query(
    'SELECT title FROM grade_items WHERE id = ?', [itemId]
  );
  if (stu && gi) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)`,
      [stu.user_id, 'grade', 'Quiz graded',
       `${gi.title}: ${finalScore} / ${item.max_score}`]
    );
  }
}

async function listQuestions(req, res) {
  const itemId = Number(req.params.itemId);
  await ensureTeacherOwnsItem(itemId, req.user.sub, req.user.role);

  const [questions] = await pool.query(
    `SELECT id, position, type, prompt, points, correct_text, correct_bool
     FROM quiz_questions WHERE grade_item_id = ?
     ORDER BY position ASC, id ASC`,
    [itemId]
  );

  const ids = questions.map(q => q.id);
  let choices = [];
  if (ids.length) {
    [choices] = await pool.query(
      `SELECT id, question_id, position, text, is_correct
       FROM quiz_choices WHERE question_id IN (?)
       ORDER BY position ASC`,
      [ids]
    );
  }

  const grouped = questions.map(q => ({
    ...q,
    points: Number(q.points),
    correct_bool: q.correct_bool == null ? null : Number(q.correct_bool),
    choices: choices
      .filter(c => c.question_id === q.id)
      .map(c => ({ ...c, is_correct: !!c.is_correct })),
  }));

  const [[itemRow]] = await pool.query(
    `SELECT title, max_score FROM grade_items WHERE id = ?`, [itemId]
  );
  const totalPoints = grouped.reduce((s, q) => s + Number(q.points), 0);

  res.json({ questions: grouped, totalPoints, item: itemRow });
}

async function upsertQuestion(req, res) {
  const itemId = Number(req.params.itemId);
  await ensureTeacherOwnsItem(itemId, req.user.sub, req.user.role);

  const { id, type, prompt, points, position, correctText, correctBool, choices } = req.body;

  if (!['multiple_choice','true_false','short_answer','essay'].includes(type)) {
    throw new HttpError(400, 'Invalid question type');
  }
  if (!prompt || !String(prompt).trim()) {
    throw new HttpError(400, 'Question prompt is required');
  }
  if (!Number.isFinite(Number(points)) || Number(points) <= 0) {
    throw new HttpError(400, 'Points must be a positive number');
  }

  if (type === 'multiple_choice') {
    if (!Array.isArray(choices) || choices.length < 2) {
      throw new HttpError(400, 'Multiple choice needs at least 2 choices');
    }
    if (!choices.some(c => c.is_correct)) {
      throw new HttpError(400, 'Mark at least one choice as correct');
    }
  }
  if (type === 'true_false' && correctBool == null) {
    throw new HttpError(400, 'Pick true or false as the correct answer');
  }
  if (type === 'short_answer' && (!correctText || !String(correctText).trim())) {
    throw new HttpError(400, 'Provide the correct text for short answer');
  }

  let questionId = id;
  if (questionId) {
    await pool.query(
      `UPDATE quiz_questions
       SET type = ?, prompt = ?, points = ?, position = ?,
           correct_text = ?, correct_bool = ?
       WHERE id = ? AND grade_item_id = ?`,
      [type, prompt, points, position || 1,
       type === 'short_answer' ? correctText : null,
       type === 'true_false' ? (correctBool ? 1 : 0) : null,
       questionId, itemId]
    );
  } else {
    const [r] = await pool.query(
      `INSERT INTO quiz_questions
        (grade_item_id, position, type, prompt, points, correct_text, correct_bool)
       VALUES (?,?,?,?,?,?,?)`,
      [itemId, position || 1, type, prompt, points,
       type === 'short_answer' ? correctText : null,
       type === 'true_false' ? (correctBool ? 1 : 0) : null]
    );
    questionId = r.insertId;
  }

  if (type === 'multiple_choice') {
    await pool.query(`DELETE FROM quiz_choices WHERE question_id = ?`, [questionId]);
    const values = choices.map((c, i) => [
      questionId, i + 1, String(c.text || '').trim(), c.is_correct ? 1 : 0,
    ]);
    if (values.length) {
      await pool.query(
        `INSERT INTO quiz_choices (question_id, position, text, is_correct) VALUES ?`,
        [values]
      );
    }
  } else {
    await pool.query(`DELETE FROM quiz_choices WHERE question_id = ?`, [questionId]);
  }

  res.status(id ? 200 : 201).json({ id: questionId });
}

async function deleteQuestion(req, res) {
  const itemId = Number(req.params.itemId);
  const qId = Number(req.params.questionId);
  await ensureTeacherOwnsItem(itemId, req.user.sub, req.user.role);

  await pool.query(
    `DELETE FROM quiz_questions WHERE id = ? AND grade_item_id = ?`,
    [qId, itemId]
  );
  res.json({ ok: true });
}

async function getQuizForStudent(req, res) {
  const itemId = Number(req.params.itemId);
  const studentId = await ensureStudentEnrolled(itemId, req.user.sub);

  const [[item]] = await pool.query(
    `SELECT id, title, instructions, max_score, due_date,
            (SELECT code FROM sections WHERE id = section_id) AS section_code,
            (SELECT subject FROM sections WHERE id = section_id) AS subject
     FROM grade_items WHERE id = ?`,
    [itemId]
  );
  if (!item) throw new HttpError(404, 'Quiz not found');

  const [questions] = await pool.query(
    `SELECT id, position, type, prompt, points
     FROM quiz_questions WHERE grade_item_id = ?
     ORDER BY position ASC, id ASC`,
    [itemId]
  );

  const ids = questions.map(q => q.id);
  let choices = [];
  if (ids.length) {
    [choices] = await pool.query(
      `SELECT id, question_id, position, text
       FROM quiz_choices WHERE question_id IN (?)
       ORDER BY position ASC`,
      [ids]
    );
  }

  const [[submitted]] = await pool.query(
    `SELECT COUNT(*) AS c FROM quiz_answers a
     JOIN quiz_questions q ON q.id = a.question_id
     WHERE q.grade_item_id = ? AND a.student_id = ?`,
    [itemId, studentId]
  );
  const alreadySubmitted = Number(submitted.c) > 0;

  const grouped = questions.map(q => ({
    ...q,
    points: Number(q.points),
    choices: choices
      .filter(c => c.question_id === q.id)
      .map(c => ({ id: c.id, position: c.position, text: c.text })),
  }));

  res.json({
    item, questions: grouped,
    totalPoints: grouped.reduce((s, q) => s + Number(q.points), 0),
    alreadySubmitted,
  });
}

async function submitQuiz(req, res) {
  const itemId = Number(req.params.itemId);
  const studentId = await ensureStudentEnrolled(itemId, req.user.sub);

  const { answers } = req.body;
  if (!Array.isArray(answers)) {
    throw new HttpError(400, 'Answers must be an array');
  }

  const [[exists]] = await pool.query(
    `SELECT COUNT(*) AS c FROM quiz_answers a
     JOIN quiz_questions q ON q.id = a.question_id
     WHERE q.grade_item_id = ? AND a.student_id = ?`,
    [itemId, studentId]
  );
  if (Number(exists.c) > 0) {
    throw new HttpError(400, 'You have already submitted this quiz');
  }

  const [questions] = await pool.query(
    `SELECT id, type, points, correct_text, correct_bool
     FROM quiz_questions WHERE grade_item_id = ?`,
    [itemId]
  );
  if (questions.length === 0) {
    throw new HttpError(400, 'Quiz has no questions yet');
  }

  const qIds = questions.map(q => q.id);
  const [choices] = await pool.query(
    `SELECT id, question_id, is_correct FROM quiz_choices WHERE question_id IN (?)`,
    [qIds]
  );
  const correctChoiceByQ = {};
  for (const c of choices) {
    if (c.is_correct) correctChoiceByQ[c.question_id] = c.id;
  }

  const rows = [];
  for (const q of questions) {
    const ans = answers.find(a => Number(a.questionId) === q.id);
    let choiceId = null, answerBool = null, answerText = null;
    let awarded = null, isAuto = 0;

    if (q.type === 'multiple_choice') {
      if (ans && ans.choiceId != null) {
        choiceId = Number(ans.choiceId);
        awarded = correctChoiceByQ[q.id] === choiceId ? Number(q.points) : 0;
      } else {
        awarded = 0;
      }
      isAuto = 1;
    } else if (q.type === 'true_false') {
      if (ans && (ans.answerBool === true || ans.answerBool === false ||
                  ans.answerBool === 1 || ans.answerBool === 0)) {
        const got = (ans.answerBool === true || ans.answerBool === 1) ? 1 : 0;
        answerBool = got;
        awarded = got === Number(q.correct_bool) ? Number(q.points) : 0;
      } else {
        awarded = 0;
      }
      isAuto = 1;
    } else if (q.type === 'short_answer') {
      answerText = (ans && typeof ans.answerText === 'string') ? ans.answerText.trim() : '';
      const correct = String(q.correct_text || '').trim().toLowerCase();
      const given = answerText.toLowerCase();
      awarded = (given && given === correct) ? Number(q.points) : 0;
      isAuto = 1;
    } else if (q.type === 'essay') {
      answerText = (ans && typeof ans.answerText === 'string') ? ans.answerText.trim() : '';
      awarded = null;
      isAuto = 0;
    }

    rows.push([q.id, studentId, choiceId, answerBool, answerText, awarded, isAuto]);
  }

  await pool.query(
    `INSERT INTO quiz_answers
       (question_id, student_id, choice_id, answer_bool, answer_text,
        awarded_points, is_auto_graded)
     VALUES ?`,
    [rows]
  );

  await recomputeFinalScore(itemId, studentId);

  const hasEssay = questions.some(q => q.type === 'essay');
  if (hasEssay) {
    const [[teacher]] = await pool.query(
      `SELECT t.user_id FROM grade_items gi
       JOIN sections s ON s.id = gi.section_id
       JOIN teachers t ON t.id = s.teacher_id
       WHERE gi.id = ?`,
      [itemId]
    );
    const [[me]] = await pool.query(
      `SELECT CONCAT(u.first_name,' ',u.last_name) AS name
       FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [studentId]
    );
    const [[gi]] = await pool.query(
      `SELECT title FROM grade_items WHERE id = ?`, [itemId]
    );
    if (teacher && me && gi) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)`,
        [teacher.user_id, 'task', 'Quiz submission needs review',
         `${me.name} submitted ${gi.title}. Essay questions need grading.`]
      );
    }
  }

  res.status(201).json({ ok: true });
}

async function getMyQuizResults(req, res) {
  const itemId = Number(req.params.itemId);
  const studentId = await ensureStudentEnrolled(itemId, req.user.sub);

  const [[item]] = await pool.query(
    `SELECT id, title, max_score FROM grade_items WHERE id = ?`, [itemId]
  );

  const [questions] = await pool.query(
    `SELECT id, position, type, prompt, points, correct_text, correct_bool
     FROM quiz_questions WHERE grade_item_id = ?
     ORDER BY position ASC, id ASC`,
    [itemId]
  );

  const qIds = questions.map(q => q.id);
  let choices = [], answers = [];
  if (qIds.length) {
    [choices] = await pool.query(
      `SELECT id, question_id, position, text, is_correct
       FROM quiz_choices WHERE question_id IN (?) ORDER BY position`,
      [qIds]
    );
    [answers] = await pool.query(
      `SELECT question_id, choice_id, answer_bool, answer_text,
              awarded_points, is_auto_graded
       FROM quiz_answers WHERE student_id = ? AND question_id IN (?)`,
      [studentId, qIds]
    );
  }

  const grouped = questions.map(q => {
    const a = answers.find(x => x.question_id === q.id) || null;
    return {
      ...q,
      points: Number(q.points),
      correct_bool: q.correct_bool == null ? null : Number(q.correct_bool),
      choices: choices
        .filter(c => c.question_id === q.id)
        .map(c => ({ ...c, is_correct: !!c.is_correct })),
      answer: a ? {
        choice_id: a.choice_id,
        answer_bool: a.answer_bool,
        answer_text: a.answer_text,
        awarded_points: a.awarded_points == null ? null : Number(a.awarded_points),
        is_auto_graded: !!a.is_auto_graded,
      } : null,
    };
  });

  const [[grade]] = await pool.query(
    `SELECT score, remarks, recorded_at FROM grades
     WHERE grade_item_id = ? AND student_id = ?`,
    [itemId, studentId]
  );

  res.json({
    item, questions: grouped,
    grade: grade || null,
    totalPoints: grouped.reduce((s, q) => s + Number(q.points), 0),
    earnedPoints: grouped.reduce(
      (s, q) => s + (q.answer?.awarded_points || 0), 0
    ),
    pendingReview: grouped.some(q => q.answer && q.answer.awarded_points == null),
  });
}

async function listQuizSubmissions(req, res) {
  const itemId = Number(req.params.itemId);
  await ensureTeacherOwnsItem(itemId, req.user.sub, req.user.role);

  const [[item]] = await pool.query(
    `SELECT gi.id, gi.title, gi.max_score, gi.section_id,
            s.code AS section_code, s.subject
     FROM grade_items gi
     JOIN sections s ON s.id = gi.section_id
     WHERE gi.id = ?`,
    [itemId]
  );
  if (!item) throw new HttpError(404, 'Quiz not found');

  const [rows] = await pool.query(
    `SELECT
        stu.id AS student_id, stu.student_number,
        CONCAT(u.first_name,' ',u.last_name) AS student_name,
        MIN(qa.submitted_at) AS submitted_at,
        SUM(CASE WHEN qa.id IS NOT NULL THEN 1 ELSE 0 END) AS answered_count,
        SUM(CASE WHEN qa.awarded_points IS NULL AND qa.id IS NOT NULL THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN qa.awarded_points IS NOT NULL THEN qa.awarded_points ELSE 0 END) AS earned,
        g.score AS final_score
     FROM enrollments e
     JOIN students stu ON stu.id = e.student_id
     JOIN users u      ON u.id = stu.user_id
     LEFT JOIN quiz_questions q ON q.grade_item_id = ?
     LEFT JOIN quiz_answers qa  ON qa.question_id = q.id AND qa.student_id = stu.id
     LEFT JOIN grades g         ON g.grade_item_id = ? AND g.student_id = stu.id
     WHERE e.section_id = ? AND e.status = 'enrolled'
     GROUP BY stu.id, stu.student_number, u.first_name, u.last_name, g.score
     ORDER BY u.last_name, u.first_name`,
    [itemId, itemId, item.section_id]
  );

  const [[totals]] = await pool.query(
    `SELECT SUM(points) AS total_points, COUNT(*) AS question_count
     FROM quiz_questions WHERE grade_item_id = ?`,
    [itemId]
  );

  res.json({
    item,
    submissions: rows.map(r => ({
      ...r,
      answered_count: Number(r.answered_count),
      pending_count: Number(r.pending_count),
      earned: Number(r.earned),
      submitted: Number(r.answered_count) > 0,
    })),
    totalPoints: Number(totals.total_points) || 0,
    questionCount: Number(totals.question_count) || 0,
  });
}

async function getStudentSubmission(req, res) {
  const itemId = Number(req.params.itemId);
  const studentId = Number(req.params.studentId);
  await ensureTeacherOwnsItem(itemId, req.user.sub, req.user.role);

  const [[item]] = await pool.query(
    `SELECT id, title, max_score FROM grade_items WHERE id = ?`, [itemId]
  );

  const [[student]] = await pool.query(
    `SELECT s.id, s.student_number,
            CONCAT(u.first_name,' ',u.last_name) AS name
     FROM students s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    [studentId]
  );
  if (!student) throw new HttpError(404, 'Student not found');

  const [questions] = await pool.query(
    `SELECT id, position, type, prompt, points, correct_text, correct_bool
     FROM quiz_questions WHERE grade_item_id = ?
     ORDER BY position ASC, id ASC`,
    [itemId]
  );
  const qIds = questions.map(q => q.id);
  let choices = [], answers = [];
  if (qIds.length) {
    [choices] = await pool.query(
      `SELECT id, question_id, position, text, is_correct
       FROM quiz_choices WHERE question_id IN (?) ORDER BY position`,
      [qIds]
    );
    [answers] = await pool.query(
      `SELECT id, question_id, choice_id, answer_bool, answer_text,
              awarded_points, is_auto_graded
       FROM quiz_answers WHERE student_id = ? AND question_id IN (?)`,
      [studentId, qIds]
    );
  }

  const grouped = questions.map(q => {
    const a = answers.find(x => x.question_id === q.id) || null;
    return {
      ...q,
      points: Number(q.points),
      correct_bool: q.correct_bool == null ? null : Number(q.correct_bool),
      choices: choices
        .filter(c => c.question_id === q.id)
        .map(c => ({ ...c, is_correct: !!c.is_correct })),
      answer: a ? {
        id: a.id,
        choice_id: a.choice_id,
        answer_bool: a.answer_bool,
        answer_text: a.answer_text,
        awarded_points: a.awarded_points == null ? null : Number(a.awarded_points),
        is_auto_graded: !!a.is_auto_graded,
      } : null,
    };
  });

  res.json({ item, student, questions: grouped });
}

async function gradeEssay(req, res) {
  const itemId = Number(req.params.itemId);
  const answerId = Number(req.params.answerId);
  await ensureTeacherOwnsItem(itemId, req.user.sub, req.user.role);

  const { awardedPoints } = req.body;
  const pts = Number(awardedPoints);
  if (!Number.isFinite(pts) || pts < 0) {
    throw new HttpError(400, 'Awarded points must be a number >= 0');
  }

  const [[ans]] = await pool.query(
    `SELECT a.id, a.student_id, q.points AS max_points
     FROM quiz_answers a
     JOIN quiz_questions q ON q.id = a.question_id
     WHERE a.id = ? AND q.grade_item_id = ?`,
    [answerId, itemId]
  );
  if (!ans) throw new HttpError(404, 'Answer not found');
  if (pts > Number(ans.max_points)) {
    throw new HttpError(400, `Cannot award more than ${ans.max_points} points`);
  }

  await pool.query(
    `UPDATE quiz_answers SET awarded_points = ? WHERE id = ?`,
    [pts, answerId]
  );

  await recomputeFinalScore(itemId, ans.student_id);

  res.json({ ok: true });
}

module.exports = {
  listQuestions, upsertQuestion, deleteQuestion,
  getQuizForStudent, submitQuiz, getMyQuizResults,
  listQuizSubmissions, getStudentSubmission, gradeEssay,
};
