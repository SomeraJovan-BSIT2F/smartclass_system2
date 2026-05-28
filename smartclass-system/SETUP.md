# SmartClass QR — Complete Setup Guide

A full-stack classroom management web system with QR-based attendance, performance
analytics, excuse-letter workflow, and PDF reporting.

This package contains **two projects**:

```
smartclass-system/
├── smartclass-backend/    # Node.js + Express + MySQL API
└── smartclass-frontend/   # React + Vite web app
```

## Part 1 — Prerequisites (install once)

You need three things on your computer:

### 1.1 Node.js 18 or newer

- Download from https://nodejs.org (pick the LTS version)
- Install with all defaults
- Verify: open a terminal and run `node --version` — should print v18 or higher

### 1.2 MySQL 8

- **Windows:** download from https://dev.mysql.com/downloads/installer/, choose
  "Server only", set a root password (write it down)
- **Mac:** `brew install mysql && brew services start mysql`
- **Linux (Ubuntu):** `sudo apt install mysql-server && sudo systemctl start mysql`
- Verify: `mysql --version` prints v8.x

### 1.3 A code editor

- VS Code is recommended: https://code.visualstudio.com

## Part 2 — Backend setup

### 2.1 Extract and install

```bash
cd smartclass-backend
npm install
```

The first install takes 1–3 minutes and downloads ~200 dependencies.

### 2.2 Configure environment

```bash
cp .env.example .env
```

Open `.env` in your editor and edit two values:

```
DB_PASSWORD=<your MySQL root password>
JWT_SECRET=<paste 40+ random characters here>
```

Everything else can stay at defaults.

### 2.3 Create database and seed demo data

```bash
npm run migrate    # creates the database and tables
npm run seed       # inserts demo accounts and classes
```

Demo accounts (all use password `Password123!`):

| Role    | Email                    |
| ------- | ------------------------ |
| Admin   | admin@smartclass.edu     |
| Teacher | almonte@smartclass.edu   |
| Student | adelia@smartclass.edu    |

### 2.4 Start the API server

```bash
npm run dev
```

You should see:

```
✓ Database connected
SmartClass QR API
Listening: http://localhost:4000
```

**Leave this terminal open.** The backend is now running.

## Part 3 — Frontend setup

Open a **second terminal** (do not close the backend one).

### 3.1 Install and configure

```bash
cd smartclass-frontend
npm install
```

The `.env` file is already set to point to the local backend (`VITE_API_URL=http://localhost:4000/api/v1`).

### 3.2 Start the web app

```bash
npm run dev
```

You should see:

```
VITE ready
Local: http://localhost:5173
```

### 3.3 Open the app

Visit **http://localhost:5173** in your browser. Sign in with one of the demo
accounts above.

## Part 4 — Try the system

1. **As Teacher** (`almonte@smartclass.edu`):
   - You land on the teacher dashboard with live class roster
   - Click "Open scanner" or "QR Scanner" in the sidebar
   - Click "Start camera" — your browser will ask for camera permission
   - Scan a student's QR (see step 2 to get one)

2. **As Student** (`adelia@smartclass.edu`):
   - You see your own QR code on the dashboard — display it on your phone
     or save it as a PNG
   - When the teacher scans it, your attendance updates in real time
   - Submit an excuse letter from the Excuse Letter page
   - Download your performance PDF from Reports

3. **As Admin** (`admin@smartclass.edu`):
   - Manage all users (Users page)
   - View all sections (Sections page)
   - See institution-wide attendance trends (Analytics)
   - Generate PDFs for any section (Reports)

## Part 5 — Production deployment

### Backend
- Set `NODE_ENV=production`, real `JWT_SECRET`, production DB credentials
- Run with `npm start` behind PM2 / systemd
- Put it behind nginx with TLS termination
- Move `uploads/` to S3 or equivalent

### Frontend
- `npm run build` produces `dist/`
- Serve `dist/` with nginx, Caddy, Vercel, Netlify, etc.
- Set `VITE_API_URL` to your production API URL **before** building

## Troubleshooting

### "Cannot reach the server"
The frontend cannot reach the backend. Check:
- Is the backend terminal still running?
- Is it on port 4000? (`http://localhost:4000/health` should return JSON)
- Did you set `VITE_API_URL` correctly in the frontend `.env`?

### "ER_ACCESS_DENIED" on migrate
Your MySQL password in `.env` is wrong. Edit and try again.

### Camera doesn't open in scanner
- Browsers require HTTPS for camera access (localhost is OK for development)
- Click the camera icon in the address bar and allow permissions
- Some browsers block camera in incognito mode

### Login fails with "Invalid email or password"
- Did you run `npm run seed` in the backend?
- The exact passwords are case-sensitive: `Password123!`

### Port already in use
- Backend uses 4000, frontend uses 5173
- Change `PORT` in backend `.env`, or change `server.port` in `vite.config.js`

## Architecture summary

```
┌─────────────────────┐       HTTP/JSON       ┌──────────────────────┐
│  React (Vite)       │◄────────────────────►│  Express API         │
│  http://:5173       │   Bearer JWT auth    │  http://:4000/api/v1 │
└─────────────────────┘                       └──────────┬───────────┘
                                                         │
                                                  parameterized SQL
                                                         │
                                              ┌──────────▼───────────┐
                                              │  MySQL 8             │
                                              │  smartclass_qr DB    │
                                              │  14 tables, FKs      │
                                              └──────────────────────┘
```

- **Auth:** JWT in localStorage, sent as `Authorization: Bearer <token>`
- **QR codes:** generated by `qrcode` npm package on the server, encoded as
  `{ "t": "<token>", "sn": "<student_number>" }`
- **Scanner:** uses `html5-qrcode` library + browser `getUserMedia` API
- **Reports:** PDFKit streams PDFs directly to the browser
- **Real-time:** notifications poll every 30 seconds; attendance updates after each scan
