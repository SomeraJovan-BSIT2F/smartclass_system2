import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Trophy,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Spinner, ErrorBanner,
} from '../components/UI';

export default function QuizResults() {
  const { itemId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try { setData(await api.myQuizResults(itemId)); }
      catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [itemId]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (error)   return <ErrorBanner>{error}</ErrorBanner>;
  if (!data)   return null;

  const finalScore = data.grade?.score;
  const pct = data.totalPoints > 0
    ? Math.round((data.earnedPoints / data.totalPoints) * 100)
    : 0;

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
                title={data.item.title}
      />

      {/* Score card */}
      <Card className="p-6">
        {data.pendingReview ? (
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-full grid place-items-center shrink-0"
              style={{ background: '#FBF0DC' }}
            >
              <Clock size={20} style={{ color: 'var(--warn)' }} />
            </div>
            <div>
              <div className="font-serif text-2xl">Awaiting essay review</div>
              <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
                You earned <strong>{data.earnedPoints}</strong> of {data.totalPoints} auto-graded points.
                Your teacher needs to review your essay answer(s) before your final score is posted.
              </p>
            </div>
          </div>
        ) : finalScore != null ? (
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-full grid place-items-center shrink-0"
              style={{ background: pct >= 85 ? '#E8F1EB' : pct >= 70 ? '#FBF0DC' : '#F4DBD5' }}
            >
              <Trophy size={24} style={{
                color: pct >= 85 ? 'var(--ok)' : pct >= 70 ? 'var(--warn)' : 'var(--bad)'
              }} />
            </div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Your final score
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span
                  className="font-serif text-5xl tabular-nums leading-none"
                  style={{
                    color: pct >= 85 ? 'var(--ok)' : pct >= 70 ? 'var(--warn)' : 'var(--bad)',
                  }}
                >
                  {Number(finalScore)}
                </span>
                <span className="text-xl" style={{ color: 'var(--muted)' }}>
                  / {data.item.max_score}
                </span>
                <span className="text-sm ml-2" style={{ color: 'var(--muted)' }}>
                  ({Math.round((finalScore / data.item.max_score) * 100)}%)
                </span>
              </div>
              <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                Auto-graded points: {data.earnedPoints} of {data.totalPoints}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="font-serif text-xl">Submitted</div>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
              Your answers have been recorded. Score will appear shortly.
            </p>
          </div>
        )}
      </Card>

      {/* Per-question breakdown */}
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.14em] px-1" style={{ color: 'var(--muted)' }}>
          Your answers
        </div>
        {data.questions.map((q, i) => (
          <QuestionResult key={q.id} index={i + 1} question={q} />
        ))}
      </div>
    </div>
  );
}

function QuestionResult({ index, question }) {
  const ans = question.answer;
  const awarded = ans?.awarded_points;
  const isPending = ans && awarded == null;
  const isCorrect = awarded != null && awarded === question.points;
  const isPartial = awarded != null && awarded > 0 && awarded < question.points;
  const isWrong = awarded != null && awarded === 0;

  const Icon = isPending ? Clock
             : isCorrect  ? CheckCircle2
             : isPartial  ? CheckCircle2
             :              XCircle;
  const tone = isPending ? 'var(--warn)'
             : isCorrect  ? 'var(--ok)'
             : isPartial  ? 'var(--warn)'
             :              'var(--bad)';

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full grid place-items-center shrink-0"
          style={{
            background: isPending ? '#FBF0DC'
                      : isCorrect  ? '#E8F1EB'
                      : isPartial  ? '#FBF0DC'
                      :              '#F4DBD5',
          }}
        >
          <Icon size={16} style={{ color: tone }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>Q{index}</span>
            <Pill tone="muted">{question.points} pt{question.points !== 1 ? 's' : ''}</Pill>
            {isPending && <Pill tone="warn">Awaiting review</Pill>}
            {!isPending && (
              <span
                className="text-sm font-medium tabular-nums"
                style={{ color: tone }}
              >
                {awarded} / {question.points}
              </span>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{question.prompt}</p>

          {question.type === 'multiple_choice' && (
            <ul className="space-y-1 list-none p-0 m-0">
              {question.choices.map(c => {
                const picked = ans?.choice_id === c.id;
                const isAnswer = c.is_correct;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 p-2 rounded-lg border text-sm"
                    style={{
                      borderColor: isAnswer ? 'var(--ok)' : picked ? 'var(--bad)' : 'var(--rule)',
                      background: isAnswer ? '#E8F1EB' : picked && !isAnswer ? '#F4DBD5' : '#fff',
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border shrink-0 grid place-items-center"
                      style={{
                        borderColor: picked ? 'var(--ink)' : 'var(--rule)',
                        background: picked ? 'var(--ink)' : '#fff',
                      }}
                    >
                      {picked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="flex-1">{c.text}</span>
                    {isAnswer && <CheckCircle2 size={12} style={{ color: 'var(--ok)' }} />}
                    {picked && !isAnswer && <XCircle size={12} style={{ color: 'var(--bad)' }} />}
                  </li>
                );
              })}
            </ul>
          )}

          {question.type === 'true_false' && (
            <div className="text-sm">
              <div>
                Your answer:{' '}
                <span style={{ color: isCorrect ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }}>
                  {ans?.answer_bool === 1 ? 'True' : ans?.answer_bool === 0 ? 'False' : '(no answer)'}
                </span>
              </div>
              {!isCorrect && (
                <div className="mt-1" style={{ color: 'var(--muted)' }}>
                  Correct answer:{' '}
                  <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                    {question.correct_bool === 1 ? 'True' : 'False'}
                  </span>
                </div>
              )}
            </div>
          )}

          {question.type === 'short_answer' && (
            <div className="text-sm space-y-1">
              <div>
                Your answer:{' '}
                <span
                  className="px-2 py-0.5 rounded"
                  style={{
                    background: isCorrect ? '#E8F1EB' : '#F4DBD5',
                    color: isCorrect ? 'var(--ok)' : 'var(--bad)',
                    fontWeight: 600,
                  }}
                >
                  "{ans?.answer_text || '(blank)'}"
                </span>
              </div>
              {!isCorrect && question.correct_text && (
                <div style={{ color: 'var(--muted)' }}>
                  Correct answer:{' '}
                  <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                    "{question.correct_text}"
                  </span>
                </div>
              )}
            </div>
          )}

          {question.type === 'essay' && (
            <div
              className="p-3 rounded-xl text-sm whitespace-pre-wrap"
              style={{ background: 'var(--cream)' }}
            >
              {ans?.answer_text || '(no answer)'}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
