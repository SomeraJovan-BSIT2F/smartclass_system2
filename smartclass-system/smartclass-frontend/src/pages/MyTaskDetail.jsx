import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Upload, FileText, CheckCircle2, Clock,
  AlertTriangle, Trash2, Download,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, Button, Spinner, ErrorBanner, SuccessBanner, Textarea,
} from '../components/UI';

const STATUS = {
  pending: { label: 'Pending', tone: 'warn', icon: Clock,         color: 'var(--warn)' },
  overdue: { label: 'Overdue', tone: 'bad',  icon: AlertTriangle, color: 'var(--bad)'  },
  graded:  { label: 'Graded',  tone: 'ok',   icon: CheckCircle2,  color: 'var(--ok)'   },
};

function fileSizeFmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MyTaskDetail() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const load = async () => {
    try {
      const { task } = await api.taskDetail(itemId);
      setTask(task);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [itemId]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (!task)   return <ErrorBanner>{error || 'Task not found.'}</ErrorBanner>;

  const meta = STATUS[task.status];
  const StatusIcon = meta.icon;
  const due = task.due_date ? new Date(task.due_date) : null;
  const isGraded = task.status === 'graded';

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        to="/my-tasks"
        className="inline-flex items-center gap-1.5 text-sm hover:underline"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={14} /> Back to my tasks
      </Link>

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner onClose={() => setInfo(null)}>{info}</SuccessBanner>}

      {/* Header card */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-full grid place-items-center shrink-0"
            style={{
              background: meta.tone === 'bad' ? '#F4DBD5'
                        : meta.tone === 'warn' ? '#FBF0DC'
                        : '#E8F1EB',
            }}
          >
            <StatusIcon size={20} style={{ color: meta.color }} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
              {task.section_code} — {task.subject}
            </div>
            <h1 className="font-serif text-3xl mt-1">{task.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Pill tone="muted">{task.category}</Pill>
              <Pill tone={meta.tone}>{meta.label}</Pill>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                Max: {task.max_score} · weight {task.weight}
              </span>
            </div>
            {due && (
              <div className="mt-3 flex items-center gap-1.5 text-sm" style={{ color: 'var(--muted)' }}>
                <Calendar size={14} />
                Due {due.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {task.instructions && (
          <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--rule)' }}>
            <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
              Instructions
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.instructions}</p>
          </div>
        )}
      </Card>

      {/* Score section if graded */}
      {isGraded && (
        <Card className="p-6">
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
            Your score
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className="font-serif text-6xl tabular-nums"
              style={{
                color: (task.score / task.max_score) >= 0.85 ? 'var(--ok)'
                     : (task.score / task.max_score) >= 0.7  ? 'var(--warn)'
                     : 'var(--bad)',
              }}
            >
              {Number(task.score)}
            </span>
            <span className="text-2xl" style={{ color: 'var(--muted)' }}>
              / {task.max_score}
            </span>
            <span className="ml-3 text-sm" style={{ color: 'var(--muted)' }}>
              ({Math.round((task.score / task.max_score) * 100)}%)
            </span>
          </div>
          {task.remarks && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--cream)' }}>
              <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
                Teacher's remarks
              </div>
              <p className="text-sm">{task.remarks}</p>
            </div>
          )}
        </Card>
      )}

      {/* Submission section */}
      {task.submission_type === 'file' && (
        <SubmissionPanel
          task={task}
          isGraded={isGraded}
          onChange={() => { load(); }}
          setError={setError}
          setInfo={setInfo}
        />
      )}

      {task.submission_type === 'quiz' && (
        <QuizPanel taskId={task.id} isGraded={isGraded} />
      )}

      {task.submission_type === 'none' && !isGraded && (
        <Card className="p-6 text-center" style={{ background: 'var(--cream)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            This task doesn't require an online submission. Your teacher will record your score directly.
          </p>
        </Card>
      )}
    </div>
  );
}

function SubmissionPanel({ task, isGraded, onChange, setError, setInfo }) {
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const hasSubmission = !!task.submission_id;

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file first.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (comment) fd.append('comment', comment);
      await api.submitTask(task.id, fd);
      setInfo(hasSubmission ? 'Submission replaced successfully.' : 'Submission uploaded successfully.');
      setFile(null);
      setComment('');
      onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Upload size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="font-serif text-xl">Your submission</h2>
      </div>

      {hasSubmission ? (
        <div
          className="p-4 rounded-xl border flex items-center gap-3"
          style={{ borderColor: 'var(--rule)', background: '#fff' }}
        >
          <FileText size={20} style={{ color: 'var(--accent)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{task.file_name}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {fileSizeFmt(task.file_size || 0)} · submitted {new Date(task.submitted_at).toLocaleString()}
              {task.submission_updated_at && task.submission_updated_at !== task.submitted_at && (
                <> · updated {new Date(task.submission_updated_at).toLocaleString()}</>
              )}
            </div>
          </div>
          <a
            href={api.submissionDownloadUrl(task.submission_id)}
            onClick={async (e) => {
              e.preventDefault();
              await api.downloadPdf(
                api.submissionDownloadUrl(task.submission_id),
                task.file_name || 'submission'
              );
            }}
          >
            <Button variant="ghost">
              <Download size={14} /> Download
            </Button>
          </a>
        </div>
      ) : (
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          You haven't uploaded a file yet.
        </p>
      )}

      {/* If already graded, lock the form */}
      {isGraded ? (
        <div
          className="mt-4 p-3 rounded-xl text-sm flex items-start gap-2"
          style={{ background: 'var(--cream)', color: 'var(--muted)' }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--ok)' }} className="mt-0.5 shrink-0" />
          <span>This task has been graded. Submissions are now locked.</span>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <span
              className="text-[11px] uppercase tracking-[0.14em] block mb-1.5"
              style={{ color: 'var(--muted)' }}
            >
              {hasSubmission ? 'Replace your file' : 'Upload your file'}
            </span>
            <label
              className="block p-4 rounded-xl border-2 border-dashed text-center cursor-pointer hover:bg-stone-50 transition"
              style={{
                borderColor: file ? 'var(--accent)' : 'var(--rule)',
                background: file ? '#FBEFE9' : '#fff',
              }}
            >
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,.zip"
                className="sr-only"
              />
              {file ? (
                <div>
                  <FileText size={24} className="mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {fileSizeFmt(file.size)} · click to choose a different file
                  </div>
                </div>
              ) : (
                <div>
                  <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
                  <div className="text-sm font-medium">Choose a file</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    PDF, Word, Excel, PowerPoint, images, text, ZIP · max 25 MB
                  </div>
                </div>
              )}
            </label>
          </div>

          <div>
            <span
              className="text-[11px] uppercase tracking-[0.14em] block mb-1.5"
              style={{ color: 'var(--muted)' }}
            >
              Comment for your teacher (optional)
            </span>
            <Textarea
              rows={3}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything you want your teacher to know about this submission…"
            />
          </div>

          <div className="flex justify-end gap-2">
            {file && (
              <Button type="button" variant="ghost" onClick={() => { setFile(null); setComment(''); }}>
                <Trash2 size={14} /> Clear
              </Button>
            )}
            <Button type="submit" variant="accent" loading={busy} disabled={!file}>
              <Upload size={14} /> {hasSubmission ? 'Replace submission' : 'Submit'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function QuizPanel({ taskId, isGraded }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="font-serif text-xl">Online quiz</h2>
      </div>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {isGraded
          ? "You've completed this quiz. Tap below to see your answers and score."
          : "Tap below to take the quiz. Answer all questions, then submit once. You cannot retake it."}
      </p>
      <div className="mt-4 flex gap-2">
        {isGraded ? (
          <Link to={`/my-tasks/${taskId}/results`}>
            <Button variant="primary">View results</Button>
          </Link>
        ) : (
          <>
            <Link to={`/my-tasks/${taskId}/take`}>
              <Button variant="accent">Start quiz</Button>
            </Link>
            <Link to={`/my-tasks/${taskId}/results`}>
              <Button variant="ghost">Or view results (if already submitted)</Button>
            </Link>
          </>
        )}
      </div>
    </Card>
  );
}
