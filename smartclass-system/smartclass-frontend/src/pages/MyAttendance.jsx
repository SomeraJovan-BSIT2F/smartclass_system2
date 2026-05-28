import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, CheckCircle2, Clock, XCircle, FileText, Filter, Download,
  TrendingUp, ChevronDown,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, StatCard, SectionHeader, Button, Spinner, ErrorBanner, Empty,
  Select,
} from '../components/UI';

const STATUS = {
  present: { label: 'Present', tone: 'ok',     icon: CheckCircle2, color: 'var(--ok)' },
  late:    { label: 'Late',    tone: 'warn',   icon: Clock,        color: 'var(--warn)' },
  absent:  { label: 'Absent',  tone: 'bad',    icon: XCircle,      color: 'var(--bad)' },
  excused: { label: 'Excused', tone: 'accent', icon: FileText,     color: 'var(--accent)' },
};

export default function MyAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [subject, setSubject] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        setData(await api.myAttendance());
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  // Build unique subject list from history
  const subjects = useMemo(() => {
    if (!data?.history) return [];
    const map = new Map();
    data.history.forEach(h => {
      if (!map.has(h.section_code)) {
        map.set(h.section_code, { code: h.section_code, subject: h.subject });
      }
    });
    return [...map.values()];
  }, [data]);

  // Apply filters
  const filtered = useMemo(() => {
    if (!data?.history) return [];
    return data.history.filter(h => {
      if (filter !== 'all' && h.status !== filter) return false;
      if (subject !== 'all' && h.section_code !== subject) return false;
      return true;
    });
  }, [data, filter, subject]);

  // Group by month for display
  const groupedByMonth = useMemo(() => {
    const groups = {};
    filtered.forEach(record => {
      const date = new Date(record.session_date);
      const key = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    });
    return Object.entries(groups);
  }, [filtered]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (error)   return <ErrorBanner>{error}</ErrorBanner>;

  const summary = data?.summary || { total: 0, present: 0, late: 0, absent: 0, excused: 0, percentage: 0 };

  return (
    <div className="space-y-6">
      <SectionHeader
                title="My attendance history"
        sub="List of class sessions."
        action={
          <Button
            variant="ghost"
            onClick={() => api.downloadPdf(api.myPerformancePdfUrl(), 'my-performance.pdf')}
          >
            <Download size={14} /> Download PDF
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Overall"
          value={`${summary.percentage}%`}
          icon={TrendingUp}
          tone={summary.percentage >= 85 ? 'ok' : 'bad'}
        />
        {['present', 'late', 'absent', 'excused'].map(status => {
          const meta = STATUS[status];
          return (
            <StatCard
              key={status}
              label={meta.label}
              value={summary[status] || 0}
              icon={meta.icon}
            />
          );
        })}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--muted)' }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Filter
            </span>
          </div>

          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto">
            <option value="all">All statuses</option>
            <option value="present">Present only</option>
            <option value="late">Late only</option>
            <option value="absent">Absent only</option>
            <option value="excused">Excused only</option>
          </Select>

          {subjects.length > 1 && (
            <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="!w-auto">
              <option value="all">All subjects</option>
              {subjects.map(s => (
                <option key={s.code} value={s.code}>{s.code} — {s.subject}</option>
              ))}
            </Select>
          )}

          <div className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
            Showing <strong>{filtered.length}</strong> of {data?.history?.length || 0} sessions
          </div>
        </div>
      </Card>

      {/* History list */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <div className="font-serif text-xl">
            {data?.history?.length === 0
              ? "No attendance records yet"
              : "No sessions match your filters"}
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            {data?.history?.length === 0
              ? "Once your teacher records attendance, your history will appear here."
              : "Try changing the filter or subject to see more results."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByMonth.map(([month, records]) => (
            <div key={month}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-serif text-lg">{month}</h3>
                <div className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {records.length} session{records.length !== 1 ? 's' : ''}
                </span>
              </div>

              <Card className="p-0 overflow-hidden">
                <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
                  {records.map((record, i) => {
                    const meta = STATUS[record.status] || STATUS.absent;
                    const date = new Date(record.session_date);
                    const Icon = meta.icon;

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50/50 transition"
                        style={{ borderColor: 'var(--rule)' }}
                      >
                        {/* Date */}
                        <div className="text-center min-w-[44px]">
                          <div className="font-serif text-2xl leading-none">
                            {date.getDate()}
                          </div>
                          <div
                            className="text-[10px] uppercase tracking-wider mt-0.5"
                            style={{ color: 'var(--muted)' }}
                          >
                            {date.toLocaleDateString(undefined, { weekday: 'short' })}
                          </div>
                        </div>

                        {/* Subject */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{record.subject}</div>
                          <div className="text-xs" style={{ color: 'var(--muted)' }}>
                            {record.section_code}
                            {record.scanned_at && (
                              <>
                                {' · '}
                                <span style={{ fontFamily: 'monospace' }}>
                                  scanned at {new Date(record.scanned_at).toLocaleTimeString(undefined, {
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2">
                          <Icon size={16} style={{ color: meta.color }} />
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
