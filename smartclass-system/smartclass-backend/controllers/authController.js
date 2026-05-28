const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { HttpError } = require('../middleware/error');

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      uuid: user.uuid,
      role: user.role,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

async function login(req, res) {
  const { email, password } = req.body;

  const [rows] = await pool.query(
    `SELECT id, uuid, role, email, password_hash, first_name, last_name, status
     FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  const user = rows[0];
  if (!user) throw new HttpError(401, 'Invalid email or password');
  if (user.status !== 'active') throw new HttpError(403, 'Account is not active');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  await pool.query(
    `INSERT INTO audit_log (user_id, action, ip_address) VALUES (?,?,?)`,
    [user.id, 'login', req.ip]
  );

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      uuid: user.uuid,
      role: user.role,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      firstName: user.first_name,
      lastName: user.last_name,
    },
  });
}

async function me(req, res) {
  const [rows] = await pool.query(
    `SELECT u.id, u.uuid, u.role, u.email, u.first_name, u.last_name,
            s.student_number, s.program, s.year_level,
            t.employee_number, t.department, t.title
     FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     LEFT JOIN teachers t ON t.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [req.user.sub]
  );
  if (!rows[0]) throw new HttpError(404, 'User not found');
  res.json({ user: rows[0] });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const [rows] = await pool.query(
    'SELECT password_hash FROM users WHERE id = ?',
    [req.user.sub]
  );
  if (!rows[0]) throw new HttpError(404, 'User not found');
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) throw new HttpError(401, 'Current password is incorrect');
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
  const hash = await bcrypt.hash(newPassword, rounds);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.sub]);
  res.json({ ok: true });
}

module.exports = { login, me, changePassword };
