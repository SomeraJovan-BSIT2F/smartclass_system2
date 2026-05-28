# SmartClass QR — Backend API

Node.js + Express + MySQL backend for the SmartClass QR classroom management platform.
Provides authentication, QR issuance, attendance tracking, grade management, excuse-letter
workflow, notifications, analytics, and PDF report generation.

## Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **Database:** MySQL 8 (via `mysql2/promise` connection pool)
- **Auth:** JWT (HS256) + bcrypt password hashing
- **Validation:** express-validator
- **Security:** helmet, CORS allow-list, express-rate-limit
- **Files:** multer (uploads, 10 MB cap, allow-list of types)
- **PDFs:** PDFKit (server-side generation, streamed responses)
- **QR images:** `qrcode` npm package (data-URL output for the student portal)

## Project structure

```
smartclass-backend/
├── server.js                 # Express entrypoint
├── package.json
├── .env.example              # Copy to .env and fill in
├── config/
│   └── db.js                 # MySQL connection pool
├── db/
│   ├── schema.sql            # Full schema (12 tables, FKs, indexes)
│   ├── migrate.js            # Applies schema.sql
│   └── seed.js               # Demo data: 1 admin, 1 teacher, 8 students
├── middleware/
│   ├── auth.js               # authenticate() + authorize(...roles)
│   ├── error.js              # HttpError, asyncHandler, errorHandler
│   ├── validate.js           # express-validator wrapper
│   └── upload.js             # multer config (excuse-letter attachments)
├── routes/                   # Thin routers — validation + auth + delegate
│   ├── auth.js
│   ├── users.js
│   ├── sections.js
│   ├── qr.js
│   ├── attendance.js
│   ├── grades.js
│   ├── excuse.js
│   ├── notifications.js
│   ├── analytics.js
│   └── reports.js
├── controllers/              # Business logic, parameterized SQL
│   ├── authController.js
│   ├── userController.js
│   ├── sectionController.js
│   ├── qrController.js
│   ├── attendanceController.js
│   ├── gradeController.js
│   ├── excuseController.js
│   ├── notificationController.js
│   ├── analyticsController.js
│   └── reportController.js
├── utils/
│   └── pdf.js                # PDFKit report templates
├── uploads/                  # Excuse-letter attachments live here
└── api-client.js             # Frontend fetch wrapper (drop into React)
```

## Setup

### 1. Install dependencies

```bash
cd smartclass-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DB credentials and a strong JWT_SECRET (32+ chars)
```

### 3. Create the database & schema

The `migrate` script reads `db/schema.sql` and applies it. It creates the database
if it doesn't exist, so the user in `.env` needs `CREATE` privilege the first time.

```bash
npm run migrate
```

### 4. Seed demo data

```bash
npm run seed
```

This wipes existing data and inserts:

- 1 active semester (2025–2026, 1st)
- 1 admin (`admin@smartclass.edu`)
- 1 teacher (`almonte@smartclass.edu`)
- 8 students (`adelia@smartclass.edu`, `bennett@smartclass.edu`, etc.)
- 1 section (`BSCS-3A — Software Engineering`)
- ~10 past class sessions with realistic attendance patterns
- 4 graded items with scores per student
- 1 pending excuse letter, sample notifications

**All seeded accounts use the password:** `Password123!`

### 5. Start the server

```bash
npm run dev    # with nodemon, auto-restart
# or
npm start
```

Server boots on `http://localhost:4000`. Visit `/api` for endpoint discovery
and `/health` for a liveness probe.

## API reference

All endpoints are under `/api/v1`. Auth endpoints (except `/auth/login`) require
`Authorization: Bearer <token>`.

### Auth

| Method | Path                      | Role     | Description                     |
| ------ | ------------------------- | -------- | ------------------------------- |
| POST   | `/auth/login`             | public   | Returns `{ token, user }`       |
| GET    | `/auth/me`                | any      | Current user profile            |
| POST   | `/auth/change-password`   | any      | Change own password             |

### Users (admin)

| Method | Path                  | Description                          |
| ------ | --------------------- | ------------------------------------ |
| GET    | `/users`              | List with `?role=&status=&q=` filters |
| POST   | `/users`              | Create teacher/student/admin         |
| PATCH  | `/users/:id/status`   | active / archived / suspended        |

### Sections

| Method | Path                              | Role             | Description                       |
| ------ | --------------------------------- | ---------------- | --------------------------------- |
| GET    | `/sections`                       | any              | Teachers see only their own       |
| GET    | `/sections/:id`                   | any              | Includes student roster           |
| POST   | `/sections`                       | admin            | Create new section                |
| POST   | `/sections/:id/enrollments`       | admin            | Enroll student in section         |
| PATCH  | `/sections/:id/archive`           | admin            | Archive (soft-delete)             |

### QR codes

| Method | Path                | Role            | Description                                |
| ------ | ------------------- | --------------- | ------------------------------------------ |
| GET    | `/qr/me`            | student         | Returns PNG data URL of own semester QR    |
| POST   | `/qr/issue`         | admin           | Issue or rotate one student's QR           |
| POST   | `/qr/issue-batch`   | admin           | Generate QRs for an entire section         |
| POST   | `/qr/resolve`       | teacher / admin | Resolve token → student (preview)          |

### Attendance

| Method | Path                                | Role            | Description                              |
| ------ | ----------------------------------- | --------------- | ---------------------------------------- |
| POST   | `/attendance/sessions`              | teacher / admin | Open today's session                     |
| PATCH  | `/attendance/sessions/:id/close`    | teacher / admin | Close & auto-mark absentees              |
| POST   | `/attendance/scan`                  | teacher / admin | Record scan (qrToken or studentId)       |
| GET    | `/attendance/sessions/:id`          | teacher / admin | Session roster                           |
| GET    | `/attendance/me`                    | student         | History + summary (% present, etc.)      |

### Grades

| Method | Path                                       | Role            | Description                          |
| ------ | ------------------------------------------ | --------------- | ------------------------------------ |
| GET    | `/grades/items?sectionId=`                 | teacher / admin | List grade items                     |
| POST   | `/grades/items`                            | teacher / admin | Create assessment                    |
| POST   | `/grades`                                  | teacher / admin | Record/update student score          |
| GET    | `/grades/me`                               | student         | Own grades across all sections       |
| GET    | `/grades/sections/:sectionId/roster`       | teacher / admin | Roster with averages + risk flag     |

### Excuse letters

| Method | Path                                    | Role               | Description                               |
| ------ | --------------------------------------- | ------------------ | ----------------------------------------- |
| GET    | `/excuse-letters`                       | any (filtered)     | Students see own, teachers see section    |
| POST   | `/excuse-letters`                       | student            | `multipart/form-data` with attachment     |
| PATCH  | `/excuse-letters/:id/review`            | teacher / admin    | Approve / reject                          |
| GET    | `/excuse-letters/:id/attachment`        | owner / staff      | Download attachment                       |

### Notifications

| Method | Path                              | Role  | Description           |
| ------ | --------------------------------- | ----- | --------------------- |
| GET    | `/notifications`                  | any   | Latest 100 + unread # |
| PATCH  | `/notifications/:id/read`         | any   | Mark one read         |
| PATCH  | `/notifications/read-all`         | any   | Mark all read         |

### Analytics

| Method | Path                                  | Role            | Description                       |
| ------ | ------------------------------------- | --------------- | --------------------------------- |
| GET    | `/analytics/institution`              | admin           | Institution-wide overview         |
| GET    | `/analytics/sections/:sectionId`      | teacher / admin | Per-section trend & summary       |

### Reports (PDF)

| Method | Path                                                    | Role            |
| ------ | ------------------------------------------------------- | --------------- |
| GET    | `/reports/attendance/sections/:sectionId.pdf`           | teacher / admin |
| GET    | `/reports/performance/me.pdf`                           | student         |

PDFs stream directly with `Content-Disposition: attachment`.

## Example: end-to-end attendance flow

```bash
# 1. Teacher logs in
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"almonte@smartclass.edu","password":"Password123!"}' \
  | jq -r .token)

# 2. Open today's session for section 1
SESSION=$(curl -s -X POST http://localhost:4000/api/v1/attendance/sessions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sectionId":1}' | jq -r .session.id)

# 3. Student presents QR. Teacher's scanner reads the token from the QR image
#    (which encodes JSON: { "t": "<token>", "sn": "2025-0142" }) and posts it:
curl -X POST http://localhost:4000/api/v1/attendance/scan \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"sessionId\":$SESSION,\"qrToken\":\"<token-from-qr>\"}"

# Duplicate scan? -> 200 with { "duplicate": true }
# Expired QR?     -> 410
# Not enrolled?   -> 400
```

## Wiring the React frontend

Copy `api-client.js` into `src/api.js` of your React app. Then in any
component:

```js
import { api, auth } from './api';

// login
await api.login('almonte@smartclass.edu', 'Password123!');

// pull data
const { sections } = await api.listSections();
const { history, summary } = await api.myAttendance();

// download a PDF
await api.downloadPdf(api.myPerformancePdfUrl(), 'my-performance.pdf');
```

Add a `.env` to your React app with:

```
VITE_API_URL=http://localhost:4000/api/v1
```

The client persists the JWT in `localStorage` and dispatches an
`auth:expired` event on 401 — listen for it to redirect to the login screen.

## Security notes

- **JWTs** sign with `JWT_SECRET` (32+ random chars). Tokens expire per
  `JWT_EXPIRES_IN`; the frontend handles re-auth on 401.
- **Passwords** are bcrypt-hashed with `BCRYPT_ROUNDS` (default 12).
- **Rate limits** apply globally (200 req/min) and to `/auth/*` (30 / 15 min).
- **Role guards** are enforced in middleware *and* in SQL where ownership
  matters (e.g., teachers can only see their own sections).
- **Duplicate scans** are prevented by a `UNIQUE (session_id, student_id)`
  constraint on `attendance` plus `INSERT IGNORE` in the controller.
- **File uploads** restrict to PDF/JPG/PNG, 10 MB max, randomized filenames
  (no path traversal possible from client input).
- **SQL** uses parameterized queries throughout — no string concatenation.
- **CORS** is allow-listed via the `CORS_ORIGIN` env var (comma-separated).

## Production checklist

- [ ] Set `NODE_ENV=production`, real `JWT_SECRET`, real DB credentials
- [ ] Run behind a reverse proxy (nginx / Caddy) with TLS termination
- [ ] Use a managed MySQL (RDS, Cloud SQL) with automated backups
- [ ] Move `uploads/` to S3 or equivalent object storage; update `excuseController`
- [ ] Add log shipping (Pino → Loki / CloudWatch / Datadog)
- [ ] Add monitoring on `/health` and DB connection pool stats
- [ ] Enforce HTTPS-only cookies if you switch from header tokens
- [ ] Run `npm audit` regularly; pin versions in CI
