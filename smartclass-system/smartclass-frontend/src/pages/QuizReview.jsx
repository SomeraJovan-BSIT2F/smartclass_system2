import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Eye, CheckCircle2, XCircle, Clock, ChevronRight,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
  Input,
} from '../components/UI';

export default function QuizReview() {
  const { itemId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [viewing, setViewing] = useState(null); // student id

  const load = async () => {
    try { setData(await api.listQuizSubmissions(itemId)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [itemId]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (error)   return <ErrorBanner>{error}</ErrorBanner>;
  if (!data)   return null;

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
        title={`Review: ${data.item.title}`}
        sub={`${data.questionCount} questions · ${data.totalPoints} total points · scaled to ${data.item.max_score}`}
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner onClose={() => setInfo(null)}>{info}</SuccessBanner>}

      <Card className="p-0 overflow-hidden">
        <ul className="divide-y list-none m-0 p-0" style={{ borderColor: 'var(--rule)' }}>
          {data.submissions.map(s => {
            const initials = s.student_name.split(' ').map(n => n[0]).join('').slice(0, 2);
            return (
              <li key={s.student_id} className="px-5 py-4 flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full grid place-items-center text-xs font-semibold shrink-0"
                  style={{ background: 'var(--cream)' }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{s.student_name}</div>
                  <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                    {s.student_number}
                  </div>
                  {s.submitted ? (
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                      <span style={{ color: 'var(--muted)' }}>
                        Submitted {s.submitted_at && new Date(s.submitted_at).toLocaleString()}
                      </span>
                      {s.pending_count > 0 && (
                        <Pill tone="warn">
                          <Clock size={10} /> {s.pending_count} essay{s.pending_count !== 1 ? 's' : ''} to grade
                        </Pill>
                      )}
                      {s.pending_count === 0 && s.final_score != null && (
                        <Pill tone="ok">
                          <CheckCircle2 size={10} /> Graded
                        </Pill>
                      )}
                    </div>
                  ) : (
                    <Pill tone="bad">Not submitted</Pill>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.final_score != null && (
                    <div className="text-right">
                      <div className="font-serif text-xl tabular-nums">
                        {Number(s.final_score)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                        / {data.item.max_score}
                      </div>
                    </div>
                  )}
                  {s.submitted && (
                    <Button variant="ghost" onClick={() => setViewing(s.student_id)}>
                      <Eye size={14} /> View
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {viewing && (
        <StudentSubmissionModal
          itemId={itemId}
          studentId={viewing}
          onClose={() => setViewing(null)}
          onGraded={() => {
            load();
            setInfo('Essay graded. Final score updated.');
          }}
        />
      )}
    </div>
  );
}

function StudentSubmissionModal({ itemId, studentId, onClose, onGraded }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try { setData(await api.getQuizSubmission(itemId, studentId)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [itemId, studentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 animate-fadeIn"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            {data && (
              <>
                <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
                  {data.student.student_number}
                </div>
                <h3 className="font-serif text-2xl">{data.student.name}</h3>
              </>
            )}
          </div>
          <button onClick={onClose} aria-label="Close">
            <span className="text-2xl">×</span>
          </button>
        </div>

        {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

        {loading ? (
          <Spinner />
        ) : (
          <div className="space-y-3">
            {data.questions.map((q, i) => (
              <QuestionReviewBlock
                key={q.id}
                index={i + 1}
                question={q}
                itemId={itemId}
                onGraded={() => { onGraded(); load(); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionReviewBlock({ index, question, itemId, onGraded }) {
  const ans = question.answer;
  const awarded = ans?.awarded_points;
  const isEssay = question.type === 'essay';
  const isPending = isEssay && awarded == null;

  const [score, setScore] = useState(awarded != null ? String(awarded) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const saveGrade = async () => {
    setBusy(true); setErr(null);
    try {
      await api.gradeEssay(itemId, ans.id, Number(score));
      onGraded();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="p-4 rounded-xl border"
      style={{ borderColor: isPending ? 'var(--warn)' : 'var(--rule)', background: '#fff' }}
    >
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>Q{index}</span>
        <Pill tone="muted">{question.points} pt{question.points !== 1 ? 's' : ''}</Pill>
        {awarded != null && (
          <Pill tone={awarded === question.points ? 'ok' : awarded > 0 ? 'warn' : 'bad'}>
            {awarded} / {question.points}
          </Pill>
        )}
        {isPending && <Pill tone="warn">Needs grading</Pill>}
      </div>
      <p className="text-sm font-medium whitespace-pre-wrap mb-3">{question.prompt}</p>

      {question.type === 'multiple_choice' && (
        <ul className="space-y-1 list-none p-0 m-0">
          {question.choices.map(c => {
            const picked = ans?.choice_id === c.id;
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 p-2 rounded-lg border text-sm"
                style={{
                  borderColor: c.is_correct ? 'var(--ok)' : picked ? 'var(--bad)' : 'var(--rule)',
                  background: c.is_correct ? '#E8F1EB' : picked && !c.is_correct ? '#F4DBD5' : '#fff',
                }}
              >
                <span className="flex-1">{c.text}</span>
                {picked && <Pill tone={c.is_correct ? 'ok' : 'bad'}>Picked</Pill>}
                {c.is_correct && <CheckCircle2 size={12} style={{ color: 'var(--ok)' }} />}
              </li>
            );
          })}
        </ul>
      )}

      {question.type === 'true_false' && (
        <div className="text-sm">
          Student answered:{' '}
          <strong style={{ color: awarded > 0 ? 'var(--ok)' : 'var(--bad)' }}>
            {ans?.answer_bool === 1 ? 'True' : ans?.answer_bool === 0 ? 'False' : '(no answer)'}
          </strong>
          {' '}· Correct:{' '}
          <strong style={{ color: 'var(--ok)' }}>
            {question.correct_bool === 1 ? 'True' : 'False'}
          </strong>
        </div>
      )}

      {question.type === 'short_answer' && (
        <div className="text-sm">
          <div>
            Student wrote:{' '}
            <span
              className="px-2 py-0.5 rounded"
              style={{
                background: awarded > 0 ? '#E8F1EB' : '#F4DBD5',
                color: awarded > 0 ? 'var(--ok)' : 'var(--bad)',
                fontWeight: 600,
              }}
            >
              "{ans?.answer_text || '(blank)'}"
            </span>
          </div>
          <div className="mt-1" style={{ color: 'var(--muted)' }}>
            Expected: "{question.correct_text}"
          </div>
        </div>
      )}

      {question.type === 'essay' && (
        <>
          <div
            className="p-3 rounded-xl text-sm whitespace-pre-wrap mb-3"
            style={{ background: 'var(--cream)' }}
          >
            {ans?.answer_text || '(no answer)'}
          </div>
          {err && <div className="mb-2"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={question.points}
              step="0.1"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Points"
              className="!w-32 text-center tabular-nums"
              aria-label="Award points"
            />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>/ {question.points}</span>
            <Button
              variant="primary"
              onClick={saveGrade}
              loading={busy}
              disabled={score === ''}
            >
              {awarded != null ? 'Update score' : 'Grade'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
