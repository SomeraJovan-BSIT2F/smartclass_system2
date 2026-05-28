# SmartClass QR — Frontend

Production-ready React app for the SmartClass QR classroom management system.
Connects to the backend API for real authentication, attendance scanning, grades,
and reports.

## Stack

- React 18 + Vite
- React Router for navigation
- Tailwind CSS for styling
- Recharts for data visualizations
- html5-qrcode for camera-based QR scanning
- lucide-react for icons

## Setup

```bash
npm install
```

Create a `.env` file (already provided):

```
VITE_API_URL=http://localhost:4000/api/v1
```

Start the dev server:

```bash
npm run dev
```

Visit http://localhost:5173.

**Important:** the backend must be running on port 4000 for login and all features
to work. See the backend README for setup.

## Demo accounts

After running `npm run seed` in the backend, log in with:

| Role    | Email                          | Password       |
| ------- | ------------------------------ | -------------- |
| Admin   | admin@smartclass.edu           | Password123!   |
| Teacher | almonte@smartclass.edu         | Password123!   |
| Student | adelia@smartclass.edu          | Password123!   |

## Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve it behind nginx, Caddy, or any static host.
Set `VITE_API_URL` to your production API URL at build time.

## Camera permissions

The QR scanner uses `getUserMedia`, which requires:
- **HTTPS** in production (or `localhost` in development)
- User permission when prompted
- A working camera

If the scanner fails, check browser DevTools console — most issues are permission
denials or non-secure context warnings.

## Pages

- `/login` — sign in
- `/dashboard` — role-specific dashboard (admin, teacher, or student)
- `/scanner` — live QR scanner (teacher/admin)
- `/sections` — section management (teacher/admin)
- `/users` — user management (admin only)
- `/excuses` — submit (student) or review (teacher) excuse letters
- `/reports` — download PDF reports
- `/analytics` — charts and trends (teacher/admin)
- `/settings` — change password
