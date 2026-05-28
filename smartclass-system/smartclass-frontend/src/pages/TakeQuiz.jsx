import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Send, AlertTriangle, Calendar,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner,
  Textarea, Input,
} from '../components/UI';

export default function TakeQuiz() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({}); // questionId -> answer
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.takeQuiz(itemId);
        setData(r);
        if (r.alreadySubmitted) {
          // Already submitted — bounce to results
          navigate(`/my-tasks/${itemId}/results`, { replace: true });
        }
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [itemId]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (error)   return <ErrorBanner>{error}</ErrorBanner>;
  if (!data)   return null;

  const setAnswer = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const answeredCount = data.questions.filter(q => {
    const a = answers[q.id];
    if (q.type === 'multiple_choice') return a != null;
    if (q.type === 'true_false')     return a === 1 || a === 0;
    return typeof a === 'string' && a.trim().length > 0;
  }).length;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = data.questions.map(q => {
        const a = answers[q.id];
        if (q.type === 'multiple_choice')   return { questionId: q.id, choiceId: a ?? null };
        if (q.type === 'true_false')        return { questionId: q.id, answerBool: a };
        return { questionId: q.id, answerText: a || '' };
      });
      await api.submitQuiz(itemId, payload);
      navigate(`/my-tasks/${itemId}/results`, { replace: true });
    } catch (e) {
      setError(e.message);
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        to="/my-tasks"
        className="inline-flex items-center gap-1.5 text-sm hover:underline"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={14} /> Back to my tasks
      </Link>

      <SectionHeader
        eyebrow={`${data.item.section_code} — ${data.item.subject}`}
        title={data.item.title}
        sub={`${data.questions.length} questions · ${data.totalPoints} total points · scaled to ${data.item.max_score}`}
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      {data.item.instructions && (
        <Card className="p-5" style={{ background: 'var(--cream)' }}>
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
            Instructions
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.item.instructions}</p>
        </Card>
      )}

      {data.questions.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="font-serif text-xl">This quiz has no questions yet</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Come back later — your teacher hasn't added questions to this quiz yet.
          </p>
        </Card>
      ) : (
        <>
          {/* Progress bar */}
          <div
            className="sticky top-16 z-10 p-3 rounded-xl border bg-white"
            style={{ borderColor: 'var(--rule)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">
                    Answered {answeredCount} of {data.questions.length}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {Math.round((answeredCount / data.questions.length) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--rule)' }}>
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(answeredCount / data.questions.length) * 100}%`,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {data.questions.map((q, i) => (
              <QuestionBlock
                key={q.id}
                index={i + 1}
                question={q}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
              />
            ))}
          </div>

          {/* Submit button */}
          <Card className="p-5">
            {answeredCount < data.questions.length && (
              <div className="mb-3 text-sm flex items-start gap-2" style={{ color: 'var(--warn)' }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  You've answered {answeredCount} of {data.questions.length} questions.
                  Unanswered questions will be marked as 0 points.
                </span>
              </div>
            )}
            <Button
              variant="accent"
              onClick={() => setConfirming(true)}
              loading={submitting}
              className="w-full"
            >
              <Send size={14} /> Submit quiz
            </Button>
            <div className="text-xs mt-2 text-center" style={{ color: 'var(--muted)' }}>
              Once submitted, you cannot change your answers.
            </div>
          </Card>
        </>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirming(false)} />
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="font-serif text-2xl mb-3">Submit quiz?</h3>
            <p className="text-sm mb-2">
              You're about to submit <strong>{data.item.title}</strong> with{' '}
              <strong>{answeredCount}</strong> of {data.questions.length} questions answered.
            </p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              You cannot change your answers after submitting.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={submitting}>
                Keep editing
              </Button>
              <Button variant="accent" onClick={submit} loading={submitting}>
                Submit final answers
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionBlock({ index, question, value, onChange }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span
          className="text-xs font-mono shrink-0 mt-1"
          style={{ color: 'var(--muted)' }}
        >
          Q{index}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Pill tone="muted">{question.points} pt{question.points !== 1 ? 's' : ''}</Pill>
          </div>
          <p className="text-base font-medium whitespace-pre-wrap leading-relaxed">
            {question.prompt}
          </p>

          <div className="mt-4">
            {question.type === 'multiple_choice' && (
              <div className="space-y-2">
                {question.choices.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-stone-50 transition"
                    style={{
                      borderColor: value === c.id ? 'var(--accent)' : 'var(--rule)',
                      background: value === c.id ? '#FBEFE9' : '#fff',
                    }}
                  >
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      checked={value === c.id}
                      onChange={() => onChange(c.id)}
                      className="shrink-0"
                    />
                    <span className="text-sm">{c.text}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'true_false' && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 1, label: 'True' },
                  { v: 0, label: 'False' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => onChange(opt.v)}
                    className="p-3 rounded-xl border text-center transition font-medium"
                    style={{
                      borderColor: value === opt.v ? 'var(--accent)' : 'var(--rule)',
                      background: value === opt.v ? '#FBEFE9' : '#fff',
                      color: value === opt.v ? 'var(--accent)' : 'inherit',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {question.type === 'short_answer' && (
              <Input
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Your answer..."
              />
            )}

            {question.type === 'essay' && (
              <>
                <Textarea
                  value={value || ''}
                  onChange={(e) => onChange(e.target.value)}
                  rows={6}
                  placeholder="Write your essay answer here..."
                />
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  This is an essay question. Your teacher will grade it manually.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
