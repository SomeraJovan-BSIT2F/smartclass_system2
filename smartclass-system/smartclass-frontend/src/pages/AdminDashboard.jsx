import { useEffect, useState } from 'react';
import {
  GraduationCap, Users, CheckCircle2, AlertTriangle, Plus, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Card, Pill, StatCard, SectionHeader, Button, Spinner, ErrorBanner } from '../components/UI';
import { useAuth } from '../context/AppContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, sec] = await Promise.all([
          api.institutionStats(),
          api.listSections(),
        ]);
        setStats(s);
        setSections(sec.sections);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <SectionHeader
                title={`Good day, ${user?.name?.split(' ')[0] || 'Admin'}.`}
        sub="Overview of the whole system."
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total students"
          value={stats?.users?.students || 0}
          icon={GraduationCap}
        />
        <StatCard
          label="Active teachers"
          value={stats?.users?.teachers || 0}
          icon={Users}
        />
        <StatCard
          label="7-day attendance"
          value={`${stats?.attendancePct || 0}%`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Active sections"
          value={sections.filter(s => s.status === 'active').length}
          icon={AlertTriangle}
        />
      </div>

      {stats?.trend && stats.trend.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
                Attendance pulse
              </div>
              <h2 className="font-serif text-2xl mt-1">Last 14 days</h2>
            </div>
            <div className="flex gap-2">
              <Pill tone="ok">Present</Pill>
              <Pill tone="warn">Late</Pill>
              <Pill tone="bad">Absent</Pill>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={stats.trend.map(t => ({
                day: new Date(t.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                present: Number(t.present),
                late: Number(t.late),
                absent: Number(t.absent),
              }))}
              barCategoryGap={18}
            >
              <CartesianGrid stroke="var(--rule)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid var(--rule)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="present" stackId="a" fill="var(--ok)" />
              <Bar dataKey="late" stackId="a" fill="var(--warn)" />
              <Bar dataKey="absent" stackId="a" fill="var(--bad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
              Sections this term
            </div>
            <h2 className="font-serif text-2xl mt-1">Active classes</h2>
          </div>
          <Link to="/sections">
            <Button variant="ghost"><Plus size={14} /> Manage sections</Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-[11px] uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                <th className="py-2 font-medium">Section</th>
                <th className="py-2 font-medium">Subject</th>
                <th className="py-2 font-medium">Teacher</th>
                <th className="py-2 font-medium">Students</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: 'var(--rule)' }}>
                  <td className="py-3 font-mono text-xs">{s.code}</td>
                  <td className="py-3">{s.subject}</td>
                  <td className="py-3" style={{ color: 'var(--muted)' }}>{s.teacher_name}</td>
                  <td className="py-3">{s.student_count}</td>
                  <td className="py-3">
                    <Pill tone={s.status === 'active' ? 'ok' : 'muted'}>{s.status}</Pill>
                  </td>
                </tr>
              ))}
              {sections.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center" style={{ color: 'var(--muted)' }}>No sections yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
