import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, CheckCircle2, TrendingUp, Award, AlertTriangle, Filter, Download,
  Shuffle, Layers,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import {
  Card, Pill, StatCard, SectionHeader, Button, Spinner, ErrorBanner, Empty,
} from '../components/UI';
import { useAuth } from '../context/AppContext';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { sections } = await api.listSections();
        setSections(sections);
        if (sections[0]) setActiveSection(sections[0]);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!activeSection) return;
    (async () => {
      try {
        const [a, r] = await Promise.all([
          api.sectionStats(activeSection.id),
          api.classRoster(activeSection.id),
        ]);
        setAnalytics(a);
        setRoster(r.roster);
      } catch (e) { setError(e.message); }
    })();
  }, [activeSection]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  if (sections.length === 0) {
    return (
      <Empty
        title="No sections assigned yet"
        sub="No sections assigned. Contact the admin."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${activeSection?.code} · ${activeSection?.subject}`}
        title={`Welcome back, ${user?.name?.split(' ').slice(-1)[0]}.`}
        sub={`Class schedule: ${activeSection?.schedule || 'Unscheduled'}`}
        action={
          sections.length > 1 && (
            <select
              value={activeSection?.id || ''}
              onChange={(e) => setActiveSection(sections.find(s => s.id == e.target.value))}
              className="px-3 py-2 rounded-full border bg-white text-sm"
              style={{ borderColor: 'var(--rule)' }}
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.code} — {s.subject}</option>
              ))}
            </select>
          )
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6 relative overflow-hidden text-white" style={{ background: 'var(--ink)' }}>
          <div
            className="absolute -right-12 -top-12 w-64 h-64 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }}
            aria-hidden
          />
          <div className="relative">
            <Pill tone="accent">Live class</Pill>
            <h2 className="font-serif text-3xl lg:text-4xl mt-3 leading-tight">
              Start attendance scan
            </h2>
            <p className="text-sm mt-2 opacity-80 max-w-md">
              Open the scanner and scan each student's QR code to mark them present.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/scanner?section=${activeSection?.id}`}>
                <Button variant="accent">
                  <Camera size={14} /> Open scanner
                </Button>
              </Link>
              <Link to="/recitation">
                <Button variant="ghost" className="!border-white/30 !text-white hover:!bg-white/10">
                  <Shuffle size={14} /> Random recitation
                </Button>
              </Link>
              <Link to="/groups">
                <Button variant="ghost" className="!border-white/30 !text-white hover:!bg-white/10">
                  <Layers size={14} /> Group generator
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Students"
            value={analytics?.summary?.total_students || 0}
            icon={CheckCircle2}
          />
          <StatCard
            label="Attendance"
            value={`${analytics?.summary?.attendance_pct || 0}%`}
            icon={TrendingUp}
          />
          <StatCard
            label="Class avg"
            value={analytics?.summary?.class_average ?? '—'}
            icon={Award}
          />
          <StatCard
            label="At-risk"
            value={roster.filter(r => r.risk === 'high').length}
            icon={AlertTriangle}
            tone="bad"
          />
        </div>
      </div>

      {analytics?.performanceTrend && analytics.performanceTrend.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
                Class performance
              </div>
              <h2 className="font-serif text-2xl mt-1">Weekly trend</h2>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.performanceTrend}>
              <defs>
                <linearGradient id="grad-perf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--rule)" vertical={false} />
              <XAxis dataKey="week" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid var(--rule)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="avg"
                stroke="var(--accent)"
                strokeWidth={2.5}
                fill="url(#grad-perf)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
              Roster · {activeSection?.code}
            </div>
            <h2 className="font-serif text-2xl mt-1">Students</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="subtle"
              onClick={() =>
                api.downloadPdf(
                  api.attendancePdfUrl(activeSection.id),
                  `attendance-${activeSection.code}.pdf`
                )
              }
            >
              <Download size={14} /> Export PDF
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-[11px] uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                <th className="py-2 font-medium">Student</th>
                <th className="py-2 font-medium">ID</th>
                <th className="py-2 font-medium">Attendance</th>
                <th className="py-2 font-medium">Average</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => {
                const tone = s.risk === 'low' ? 'ok' : s.risk === 'medium' ? 'warn' : s.risk === 'high' ? 'bad' : 'muted';
                const label = s.risk === 'low' ? 'On track' : s.risk === 'medium' ? 'Watch' : s.risk === 'high' ? 'At risk' : '—';
                const initials = s.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                return (
                  <tr key={s.id} className="border-t hover:bg-stone-50/50" style={{ borderColor: 'var(--rule)' }}>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold"
                          style={{ background: 'var(--cream)' }}
                        >
                          {initials}
                        </div>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {s.student_number}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-20 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--rule)' }}
                        >
                          <div
                            className="h-full"
                            style={{
                              width: `${s.attendance_pct || 0}%`,
                              background:
                                s.attendance_pct > 85
                                  ? 'var(--ok)'
                                  : s.attendance_pct > 75
                                  ? 'var(--warn)'
                                  : 'var(--bad)',
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">
                          {s.attendance_pct ?? '—'}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 tabular-nums">{s.average ?? '—'}</td>
                    <td className="py-3"><Pill tone={tone}>{label}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
