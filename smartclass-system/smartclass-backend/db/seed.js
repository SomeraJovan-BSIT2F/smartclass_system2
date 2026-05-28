// db/seed.js — populates the database with realistic demo data
require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

const PWD = 'Password123!';
const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const tokenHex = () => crypto.randomBytes(32).toString('hex');

async function run() {
  const hash = await bcrypt.hash(PWD, ROUNDS);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('▶ Clearing existing data...');
    const tables = [
      'audit_log','notifications','excuse_letters','grades','grade_items',
      'attendance','class_sessions','qr_codes','enrollments','sections',
      'semesters','teachers','students','users',
    ];
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    for (const t of tables) await conn.query(`TRUNCATE TABLE ${t}`);
    await conn.query('SET FOREIGN_KEY_CHECKS=1');

    // --- Semester ---
    console.log('▶ Seeding semester...');
    const [sem] = await conn.query(
      `INSERT INTO semesters (code,label,start_date,end_date,is_active)
       VALUES (?,?,?,?,TRUE)`,
      ['2025-2026-1','1st Semester 2025–2026','2026-01-15','2026-08-31']
    );
    const semesterId = sem.insertId;

    // --- Admin ---
    console.log('▶ Seeding admin...');
    await conn.query(
      `INSERT INTO users (uuid,role,email,password_hash,first_name,last_name)
       VALUES (?,?,?,?,?,?)`,
      [uuidv4(),'admin','admin@smartclass.edu',hash,'Eleanor','Reyes']
    );

    // --- Teacher ---
    console.log('▶ Seeding teacher...');
    const [teacherUser] = await conn.query(
      `INSERT INTO users (uuid,role,email,password_hash,first_name,last_name)
       VALUES (?,?,?,?,?,?)`,
      [uuidv4(),'teacher','almonte@smartclass.edu',hash,'Maria','Almonte']
    );
    const [teacher] = await conn.query(
      `INSERT INTO teachers (user_id,employee_number,department,title)
       VALUES (?,?,?,?)`,
      [teacherUser.insertId,'EMP-0001','Computer Science','Prof.']
    );
    const teacherId = teacher.insertId;

    // --- Section ---
    console.log('▶ Seeding section...');
    const [section] = await conn.query(
      `INSERT INTO sections (semester_id,teacher_id,code,subject,schedule,room)
       VALUES (?,?,?,?,?,?)`,
      [semesterId,teacherId,'BSCS-3A','Software Engineering','MWF 9:00–10:30','RM-204']
    );
    const sectionId = section.insertId;

    // --- Students ---
    console.log('▶ Seeding students...');
    const studentRoster = [
      ['Adelia','Moreno',     '2025-0142'],
      ['Bennett','Cruz',      '2025-0156'],
      ['Carmela','Villanueva','2025-0173'],
      ['Dario','Ocampo',      '2025-0189'],
      ['Esperanza','Lim',     '2025-0201'],
      ['Francisco','Datu',    '2025-0218'],
      ['Gabriela','Reyes',    '2025-0224'],
      ['Hiraya','Santos',     '2025-0237'],
    ];
    const studentIds = [];
    for (const [first, last, num] of studentRoster) {
      const [u] = await conn.query(
        `INSERT INTO users (uuid,role,email,password_hash,first_name,last_name)
         VALUES (?,?,?,?,?,?)`,
        [uuidv4(),'student',`${first.toLowerCase()}@smartclass.edu`,hash,first,last]
      );
      const [s] = await conn.query(
        `INSERT INTO students (user_id,student_number,program,year_level,enrolled_at)
         VALUES (?,?,?,?,?)`,
        [u.insertId,num,'BS Computer Science',3,'2023-08-15']
      );
      studentIds.push(s.insertId);
      // enroll
      await conn.query(
        `INSERT INTO enrollments (section_id,student_id) VALUES (?,?)`,
        [sectionId,s.insertId]
      );
      // QR code
      await conn.query(
        `INSERT INTO qr_codes (student_id,semester_id,token,expires_at)
         VALUES (?,?,?,?)`,
        [s.insertId,semesterId,tokenHex(),'2026-08-31 23:59:59']
      );
    }

    // --- Past sessions + attendance ---
    console.log('▶ Seeding sessions and attendance...');
    const today = new Date();
    for (let d = 14; d >= 1; d--) {
      const day = new Date(today); day.setDate(today.getDate() - d);
      // only weekdays
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      const ymd = day.toISOString().slice(0,10);
      const [sess] = await conn.query(
        `INSERT INTO class_sessions (section_id,session_date,started_at,ended_at)
         VALUES (?,?,?,?)`,
        [sectionId,ymd,`${ymd} 09:00:00`,`${ymd} 10:30:00`]
      );
      for (const sid of studentIds) {
        const r = Math.random();
        let status = 'present', scannedAt = `${ymd} 09:0${Math.floor(Math.random()*9)}:00`;
        if (r > 0.92) { status = 'absent';  scannedAt = null; }
        else if (r > 0.85) { status = 'late'; }
        await conn.query(
          `INSERT INTO attendance (session_id,student_id,status,scanned_at,scanned_by,source)
           VALUES (?,?,?,?,?,?)`,
          [sess.insertId,sid,status,scannedAt,scannedAt ? teacherUser.insertId : null,
           scannedAt ? 'qr' : 'manual']
        );
      }
    }

    // --- Grade items + grades ---
    console.log('▶ Seeding grades...');
    const items = [
      ['Quiz 1: Requirements',  'quiz',         20, 1.0],
      ['Activity 1: Use Cases', 'activity',     30, 1.0],
      ['Quiz 2: Architecture',  'quiz',         25, 1.0],
      ['Participation Wk 1-4',  'participation',10, 0.5],
    ];
    for (const [title,cat,max,wt] of items) {
      const [gi] = await conn.query(
        `INSERT INTO grade_items (section_id,title,category,max_score,weight)
         VALUES (?,?,?,?,?)`,
        [sectionId,title,cat,max,wt]
      );
      for (const sid of studentIds) {
        const score = Math.round((max * (0.65 + Math.random() * 0.35)) * 100) / 100;
        await conn.query(
          `INSERT INTO grades (grade_item_id,student_id,score,recorded_by)
           VALUES (?,?,?,?)`,
          [gi.insertId,sid,score,teacherUser.insertId]
        );
      }
    }

    // --- An excuse letter ---
    await conn.query(
      `INSERT INTO excuse_letters
        (student_id,section_id,absence_date,reason_type,explanation,status)
       VALUES (?,?,?,?,?,?)`,
      [studentIds[2],sectionId,'2025-11-04','medical',
       'Diagnosed with flu; medical certificate attached.','pending']
    );

    // --- A few notifications ---
    await conn.query(
      `INSERT INTO notifications (user_id,type,title,body)
       VALUES (?,?,?,?), (?,?,?,?)`,
      [
        teacherUser.insertId,'excuse','Excuse letter pending review',
        'Submitted by Carmela Villanueva for 2025-11-04',
        teacherUser.insertId,'system','Welcome to SmartClass QR',
        'Your account is ready. Tap the camera icon to begin scanning.',
      ]
    );

    await conn.commit();
    console.log('\n✓ Seed complete.');
    console.log(`\n  Login credentials (all accounts use password: ${PWD})`);
    console.log('  ──────────────────────────────────────────────────');
    console.log('  Admin   → admin@smartclass.edu');
    console.log('  Teacher → almonte@smartclass.edu');
    console.log('  Student → adelia@smartclass.edu (or any first name above)');
  } catch (err) {
    await conn.rollback();
    console.error('✗ Seed failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();