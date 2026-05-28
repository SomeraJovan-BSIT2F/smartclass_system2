const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            Number(process.env.DB_PORT) || 3306,
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'smartclass_qr',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit:      0,
  timezone:        'Z',
  dateStrings:     false,
  charset:         'utf8mb4',
});

// Friendly health check on boot
async function ping() {
  const conn = await pool.getConnection();
  try { await conn.ping(); } finally { conn.release(); }
}

module.exports = { pool, ping };
