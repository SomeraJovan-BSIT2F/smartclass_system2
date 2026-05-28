// db/migrate.js — runs schema.sql against the configured database
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  try {
    console.log('▶ Applying schema...');
    await conn.query(sql);
    console.log('✓ Migration complete');
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
