import { Link } from 'react-router-dom';
import {
  QrCode, Camera, BarChart3, Mail, ShieldCheck, Users,
  ArrowRight, CheckCircle2, BookOpen, GraduationCap,
  FileText,
} from 'lucide-react';

export default function Landing() {
  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{ background: 'rgba(250,247,242,0.85)', borderColor: 'var(--rule)' }}
      >
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-md grid place-items-center"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <QrCode size={16} />
            </div>
            <div className="font-serif text-[17px] tracking-tight">
              SmartClass <span style={{ color: 'var(--accent)' }}>QR</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="#features" className="hover:opacity-70 transition">Features</a>
            <a href="#how" className="hover:opacity-70 transition">How it works</a>
            <a href="#roles" className="hover:opacity-70 transition">Roles</a>
            <a href="#about" className="hover:opacity-70 transition">About</a>
          </nav>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition hover:translate-y-[-1px]"
            style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
              borderColor: 'var(--ink)',
            }}
          >
            Sign in <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b" style={{ borderColor: 'var(--rule)' }}>
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1200px] px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="font-serif text-5xl lg:text-7xl leading-[1.02] tracking-tight">
              QR-based attendance for the classroom.
            </h1>
            <p
              className="mt-6 text-base lg:text-lg max-w-xl leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              SmartClass QR is a web system for managing class attendance, grades, and
              excuse letters. Each student gets a personal QR code that the teacher
              scans at the start of class.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium border transition hover:translate-y-[-1px]"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  borderColor: 'var(--accent)',
                }}
              >
                Sign in <ArrowRight size={14} />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium border transition hover:bg-white"
                style={{ borderColor: 'var(--rule)' }}
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right: stylized hero card */}
          <div className="relative">
            <div
              className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl"
              style={{
                background:
                  'radial-gradient(circle, var(--accent), transparent 70%)',
              }}
              aria-hidden
            />
            <div
              className="relative rounded-2xl border overflow-hidden shadow-sm"
              style={{ borderColor: 'var(--rule)', background: '#fff' }}
            >
              <div
                className="px-5 py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--rule)', background: 'var(--cream)' }}
              >
                <div
                  className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: 'var(--muted)' }}
                >
                  Live class · BSCS-3A
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: 'var(--ok)' }}
                  />
                  <span className="text-[10px] uppercase tracking-wider">
                    REC
                  </span>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-5">
                {/* QR illustration */}
                <div
                  className="aspect-square rounded-xl border-2 border-dashed grid place-items-center"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  <div className="grid grid-cols-7 gap-0.5 w-32 h-32">
                    {Array.from({ length: 49 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-[1px]"
                        style={{
                          background:
                            (i * 7 + i) % 3 === 0 || i === 24
                              ? 'var(--ink)'
                              : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-col justify-between">
                  <div>
                    <div
                      className="text-[10px] uppercase tracking-[0.18em]"
                      style={{ color: 'var(--muted)' }}
                    >
                      Today's attendance
                    </div>
                    <div className="font-serif text-5xl mt-1">94%</div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: 'var(--ok)' }}
                    >
                      +4 from last session
                    </div>
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {[
                      { name: 'Adelia Reyes', t: '08:58' },
                      { name: 'Bennett Cruz', t: '09:01' },
                      { name: 'Carmela Tan', t: '09:02' },
                    ].map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center gap-2 text-xs"
                      >
                        <CheckCircle2
                          size={12}
                          style={{ color: 'var(--ok)' }}
                        />
                        <span className="flex-1 truncate">{s.name}</span>
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: 'var(--muted)' }}
                        >
                          {s.t}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <h2 className="font-serif text-4xl lg:text-5xl leading-[1.05]">
              What it does.
            </h2>
            <p
              className="mt-4 text-base"
              style={{ color: 'var(--muted)' }}
            >
              The features below cover the main workflows for teachers, students, and admins.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Camera,
                title: 'QR attendance',
                desc: 'Teacher opens the camera and scans student QR codes. Each scan is timestamped and recorded.',
              },
              {
                icon: BarChart3,
                title: 'Analytics',
                desc: 'Charts for attendance trends, class average, and a list of students who are falling behind.',
              },
              {
                icon: Mail,
                title: 'Excuse letters',
                desc: 'Students upload supporting documents. The teacher approves or rejects, then attendance updates.',
              },
              {
                icon: FileText,
                title: 'PDF reports',
                desc: 'Per-section attendance reports and per-student performance reports, downloadable from the dashboard.',
              },
              {
                icon: BookOpen,
                title: 'Gradebook and quizzes',
                desc: 'Teachers create quizzes, file-upload tasks, or score items manually. Students see results once posted.',
              },
              {
                icon: Users,
                title: 'Three user roles',
                desc: 'Admin, teacher, and student each see a different dashboard with the tools they actually need.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border bg-white hover:shadow-sm transition"
                style={{ borderColor: 'var(--rule)' }}
              >
                <div
                  className="w-10 h-10 rounded-full grid place-items-center"
                  style={{
                    background: 'var(--cream)',
                    color: 'var(--accent)',
                  }}
                >
                  <f.icon size={18} />
                </div>
                <h3 className="font-serif text-xl mt-4">{f.title}</h3>
                <p
                  className="text-sm mt-2 leading-relaxed"
                  style={{ color: 'var(--muted)' }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <h2 className="font-serif text-4xl lg:text-5xl leading-[1.05]">
              How it works.
            </h2>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              {
                n: '01',
                title: 'Set up the semester',
                desc: 'Admin creates the semester, adds sections, and issues QR codes to enrolled students.',
              },
              {
                n: '02',
                title: 'Scan in class',
                desc: 'Teacher opens the scanner and points the camera at each student\'s QR. Attendance is recorded.',
              },
              {
                n: '03',
                title: 'View results',
                desc: 'Students see their attendance and grades. Teachers and admins can export PDF reports.',
              },
            ].map((step) => (
              <div key={step.n} className="relative">
                <div
                  className="font-serif text-7xl leading-none"
                  style={{ color: 'var(--cream)' }}
                >
                  {step.n}
                </div>
                <h3 className="font-serif text-2xl mt-2">{step.title}</h3>
                <p
                  className="text-sm mt-3 leading-relaxed max-w-xs"
                  style={{ color: 'var(--muted)' }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <h2 className="font-serif text-4xl lg:text-5xl leading-[1.05]">
              Three roles.
            </h2>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-4">
            {[
              {
                icon: ShieldCheck,
                role: 'Admin',
                desc: 'Manages users, sections, semesters, and QR codes for the whole school.',
                bullets: [
                  'Create and archive semesters',
                  'Add users and assign roles',
                  'Issue QR codes per section',
                  'Generate school-wide reports',
                ],
              },
              {
                icon: BookOpen,
                role: 'Teacher',
                desc: 'Handles their own sections — attendance, grades, and excuse letter approvals.',
                bullets: [
                  'Scan QR codes for attendance',
                  'Create quizzes and file tasks',
                  'Approve or reject excuse letters',
                  'Export PDFs per section',
                ],
              },
              {
                icon: GraduationCap,
                role: 'Student',
                desc: 'Sees their personal QR, attendance history, tasks, and grades.',
                bullets: [
                  'Personal semester QR code',
                  'Attendance and grade history',
                  'Submit excuse letters with files',
                  'Take quizzes assigned by teachers',
                ],
              },
            ].map((r) => (
              <div
                key={r.role}
                className="p-6 rounded-2xl border bg-white"
                style={{ borderColor: 'var(--rule)' }}
              >
                <div
                  className="w-10 h-10 rounded-full grid place-items-center"
                  style={{
                    background: 'var(--ink)',
                    color: 'var(--paper)',
                  }}
                >
                  <r.icon size={18} />
                </div>
                <h3 className="font-serif text-2xl mt-4">{r.role}</h3>
                <p
                  className="text-sm mt-2 leading-relaxed"
                  style={{ color: 'var(--muted)' }}
                >
                  {r.desc}
                </p>
                <ul className="mt-5 space-y-2">
                  {r.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <CheckCircle2
                        size={14}
                        className="mt-0.5 shrink-0"
                        style={{ color: 'var(--accent)' }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-serif text-4xl lg:text-5xl leading-[1.05]">
              About the project.
            </h2>
            <p
              className="mt-5 text-base leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              SmartClass QR is a capstone project. The frontend is built with React and
              Vite, the backend uses Node.js with Express, and the data is stored in
              MySQL. The goal was to replace the paper attendance sheets we still use
              in some classes.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 max-w-md">
              {[
                'React + Vite',
                'Node.js + Express',
                'MySQL 8',
                'Tailwind CSS',
                'JWT auth',
                'PDFKit',
              ].map((t) => (
                <div
                  key={t}
                  className="px-3 py-2 rounded-lg border text-xs flex items-center gap-2"
                  style={{ borderColor: 'var(--rule)', background: '#fff' }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div
            className="relative rounded-2xl border p-8 overflow-hidden"
            style={{
              background: 'var(--ink)',
              borderColor: 'var(--ink)',
              color: 'var(--paper)',
            }}
          >
            <div
              className="absolute -top-12 -right-12 w-72 h-72 rounded-full opacity-30"
              style={{
                background:
                  'radial-gradient(circle, var(--accent), transparent 70%)',
              }}
              aria-hidden
            />
            <div className="relative">
              <p className="font-serif text-2xl mt-2 leading-relaxed">
                The original idea: a teacher walks into a classroom of forty students,
                marks attendance, and gets back to teaching — without the paper sheet.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full grid place-items-center text-xs font-semibold"
                  style={{ background: 'var(--accent)' }}
                >
                  PT
                </div>
                <div>
                  <div className="text-sm">Project team</div>
                  <div
                    className="text-xs uppercase tracking-wider"
                    style={{ color: 'rgba(250,247,242,0.6)' }}
                  >
                    Capstone · 2025–2026
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: 'var(--cream)' }}>
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-20 text-center">
          <h2 className="font-serif text-4xl lg:text-6xl leading-[1.05]">
            Sign in to get started.
          </h2>
          <p
            className="mt-4 text-base max-w-xl mx-auto"
            style={{ color: 'var(--muted)' }}
          >
            Use the account credentials given to you by the admin.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 mt-8 rounded-full text-sm font-medium border transition hover:translate-y-[-1px]"
            style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
              borderColor: 'var(--ink)',
            }}
          >
            Go to sign in <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
      >
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-md grid place-items-center"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <QrCode size={14} />
            </div>
            <span className="font-serif">
              SmartClass <span style={{ color: 'var(--accent)' }}>QR</span>
            </span>
          </div>

          <div
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--muted)' }}
          >
            © 2025–2026
          </div>
        </div>
      </footer>
    </div>
  );
}
