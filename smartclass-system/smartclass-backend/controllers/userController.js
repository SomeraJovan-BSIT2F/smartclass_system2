const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');

async function listUsers(req, res) {
  const { role, status, q } = req.query;
  const where = [];
  const params = [];
  if (role)   { where.push('u.role = ?');     params.push(role); }
  if (status) { where.push('u.status = ?');   params.push(status); }
  if (q)      { where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
                params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const sql = `
    SELECT u.id, u.uuid, u.role, u.email, u.first_name, u.last_name, u.status,
           u.created_at, u.last_login_at,
           s.student_number, t.employee_number, t.department
    FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN teachers t ON t.user_id = u.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY u.created_at DESC
    LIMIT 500`;
  const [rows] = await pool.query(sql, params);
  res.json({ users: rows });
}

async function createUser(req, res) {
  const {
    role, email, password, firstName, lastName,
    studentNumber, program, yearLevel, enrolledAt,
    employeeNumber, department, title,
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
    const hash = await bcrypt.hash(password, rounds);
    const [u] = await conn.query(
      `INSERT INTO users (uuid, role, email, password_hash, first_name, last_name)
       VALUES (?,?,?,?,?,?)`,
      [uuidv4(), role, email, hash, firstName, lastName]
    );
    if (role === 'student') {
      await conn.query(
        `INSERT INTO students (user_id, student_number, program, year_level, enrolled_at)
         VALUES (?,?,?,?,?)`,
        [u.insertId, studentNumber, program || null, yearLevel || null,
         enrolledAt || new Date().toISOString().slice(0, 10)]
      );
    } else if (role === 'teacher') {
      await conn.query(
        `INSERT INTO teachers (user_id, employee_number, department, title)
         VALUES (?,?,?,?)`,
        [u.insertId, employeeNumber, department || null, title || null]
      );
    }
    await conn.commit();
    res.status(201).json({ id: u.insertId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'archived', 'suspended'].includes(status)) {
    throw new HttpError(400, 'Invalid status');
  }
  await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  res.json({ ok: true });
}

module.exports = { listUsers, createUser, updateUserStatus };
