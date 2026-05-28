-- ============================================================================
--  SmartClass QR — Database Schema
--  MySQL 8.0+ (utf8mb4, InnoDB, foreign keys ON)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS smartclass_qr
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE smartclass_qr;

-- ─── Users ─────────────────────────────────────────────────────────────────
-- All authenticated accounts: admins, teachers, students.
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid            CHAR(36) NOT NULL UNIQUE,
  role            ENUM('admin','teacher','student') NOT NULL,
  email           VARCHAR(190) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  first_name      VARCHAR(80) NOT NULL,
  last_name       VARCHAR(80) NOT NULL,
  status          ENUM('active','archived','suspended') NOT NULL DEFAULT 'active',
  last_login_at   DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- ─── Student profile (1:1 with users where role='student') ─────────────────
CREATE TABLE IF NOT EXISTS students (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL UNIQUE,
  student_number  VARCHAR(32) NOT NULL UNIQUE,
  program         VARCHAR(80),
  year_level      TINYINT UNSIGNED,
  enrolled_at     DATE NOT NULL,
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Teacher profile (1:1 with users where role='teacher') ─────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL UNIQUE,
  employee_number VARCHAR(32) NOT NULL UNIQUE,
  department      VARCHAR(120),
  title           VARCHAR(40),
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Academic semesters ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semesters (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(40) NOT NULL UNIQUE,    -- e.g., "2025-2026-1"
  label           VARCHAR(120) NOT NULL,          -- e.g., "1st Semester 2025–2026"
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at     DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Sections (a class section taught by a teacher in a semester) ─────────
CREATE TABLE IF NOT EXISTS sections (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  semester_id     INT UNSIGNED NOT NULL,
  teacher_id      INT UNSIGNED NOT NULL,
  code            VARCHAR(40) NOT NULL,           -- e.g., "BSCS-3A"
  subject         VARCHAR(160) NOT NULL,          -- e.g., "Software Engineering"
  schedule        VARCHAR(120),                   -- "MWF 9:00–10:30"
  room            VARCHAR(60),
  status          ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sections_semester FOREIGN KEY (semester_id) REFERENCES semesters(id),
  CONSTRAINT fk_sections_teacher  FOREIGN KEY (teacher_id)  REFERENCES teachers(id),
  UNIQUE KEY uk_sections_sem_code (semester_id, code, subject),
  INDEX idx_sections_teacher (teacher_id),
  INDEX idx_sections_status (status)
) ENGINE=InnoDB;

-- ─── Enrollments (students in sections) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_id      INT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED NOT NULL,
  enrolled_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('enrolled','dropped','completed') NOT NULL DEFAULT 'enrolled',
  CONSTRAINT fk_enrollments_section FOREIGN KEY (section_id) REFERENCES sections(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE,
  UNIQUE KEY uk_enrollments (section_id, student_id),
  INDEX idx_enrollments_student (student_id)
) ENGINE=InnoDB;

-- ─── QR codes (one per student per semester) ───────────────────────────────
CREATE TABLE IF NOT EXISTS qr_codes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      INT UNSIGNED NOT NULL,
  semester_id     INT UNSIGNED NOT NULL,
  token           CHAR(64) NOT NULL UNIQUE,       -- random hex, encoded into the QR
  issued_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATETIME NOT NULL,
  revoked         BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_qr_student  FOREIGN KEY (student_id)  REFERENCES students(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qr_semester FOREIGN KEY (semester_id) REFERENCES semesters(id),
  UNIQUE KEY uk_qr_student_sem (student_id, semester_id),
  INDEX idx_qr_token (token)
) ENGINE=InnoDB;

-- ─── Class sessions (one per scheduled meeting) ────────────────────────────
CREATE TABLE IF NOT EXISTS class_sessions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_id      INT UNSIGNED NOT NULL,
  session_date    DATE NOT NULL,
  started_at      DATETIME NOT NULL,
  ended_at        DATETIME NULL,
  notes           TEXT,
  CONSTRAINT fk_session_section FOREIGN KEY (section_id) REFERENCES sections(id)
    ON DELETE CASCADE,
  UNIQUE KEY uk_session (section_id, session_date),
  INDEX idx_session_date (session_date)
) ENGINE=InnoDB;

-- ─── Attendance records ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id      INT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED NOT NULL,
  status          ENUM('present','late','absent','excused') NOT NULL,
  scanned_at      DATETIME NULL,
  scanned_by      INT UNSIGNED NULL,              -- teacher user_id
  source          ENUM('qr','manual','excuse') NOT NULL DEFAULT 'qr',
  CONSTRAINT fk_att_session FOREIGN KEY (session_id) REFERENCES class_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_att_scanned_by FOREIGN KEY (scanned_by) REFERENCES users(id),
  UNIQUE KEY uk_attendance (session_id, student_id),  -- prevents duplicate scans
  INDEX idx_att_student (student_id),
  INDEX idx_att_status (status)
) ENGINE=InnoDB;

-- ─── Grades (activities, quizzes, participation) ───────────────────────────
CREATE TABLE IF NOT EXISTS grade_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_id      INT UNSIGNED NOT NULL,
  title           VARCHAR(160) NOT NULL,
  category        ENUM('quiz','activity','participation','exam','recitation') NOT NULL,
  max_score       DECIMAL(6,2) NOT NULL,
  weight          DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  due_date        DATE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_grade_item_section FOREIGN KEY (section_id) REFERENCES sections(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS grades (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grade_item_id   INT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED NOT NULL,
  score           DECIMAL(6,2) NOT NULL,
  remarks         VARCHAR(255),
  recorded_by     INT UNSIGNED NOT NULL,
  recorded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_grade_item   FOREIGN KEY (grade_item_id) REFERENCES grade_items(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_grade_student FOREIGN KEY (student_id)   REFERENCES students(id),
  CONSTRAINT fk_grade_recorder FOREIGN KEY (recorded_by) REFERENCES users(id),
  UNIQUE KEY uk_grade (grade_item_id, student_id)
) ENGINE=InnoDB;

-- ─── Excuse letters ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS excuse_letters (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      INT UNSIGNED NOT NULL,
  section_id      INT UNSIGNED NOT NULL,
  absence_date    DATE NOT NULL,
  reason_type     ENUM('medical','family','official','other') NOT NULL,
  explanation     TEXT NOT NULL,
  attachment_path VARCHAR(255),
  status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by     INT UNSIGNED NULL,
  reviewed_at     DATETIME NULL,
  review_notes    TEXT,
  submitted_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_excuse_student FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_excuse_section FOREIGN KEY (section_id) REFERENCES sections(id),
  CONSTRAINT fk_excuse_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX idx_excuse_status (status),
  INDEX idx_excuse_student (student_id)
) ENGINE=InnoDB;

-- ─── Notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  type            ENUM('attendance','grade','excuse','system','report') NOT NULL,
  title           VARCHAR(160) NOT NULL,
  body            VARCHAR(500),
  link            VARCHAR(255),
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  INDEX idx_notif_user_read (user_id, is_read),
  INDEX idx_notif_created (created_at)
) ENGINE=InnoDB;

-- ─── Audit log (for security & compliance) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NULL,
  action          VARCHAR(80) NOT NULL,
  entity          VARCHAR(60),
  entity_id       VARCHAR(60),
  ip_address      VARCHAR(45),
  metadata        JSON,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- Recitation calls (random student picker history)
CREATE TABLE IF NOT EXISTS recitation_calls (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  section_id      INT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED NOT NULL,
  called_by       INT UNSIGNED NOT NULL,
  called_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes           VARCHAR(255),
  CONSTRAINT fk_rc_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  CONSTRAINT fk_rc_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_rc_caller  FOREIGN KEY (called_by)  REFERENCES users(id),
  INDEX idx_rc_section (section_id, called_at),
  INDEX idx_rc_student (student_id)
) ENGINE=InnoDB;
