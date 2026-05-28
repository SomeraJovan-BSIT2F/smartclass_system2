import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, Clock, CheckCircle2, AlertTriangle, Filter, BookOpen,
  Calendar, Upload, ChevronRight,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, StatCard, SectionHeader, Spinner, ErrorBanner,
  Select,
} from '../components/UI';

const STATUS = {
  pending: { label: 'Pending', tone: 'warn', icon: Clock,         color: 'var(--warn)' },
  overdue: { label: 'Overdue', tone: 'bad',  icon: AlertTriangle, color: 'var(--bad)'  },
  graded:  { label: 'Graded',  tone: 'ok',   icon: CheckCircle2,  color: 'var(--ok)'   },
};

const CATEGORY_LABELS = {
  quiz: 'Quiz', exam: 'Exam', activity: 'Activity',
  participation: 'Participation', recitation: 'Recitation',
};

export default function MyTasks() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try { setData(await api.myTasks()); }
      catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const subjects = useMemo(() => {
    if (!data?.tasks) return [];
    const map = new Map();
    data.tasks.forEach(t => {
      if (!map.has(t.section_code)) {
        map.set(t.section_code, { code: t.section_code, subject: t.subject });
      }
    });
    return [...map.values()];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data?.tasks) return [];
    return data.tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (subjectFilter !== 'all' && t.section_code !== subjectFilter) return false;
      return true;
    });
  }, [data, statusFilter, subjectFilter]);

  const groupedBySection = useMemo(() => {
    const groups = {};
    filtered.forEach(t => {
      const key = `${t.section_code} — ${t.subject}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups);
  }, [filtered]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (error)   return <ErrorBanner>{error}</ErrorBanner>;

  const summary = data?.summary || { total: 0, pending: 0, overdue: 0, graded: 0 };

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Quizzes, activities & exams"
        sub="Tap a task to open it."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total"   value={summary.total}   icon={ClipboardList} />
        <StatCard label="Pending" value={summary.pending} icon={Clock} tone="warn" />
        <StatCard label="Overdue" value={summary.overdue} icon={AlertTriangle} tone="bad" />
        <StatCard label="Graded"  value={summary.graded}  icon={CheckCircle2} />
      </div>

      <Card className="p-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--muted)' }} aria-hidden="true" />
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Filter
            </span>
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-auto">
            <option value="all">All statuses</option>
            <option value="pending">Pending only</option>
            <option value="overdue">Overdue only</option>
            <option value="graded">Graded only</option>
          </Select>
          {subjects.length > 1 && (
            <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="!w-auto">
              <option value="all">All subjects</option>
              {subjects.map(s => (
                <option key={s.code} value={s.code}>{s.code} — {s.subject}</option>
              ))}
            </Select>
          )}
          <div className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
            Showing <strong>{filtered.length}</strong> of {data?.tasks?.length || 0} tasks
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <div className="font-serif text-xl">
            {data?.tasks?.length === 0 ? "No tasks yet" : "No tasks match your filters"}
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            {data?.tasks?.length === 0
              ? "Once your teacher posts a quiz, activity, or exam, it'll appear here."
              : "Try changing the filter or subject."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedBySection.map(([sectionLabel, tasks]) => (
            <div key={sectionLabel}>
              <div className="flex items-center gap-3 mb-3">
                <BookOpen size={16} style={{ color: 'var(--accent)' }} />
                <h3 className="font-serif text-lg">{sectionLabel}</h3>
                <div className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                </span>
              </div>

              <Card className="p-0 overflow-hidden">
                <ul className="divide-y list-none m-0 p-0" style={{ borderColor: 'var(--rule)' }}>
                  {tasks.map(t => {
                    const meta = STATUS[t.status];
                    const StatusIcon = meta.icon;
                    const dueDate = t.due_date ? new Date(t.due_date) : null;
                    return (
                      <li key={t.id}>
                        <Link
                          to={`/my-tasks/${t.id}`}
                          className="px-5 py-4 hover:bg-stone-50/50 transition flex items-center gap-4 no-underline"
                          style={{ color: 'inherit' }}
                        >
                          <div
                            className="w-10 h-10 rounded-full grid place-items-center shrink-0"
                            style={{
                              background: meta.tone === 'bad' ? '#F4DBD5'
                                        : meta.tone === 'warn' ? '#FBF0DC'
                                        : '#E8F1EB',
                            }}
                          >
                            <StatusIcon size={18} style={{ color: meta.color }} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{t.title}</span>
                              <Pill tone="muted">{CATEGORY_LABELS[t.category] || t.category}</Pill>
                              {t.submission_type === 'file' && (
                                <Pill tone="accent">
                                  <Upload size={10} /> {t.submitted ? 'Submitted' : 'Upload required'}
                                </Pill>
                              )}
                            </div>
                            <div className="text-xs mt-1 flex items-center gap-3 flex-wrap" style={{ color: 'var(--muted)' }}>
                              <span>Max: {t.max_score} pts</span>
                              <span>Weight: {t.weight}</span>
                              {dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar size={11} />
                                  Due {dueDate.toLocaleDateString()}
                                </span>
                              )}
                              <span>Posted {new Date(t.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-3">
                            {t.status === 'graded' ? (
                              <>
                                <div className="text-right">
                                  <div
                                    className="font-serif text-2xl tabular-nums leading-none"
                                    style={{
                                      color: (t.score / t.max_score) >= 0.85 ? 'var(--ok)'
                                           : (t.score / t.max_score) >= 0.7  ? 'var(--warn)'
                                           : 'var(--bad)',
                                    }}
                                  >
                                    {Number(t.score)}
                                    <span className="text-sm" style={{ color: 'var(--muted)' }}>
                                      /{t.max_score}
                                    </span>
                                  </div>
                                  <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--muted)' }}>
                                    {Math.round((t.score / t.max_score) * 100)}%
                                  </div>
                                </div>
                              </>
                            ) : (
                              <Pill tone={meta.tone}>{meta.label}</Pill>
                            )}
                            <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
