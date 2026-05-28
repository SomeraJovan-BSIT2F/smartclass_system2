const { pool } = require('../config/db');

async function list(req, res) {
  const [rows] = await pool.query(
    `SELECT * FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 100`,
    [req.user.sub]
  );
  const [unread] = await pool.query(
    `SELECT COUNT(*) AS n FROM notifications
     WHERE user_id = ? AND is_read = FALSE`,
    [req.user.sub]
  );
  res.json({ notifications: rows, unread: unread[0].n });
}

async function markRead(req, res) {
  const { id } = req.params;
  await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = ? AND user_id = ?`,
    [id, req.user.sub]
  );
  res.json({ ok: true });
}

async function markAllRead(req, res) {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`,
    [req.user.sub]
  );
  res.json({ ok: true });
}

module.exports = { list, markRead, markAllRead };
