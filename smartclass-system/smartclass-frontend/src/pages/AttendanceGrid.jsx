import { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, Empty, Select,
} from '../components/UI';

const STATUS_STYLES = {
  present: { bg: '#3B7A57', fg: '#fff', label: 'P' },
  late:    { bg: '#C28A2C', fg: '#fff', label: 'L' },
  absent:  { bg: '#A33A2A', fg: '#fff', label: 'A' },
  excused: { bg: '#B6452C', fg: '#fff', label: 'E' },
};

const RANGES = [
  { v: 'week',  label: 'Week',  days: 7 },
  { v: 'month', label: 'Month', days: 30 },
  { v: 'term',  label: 'Term',  days: 120 },
];

export default function AttendanceGrid() {
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [data, setData] = useState({ sessions: [], students: [], grid: {} });
  const [range, setRange] = useState('month');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const reload = async () => {
    if (!activeSection) return;
    setRefreshing(true);
    try {
      const days = RANGES.find(r => r.v === range)?.days || 30;
      const to = endDate;
      const from = new Date(new Date(endDate) - (days - 1) * 86400000)
        .toISOString().slice(0, 10);
      const d = await api.attendanceGrid(activeSection.id, from, to);
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  };

  useEffect(() => { reload(); }, [activeSection, range, endDate]);

  const shiftDate = (delta) => {
    const days = RANGES.find(r => r.v === range)?.days || 30;
    const newEnd = new Date(new Date(endDate).getTime() + delta * days * 86400000);
    setEndDate(newEnd.toISOString().slice(0, 10));
  };

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (sections.length === 0) {
    return <Empty title="No sections" sub="No sections assigned. Contact the admin." />;
  }

  // Per-student stats
  const studentStats = (studentId) => {
    const statuses = data.sessions.map(sess => data.grid[`${studentId}-${sess.id}`]).filter(Boolean);
    const present = statuses.filter(s => s === 'present').length;
    const late = statuses.filter(s => s === 'late').length;
    const absent = statuses.filter(s => s === 'absent').length;
    const excused = statuses.filter(s => s === 'excused').length;
    const total = statuses.length;
    const pct = total ? Math.round(((present + late) / total) * 100) : null;
    return { present, late, absent, excused, total, pct };
  };

  // Per-day stats
  const sessionStats = (sessionId) => {
    const statuses = data.students.map(st => data.grid[`${st.id}-${sessionId}`]).filter(Boolean);
    const total = data.students.length;
    const presentCount = statuses.filter(s => s === 'present' || s === 'late').length;
    return { presentCount, total, pct: total ? Math.round((presentCount / total) * 100) : 0 };
  };

  const exportCsv = () => {
    const headers = ['Student #', 'Name', ...data.sessions.map(s => s.session_date), 'Attendance %'];
    const rows = [headers.join(',')];
    for (const st of data.students) {
      const cells = [st.student_number, `"${st.name}"`];
      for (const sess of data.sessions) {
        cells.push(data.grid[`${st.id}-${sess.id}`] || '');
      }
      const stats = studentStats(st.id);
      cells.push(stats.pct ?? '');
      rows.push(cells.join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${activeSection.code}-${data.from}-to-${data.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
                title={activeSection ? `${activeSection.code} — ${activeSection.subject}` : 'Attendance'}
        sub="Attendance per session."
        action={
          <div className="flex gap-2 flex-wrap">
            {sections.length > 1 && (
              <Select
                value={activeSection?.id || ''}
                onChange={(e) => setActiveSection(sections.find(s => s.id == e.target.value))}
                className="!w-auto"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.code}</option>
                ))}
              </Select>
            )}
            <Button variant="subtle" onClick={exportCsv} disabled={data.sessions.length === 0}>
              <Download size={14} /> Export CSV
            </Button>
          </div>
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.v}
              onClick={() => setRange(r.v)}
              className="px-4 py-1.5 rounded-full text-sm border transition"
              style={{
                borderColor: range === r.v ? 'var(--ink)' : 'var(--rule)',
                background: range === r.v ? 'var(--ink)' : '#fff',
                color: range === r.v ? 'var(--paper)' : 'var(--ink)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => shiftDate(-1)} aria-label="Previous">
            <ChevronLeft size={14} />
          </Button>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            {data.from} → {data.to}
          </div>
          <Button variant="ghost" onClick={() => shiftDate(1)} aria-label="Next">
            <ChevronRight size={14} />
          </Button>
          <Button variant="ghost" onClick={() => setEndDate(new Date().toISOString().slice(0, 10))}>
            Today
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
        Legend:
        {Object.entries(STATUS_STYLES).map(([key, s]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="w-4 h-4 rounded grid place-items-center text-[10px] font-bold"
              style={{ background: s.bg, color: s.fg }}
            >
              {s.label}
            </span>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </span>
        ))}
      </div>

      {refreshing ? (
        <div className="grid place-items-center h-48"><Spinner /></div>
      ) : data.sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar size={32} className="mx-auto opacity-30" />
          <div className="font-serif text-xl mt-3">No sessions in this range</div>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Try a different date range, or open a session in the QR Scanner.
          </p>
        </Card>
      ) : data.students.length === 0 ? (
        <Empty title="No students enrolled" />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'var(--cream)' }}>
                  <th
                    className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider sticky left-0 z-10"
                    style={{ color: 'var(--muted)', background: 'var(--cream)', minWidth: 200 }}
                  >
                    Student
                  </th>
                  {data.sessions.map(sess => {
                    const stats = sessionStats(sess.id);
                    const d = new Date(sess.session_date);
                    return (
                      <th key={sess.id} className="px-2 py-3 text-center" style={{ minWidth: 56 }}>
                        <div className="text-[10px] uppercase" style={{ color: 'var(--muted)' }}>
                          {d.toLocaleDateString(undefined, { weekday: 'short' })}
                        </div>
                        <div className="font-serif text-base">
                          {d.getDate()}
                        </div>
                        <div className="text-[9px]" style={{ color: 'var(--muted)' }}>
                          {stats.pct}%
                        </div>
                      </th>
                    );
                  })}
                  <th
                    className="px-3 py-3 text-center font-medium text-[11px] uppercase tracking-wider"
                    style={{ background: 'var(--ink)', color: 'var(--paper)', minWidth: 80 }}
                  >
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.students.map(st => {
                  const stats = studentStats(st.id);
                  return (
                    <tr key={st.id} className="border-t" style={{ borderColor: 'var(--rule)' }}>
                      <td
                        className="px-4 py-2 sticky left-0 bg-white"
                        style={{ minWidth: 200 }}
                      >
                        <div className="font-medium text-sm">{st.name}</div>
                        <div className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                          {st.student_number}
                        </div>
                      </td>
                      {data.sessions.map(sess => {
                        const status = data.grid[`${st.id}-${sess.id}`];
                        const style = STATUS_STYLES[status];
                        return (
                          <td key={sess.id} className="px-1 py-1.5 text-center">
                            {style ? (
                              <span
                                title={`${st.name} · ${sess.session_date} · ${status}`}
                                className="inline-grid place-items-center w-7 h-7 rounded text-[11px] font-bold"
                                style={{ background: style.bg, color: style.fg }}
                              >
                                {style.label}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--rule)' }}>·</span>
                            )}
                          </td>
                        );
                      })}
                      <td
                        className="px-3 py-2 text-center font-serif tabular-nums"
                        style={{
                          background: stats.pct == null ? 'transparent'
                                      : stats.pct >= 85 ? '#E8F1EB'
                                      : stats.pct >= 75 ? '#FBF0DC'
                                      : '#F4DBD5',
                          color: stats.pct == null ? 'var(--muted)'
                                 : stats.pct >= 85 ? 'var(--ok)'
                                 : stats.pct >= 75 ? '#8A5E12'
                                 : 'var(--bad)',
                        }}
                      >
                        {stats.pct == null ? '—' : `${stats.pct}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
