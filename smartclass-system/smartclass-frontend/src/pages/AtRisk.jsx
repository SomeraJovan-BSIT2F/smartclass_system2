import { useEffect, useState } from 'react';
import {
  AlertTriangle, Mail, Phone, Clock, TrendingDown, ChevronDown,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, StatCard, SectionHeader, Button, Spinner, ErrorBanner, Empty,
  Select,
} from '../components/UI';

export default function AtRisk() {
  const [data, setData] = useState(null);
  const [sections, setSections] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'section_id'
  const [riskFilter, setRiskFilter] = useState('all'); // 'all', 'high', 'medium'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (sectionId) => {
    setLoading(true);
    try {
      const result = await api.atRiskStudents(sectionId === 'all' ? undefined : sectionId);
      setData(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const { sections } = await api.listSections();
        setSections(sections);
      } catch (e) { setError(e.message); }
    })();
    load('all');
  }, []);

  useEffect(() => { load(filter); }, [filter]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  // Flatten and re-filter by risk level
  const allStudents = (data?.sections || []).flatMap(s =>
    s.students.map(stu => ({ ...stu, section_code: s.section_code, subject: s.subject }))
  );
  const filtered = riskFilter === 'all'
    ? allStudents
    : allStudents.filter(s => s.risk === riskFilter);

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Students needing attention"
        sub="Students with low attendance or low grades."
        action={
          <div className="flex gap-2 flex-wrap">
            {sections.length > 0 && (
              <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto">
                <option value="all">All sections</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.code}</option>
                ))}
              </Select>
            )}
            <Select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="!w-auto">
              <option value="all">All risk levels</option>
              <option value="high">High risk only</option>
              <option value="medium">Medium risk only</option>
            </Select>
          </div>
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label="Total flagged"
          value={data?.summary?.total || 0}
          icon={AlertTriangle}
          tone={data?.summary?.total > 0 ? 'bad' : 'ok'}
        />
        <StatCard
          label="High risk"
          value={data?.summary?.high || 0}
          icon={TrendingDown}
          tone="bad"
        />
        <StatCard
          label="Medium risk"
          value={data?.summary?.medium || 0}
          icon={Clock}
          tone="warn"
        />
      </div>

      {/* Students list */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <div
            className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-4"
            style={{ background: '#E8F1EB' }}
          >
            <AlertTriangle size={28} style={{ color: 'var(--ok)' }} />
          </div>
          <div className="font-serif text-2xl">
            {data?.summary?.total === 0
              ? "No students at risk"
              : "No students match your filters"}
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            {data?.summary?.total === 0
              ? "Every student is meeting attendance and academic thresholds."
              : "Try changing the filters above."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s, i) => (
            <StudentCard key={`${s.section_id}-${s.student_id}`} student={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentCard({ student }) {
  const [expanded, setExpanded] = useState(false);
  const tone = student.risk === 'high' ? 'bad' : 'warn';
  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <Card className="overflow-hidden">
      <div
        className="p-5 flex items-center gap-4 cursor-pointer hover:bg-stone-50/50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-11 h-11 rounded-full grid place-items-center text-sm font-semibold shrink-0"
          style={{
            background: tone === 'bad' ? '#F4DBD5' : '#FBF0DC',
            color: tone === 'bad' ? 'var(--bad)' : '#8A5E12',
          }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{student.name}</span>
            <Pill tone={tone}>
              {student.risk === 'high' ? 'High risk' : 'Medium risk'}
            </Pill>
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            <span className="font-mono">{student.student_number}</span>
            {' · '}
            <span>{student.section_code} — {student.subject}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-sm shrink-0">
          {student.attendance_pct != null && (
            <div className="text-right">
              <div className="text-xs" style={{ color: 'var(--muted)' }}>Attendance</div>
              <div
                className="font-serif text-xl tabular-nums"
                style={{
                  color: Number(student.attendance_pct) < 75 ? 'var(--bad)' : 'var(--warn)',
                }}
              >
                {student.attendance_pct}%
              </div>
            </div>
          )}
          {student.average != null && (
            <div className="text-right">
              <div className="text-xs" style={{ color: 'var(--muted)' }}>Average</div>
              <div
                className="font-serif text-xl tabular-nums"
                style={{
                  color: Number(student.average) < 70 ? 'var(--bad)' : 'var(--warn)',
                }}
              >
                {student.average}
              </div>
            </div>
          )}
        </div>

        <ChevronDown
          size={18}
          className="shrink-0 transition-transform"
          style={{
            color: 'var(--muted)',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}
        />
      </div>

      {expanded && (
        <div
          className="px-5 pb-5 pt-3 border-t animate-fadeIn"
          style={{ borderColor: 'var(--rule)', background: '#FBFAF7' }}
        >
          {/* Mobile stats (hidden on desktop where they're inline) */}
          <div className="md:hidden grid grid-cols-3 gap-2 mb-4">
            <Stat label="Attendance" value={student.attendance_pct != null ? `${student.attendance_pct}%` : '—'} />
            <Stat label="Average" value={student.average ?? '—'} />
            <Stat label="Absences" value={student.absences ?? 0} />
          </div>

          {/* Reasons */}
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
            Why this student is flagged
          </div>
          <ul className="space-y-1.5">
            {student.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle
                  size={13}
                  className="mt-0.5 shrink-0"
                  style={{ color: tone === 'bad' ? 'var(--bad)' : 'var(--warn)' }}
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>

          {/* Contact info */}
          <div className="mt-4 pt-4 border-t flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
              <Mail size={12} />
              <a href={`mailto:${student.email}`} className="hover:underline">
                {student.email}
              </a>
            </div>
            {student.last_attended && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                <Clock size={12} />
                Last attended: {new Date(student.last_attended).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--rule)', background: '#fff' }}>
      <div className="font-serif text-lg">{value}</div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
    </div>
  );
}
