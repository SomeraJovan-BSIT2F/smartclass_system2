import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Mail, FileText, Calendar, Download, ChevronRight,
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner,
} from '../components/UI';
import { useAuth } from '../context/AppContext';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [qr, setQr] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [q, a, g] = await Promise.all([
          api.myQr().catch(() => null),
          api.myAttendance(),
          api.myGrades(),
        ]);
        setQr(q);
        setAttendance(a);
        setGrades(g.grades);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  const summary = attendance?.summary || { total: 0, present: 0, late: 0, absent: 0, excused: 0, percentage: 0 };
  const radial = [{ name: 'attendance', value: summary.percentage, fill: 'var(--accent)' }];

  // Group grades by subject
  const subjectMap = grades.reduce((acc, g) => {
    if (!acc[g.section_code]) acc[g.section_code] = { subject: g.subject, code: g.section_code, items: [] };
    acc[g.section_code].items.push(g);
    return acc;
  }, {});
  const subjects = Object.values(subjectMap).map(s => {
    const total = s.items.reduce((sum, i) => sum + (i.score / i.max_score) * 100 * Number(i.weight), 0);
    const weight = s.items.reduce((sum, i) => sum + Number(i.weight), 0);
    return { ...s, average: weight ? Math.round(total / weight) : null };
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Student · ${user?.name}`}
        title={`Hello, ${user?.name?.split(' ')[0] || 'there'}.`}
        sub="Your attendance, grades, and QR code."
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* QR */}
        <Card className="p-6 flex flex-col items-center text-center">
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
            Your semester QR
          </div>
          <div
            className="mt-3 p-4 rounded-2xl border-2 border-dashed"
            style={{ borderColor: 'var(--rule)' }}
          >
            {qr?.dataUrl ? (
              <img src={qr.dataUrl} alt="Your QR code" className="w-44 h-44" />
            ) : (
              <div
                className="w-44 h-44 grid place-items-center text-xs"
                style={{ color: 'var(--muted)' }}
              >
                No QR yet — ask admin to issue
              </div>
            )}
          </div>
          {qr?.studentNumber && (
            <div className="mt-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>
              {qr.studentNumber}
            </div>
          )}
          {qr?.expiresAt && (
            <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
              Valid through {new Date(qr.expiresAt).toLocaleDateString()}
            </div>
          )}
          {qr?.dataUrl && (
            <a
              href={qr.dataUrl}
              download="my-smartclass-qr.png"
              className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border w-full hover:bg-stone-50"
              style={{ borderColor: 'var(--rule)' }}
            >
              <Download size={14} /> Save QR
            </a>
          )}
        </Card>

        {/* Attendance */}
        <Card className="p-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--muted)' }}
              >
                Attendance
              </div>
              <div className="font-serif text-5xl mt-2 leading-none">
                {summary.percentage}
                <span className="text-2xl" style={{ color: 'var(--muted)' }}>%</span>
              </div>
              <Pill tone={summary.percentage >= 85 ? 'ok' : summary.percentage >= 75 ? 'warn' : 'bad'}>
                {summary.percentage >= 85 ? 'On track' : summary.percentage >= 75 ? 'Watch' : 'At risk'}
              </Pill>
            </div>
            <div className="grid place-items-center">
              <ResponsiveContainer width={140} height={140}>
                <RadialBarChart innerRadius="65%" outerRadius="100%" data={radial} startAngle={90} endAngle={-270}>
                  <RadialBar background={{ fill: 'var(--rule)' }} dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Present', value: summary.present, tone: 'ok' },
              { label: 'Late', value: summary.late, tone: 'warn' },
              { label: 'Absent', value: summary.absent, tone: 'bad' },
              { label: 'Excused', value: summary.excused, tone: 'muted' },
            ].map((x) => (
              <div
                key={x.label}
                className="p-3 rounded-xl border"
                style={{ borderColor: 'var(--rule)' }}
              >
                <div className="font-serif text-2xl">{x.value}</div>
                <div
                  className="text-[11px] uppercase tracking-wider mt-1"
                  style={{ color: 'var(--muted)' }}
                >
                  {x.label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--muted)' }}
              >
                Performance
              </div>
              <h2 className="font-serif text-2xl mt-1">Subjects this term</h2>
            </div>
            <Button
              variant="ghost"
              onClick={() => api.downloadPdf(api.myPerformancePdfUrl(), 'my-performance.pdf')}
            >
              <Download size={14} /> Download PDF
            </Button>
          </div>
          <div className="space-y-3">
            {subjects.length === 0 && (
              <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
                No grades posted yet.
              </div>
            )}
            {subjects.map((c) => (
              <div
                key={c.code}
                className="p-3 rounded-xl border flex items-center gap-4"
                style={{ borderColor: 'var(--rule)' }}
              >
                <BookOpen size={16} style={{ color: 'var(--accent)' }} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{c.subject}</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    {c.code} · {c.items.length} items
                  </div>
                  <div
                    className="h-1 mt-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--rule)' }}
                  >
                    <div
                      className="h-full"
                      style={{ width: `${c.average || 0}%`, background: 'var(--ink)' }}
                    />
                  </div>
                </div>
                <div className="font-serif text-xl tabular-nums">{c.average ?? '—'}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-serif text-xl mb-4">Quick actions</h3>
          <div className="space-y-2">
            <Link
              to="/excuses"
              className="w-full flex items-center gap-3 p-3 rounded-xl border text-left hover:bg-stone-50 transition"
              style={{ borderColor: 'var(--rule)' }}
            >
              <Mail size={16} style={{ color: 'var(--accent)' }} />
              <div className="flex-1">
                <div className="text-sm font-medium">Submit excuse letter</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  Attach a document
                </div>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
            </Link>
            <Link
              to="/reports"
              className="w-full flex items-center gap-3 p-3 rounded-xl border text-left hover:bg-stone-50 transition"
              style={{ borderColor: 'var(--rule)' }}
            >
              <FileText size={16} style={{ color: 'var(--accent)' }} />
              <div className="flex-1">
                <div className="text-sm font-medium">My reports</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  Download PDF
                </div>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
