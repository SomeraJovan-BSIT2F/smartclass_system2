import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, FileText, CheckCircle2, Clock, Filter,
  MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
  Select, Input,
} from '../components/UI';

function fileSizeFmt(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Submissions() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const load = async () => {
    try {
      const r = await api.listSubmissions(itemId);
      setData(r);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [itemId]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (!data)   return <ErrorBanner>{error || 'Could not load submissions.'}</ErrorBanner>;

  const all = data.submissions || [];
  const filtered = filter === 'submitted'
    ? all.filter(s => s.submission_id)
    : filter === 'missing'
    ? all.filter(s => !s.submission_id)
    : filter === 'graded'
    ? all.filter(s => s.score != null)
    : filter === 'ungraded'
    ? all.filter(s => s.submission_id && s.score == null)
    : all;

  const stats = {
    total:     all.length,
    submitted: all.filter(s => s.submission_id).length,
    missing:   all.filter(s => !s.submission_id).length,
    graded:    all.filter(s => s.score != null).length,
    ungraded:  all.filter(s => s.submission_id && s.score == null).length,
  };

  const saveScore = async (studentId, value) => {
    if (value === '' || isNaN(Number(value))) return;
    try {
      await api.recordGrade({
        gradeItemId: Number(itemId),
        studentId,
        score: Number(value),
      });
      setInfo('Score saved.');
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/gradebook"
        className="inline-flex items-center gap-1.5 text-sm hover:underline"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={14} /> Back to gradebook
      </Link>

      <SectionHeader
        eyebrow={`${data.item.section_code} — ${data.item.subject}`}
        title={`Submissions: ${data.item.title}`}
        sub={`${stats.submitted} of ${stats.total} students submitted · max score ${data.item.max_score}`}
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner onClose={() => setInfo(null)}>{info}</SuccessBanner>}

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Submitted" value={stats.submitted} of={stats.total} tone="ok" />
        <StatPill label="Missing"   value={stats.missing}   of={stats.total} tone="bad" />
        <StatPill label="Ungraded"  value={stats.ungraded}  of={stats.submitted || 1} tone="warn" />
        <StatPill label="Graded"    value={stats.graded}    of={stats.total} tone="muted" />
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--muted)' }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Show
            </span>
          </div>
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto">
            <option value="all">All students ({stats.total})</option>
            <option value="submitted">Submitted ({stats.submitted})</option>
            <option value="missing">Missing ({stats.missing})</option>
            <option value="ungraded">Submitted but not graded ({stats.ungraded})</option>
            <option value="graded">Already graded ({stats.graded})</option>
          </Select>
        </div>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
          No students match this filter.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y list-none m-0 p-0" style={{ borderColor: 'var(--rule)' }}>
            {filtered.map(s => (
              <SubmissionRow
                key={s.student_id}
                row={s}
                maxScore={data.item.max_score}
                onSave={(score) => saveScore(s.student_id, score)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StatPill({ label, value, of, tone }) {
  return (
    <div className="p-4 rounded-xl border bg-white" style={{ borderColor: 'var(--rule)' }}>
      <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="font-serif text-3xl mt-1 leading-none">
        {value}
        <span className="text-base" style={{ color: 'var(--muted)' }}> / {of}</span>
      </div>
    </div>
  );
}

function SubmissionRow({ row, maxScore, onSave }) {
  const initials = row.student_name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const submitted = !!row.submission_id;
  const graded = row.score != null;
  const [score, setScore] = useState(graded ? String(row.score) : '');

  return (
    <li className="px-5 py-4 hover:bg-stone-50/50 transition" style={{ borderColor: 'var(--rule)' }}>
      <div className="flex items-start gap-4 flex-wrap">
        <div
          className="w-10 h-10 rounded-full grid place-items-center text-xs font-semibold shrink-0"
          style={{ background: 'var(--cream)' }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="font-medium">{row.student_name}</div>
          <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            {row.student_number}
          </div>

          {submitted ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--rule)' }}
              >
                <FileText size={14} style={{ color: 'var(--accent)' }} />
                <span className="truncate max-w-[200px]">{row.file_name}</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  ({fileSizeFmt(row.file_size)})
                </span>
              </div>
              <button
                onClick={async () => {
                  try {
                    await api.downloadPdf(
                      api.submissionDownloadUrl(row.submission_id),
                      row.file_name || 'submission'
                    );
                  } catch (e) { /* handled */ }
                }}
                className="text-xs underline flex items-center gap-1"
                style={{ color: 'var(--accent)' }}
              >
                <Download size={11} /> Download
              </button>
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                · {new Date(row.submitted_at).toLocaleString()}
              </span>
            </div>
          ) : (
            <Pill tone="bad">No submission</Pill>
          )}

          {row.comment && (
            <div
              className="mt-3 p-3 rounded-xl text-sm flex items-start gap-2"
              style={{ background: 'var(--cream)' }}
            >
              <MessageSquare size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
              <span className="whitespace-pre-wrap">{row.comment}</span>
            </div>
          )}
        </div>

        {/* Scoring */}
        <div className="flex items-center gap-2 shrink-0">
          <Input
            type="number"
            min={0}
            max={maxScore}
            step="0.01"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="—"
            className="!w-24 text-center tabular-nums"
            aria-label={`Score for ${row.student_name}`}
          />
          <span className="text-sm" style={{ color: 'var(--muted)' }}>/ {maxScore}</span>
          <Button
            variant="primary"
            onClick={() => onSave(score)}
            disabled={score === '' || score === String(row.score)}
          >
            {graded ? 'Update' : 'Score'}
          </Button>
        </div>
      </div>
    </li>
  );
}
