import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  TrendingUp, Award, AlertTriangle, Users, Zap, Trophy, MessageCircle,
  ArrowRight, FileText, CheckCircle2, Mail,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, StatCard, SectionHeader, Button, Spinner, ErrorBanner, Empty,
  Select,
} from '../components/UI';
import { useAuth } from '../context/AppContext';

export default function Analytics() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [sectionData, setSectionData] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [atRisk, setAtRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (user?.role === 'admin') {
          setInstitution(await api.institutionStats());
        }
        const { sections } = await api.listSections();
        setSections(sections);
        if (sections[0]) setActiveSection(sections[0]);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [user]);

  useEffect(() => {
    if (!activeSection) return;
    (async () => {
      try {
        const [sec, eng, risk] = await Promise.all([
          api.sectionStats(activeSection.id),
          api.engagementMetrics(activeSection.id),
          api.atRiskStudents(activeSection.id),
        ]);
        setSectionData(sec);
        setEngagement(eng);
        setAtRisk(risk);
      } catch (e) { setError(e.message); }
    })();
  }, [activeSection]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (error) return <ErrorBanner>{error}</ErrorBanner>;

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Insights & trends"
        sub="Attendance and grade trends."
        action={
          sections.length > 1 && (
            <Select
              value={activeSection?.id || ''}
              onChange={(e) => setActiveSection(sections.find(s => s.id == e.target.value))}
              className="!w-auto"
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </Select>
          )
        }
      />

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Class attendance"
          value={`${sectionData?.summary?.attendance_pct || 0}%`}
          icon={CheckCircle2}
          tone={sectionData?.summary?.attendance_pct >= 85 ? 'ok' : 'bad'}
        />
        <StatCard
          label="Class average"
          value={sectionData?.summary?.class_average ?? '—'}
          icon={Award}
        />
        <StatCard
          label="At-risk students"
          value={atRisk?.summary?.total || 0}
          icon={AlertTriangle}
          tone={atRisk?.summary?.total > 0 ? 'bad' : 'ok'}
        />
        <StatCard
          label="Sessions held"
          value={engagement?.sessions?.total_sessions || 0}
          icon={Zap}
        />
      </div>

      {/* Attendance trend chart */}
      {sectionData?.trend && sectionData.trend.length > 0 ? (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
                Attendance trend
              </div>
              <h3 className="font-serif text-2xl mt-1">Daily breakdown</h3>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Pill tone="ok">Present</Pill>
              <Pill tone="warn">Late</Pill>
              <Pill tone="accent">Excused</Pill>
              <Pill tone="bad">Absent</Pill>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={sectionData.trend.map(t => ({
                day: new Date(t.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                present: Number(t.present),
                late: Number(t.late),
                absent: Number(t.absent),
                excused: Number(t.excused || 0),
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
              <Bar dataKey="excused" stackId="a" fill="var(--accent)" />
              <Bar dataKey="absent" stackId="a" fill="var(--bad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <TrendingUp size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <div className="font-serif text-xl">No attendance data yet</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Once you record attendance through the QR scanner, daily trends will appear here.
          </p>
        </Card>
      )}

      {/* Performance trend */}
      {sectionData?.performanceTrend && sectionData.performanceTrend.length > 0 && (
        <Card className="p-6">
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
            Performance trend
          </div>
          <h3 className="font-serif text-2xl mt-1 mb-4">Class average over time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={sectionData.performanceTrend}>
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

      {/* Bottom row: engagement breakdown + quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Engagement card */}
        <Card className="p-6 lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
            Engagement
          </div>
          <h3 className="font-serif text-2xl mt-1 mb-4">Class activity</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat
              icon={MessageCircle}
              label="Recitation calls"
              value={engagement?.recitation?.total_calls || 0}
              sub={`${engagement?.recitation?.unique_students || 0} unique students`}
            />
            <Stat
              icon={Mail}
              label="Excuse letters"
              value={
                (engagement?.excuses?.pending || 0) +
                (engagement?.excuses?.approved || 0) +
                (engagement?.excuses?.rejected || 0)
              }
              sub={`${engagement?.excuses?.pending || 0} pending`}
            />
            <Stat
              icon={Users}
              label="Avg per session"
              value={engagement?.sessions?.avg_present_per_session || 0}
              sub="present + late"
            />
          </div>

          {/* Top attenders */}
          {engagement?.topAttenders && engagement.topAttenders.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={14} style={{ color: 'var(--accent)' }} />
                <h4 className="font-serif text-lg">Top attenders</h4>
              </div>
              <div className="space-y-1.5">
                {engagement.topAttenders.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2 rounded-lg border"
                    style={{ borderColor: 'var(--rule)' }}
                  >
                    <div
                      className="w-7 h-7 rounded-full grid place-items-center text-xs font-semibold"
                      style={{
                        background: i === 0 ? 'var(--accent)' : 'var(--cream)',
                        color: i === 0 ? '#fff' : 'var(--ink)',
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{s.name}</div>
                      <div className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                        {s.student_number}
                      </div>
                    </div>
                    <Pill tone="ok">{s.attended_count} attended</Pill>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Quick links */}
        <Card className="p-6">
          <h3 className="font-serif text-xl mb-4">Drill down</h3>
          <div className="space-y-2">
            <Link
              to="/at-risk"
              className="flex items-center gap-3 p-3 rounded-xl border hover:bg-stone-50 transition"
              style={{ borderColor: 'var(--rule)' }}
            >
              <AlertTriangle size={16} style={{ color: 'var(--bad)' }} />
              <div className="flex-1">
                <div className="text-sm font-medium">At-risk students</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  {atRisk?.summary?.total || 0} flagged
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--muted)' }} />
            </Link>
            <Link
              to="/ranking"
              className="flex items-center gap-3 p-3 rounded-xl border hover:bg-stone-50 transition"
              style={{ borderColor: 'var(--rule)' }}
            >
              <Trophy size={16} style={{ color: 'var(--accent)' }} />
              <div className="flex-1">
                <div className="text-sm font-medium">Class ranking</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  See top performers
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--muted)' }} />
            </Link>
            <Link
              to="/reports"
              className="flex items-center gap-3 p-3 rounded-xl border hover:bg-stone-50 transition"
              style={{ borderColor: 'var(--rule)' }}
            >
              <FileText size={16} style={{ color: 'var(--accent)' }} />
              <div className="flex-1">
                <div className="text-sm font-medium">Generate report</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  Download as PDF
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--muted)' }} />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--rule)' }}>
      <Icon size={14} style={{ color: 'var(--accent)' }} />
      <div className="font-serif text-2xl mt-2 leading-none">{value}</div>
      <div className="text-[11px] uppercase tracking-wider mt-1" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      {sub && (
        <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{sub}</div>
      )}
    </div>
  );
}
