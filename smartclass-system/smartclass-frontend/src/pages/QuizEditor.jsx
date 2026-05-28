import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Trash2, GripVertical, ListChecks,
  ToggleLeft, Type as TypeIcon, AlignLeft, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
  Field, Input, Select, Textarea,
} from '../components/UI';

const TYPE_META = {
  multiple_choice: { label: 'Multiple choice', icon: ListChecks },
  true_false:      { label: 'True / False',     icon: ToggleLeft },
  short_answer:    { label: 'Short answer',     icon: TypeIcon },
  essay:           { label: 'Essay',            icon: AlignLeft },
};

export default function QuizEditor() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [editingQ, setEditingQ] = useState(null);

  const load = async () => {
    try {
      setData(await api.listQuizQuestions(itemId));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [itemId]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;
  if (!data)   return <ErrorBanner>{error || 'Could not load quiz.'}</ErrorBanner>;

  const deleteQ = async (qId) => {
    if (!confirm('Delete this question?')) return;
    try {
      await api.deleteQuizQuestion(itemId, qId);
      setInfo('Question deleted.');
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        to="/gradebook"
        className="inline-flex items-center gap-1.5 text-sm hover:underline"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={14} /> Back to gradebook
      </Link>

      <SectionHeader
                title={data.item?.title || 'Quiz'}
        sub={`${data.questions.length} question${data.questions.length !== 1 ? 's' : ''} · ${data.totalPoints} total points · scaled to ${data.item?.max_score || '—'}`}
        action={
          <Button
            variant="accent"
            onClick={() => setEditingQ({ type: 'multiple_choice', points: 1, choices: [
              { text: '', is_correct: false }, { text: '', is_correct: false },
              { text: '', is_correct: false }, { text: '', is_correct: false },
            ]})}
          >
            <Plus size={14} /> Add question
          </Button>
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner onClose={() => setInfo(null)}>{info}</SuccessBanner>}

      {data.questions.length === 0 ? (
        <Card className="p-12 text-center">
          <ListChecks size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <div className="font-serif text-xl">No questions yet</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Add your first question to start building this quiz.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.questions.map((q, i) => {
            const meta = TYPE_META[q.type];
            const Icon = meta?.icon || ListChecks;
            return (
              <Card key={q.id} className="p-5">
                <div className="flex items-start gap-3">
                  <GripVertical size={16} className="mt-1 shrink-0" style={{ color: 'var(--muted)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                        Q{i + 1}
                      </span>
                      <Pill tone="accent"><Icon size={11} /> {meta?.label || q.type}</Pill>
                      <Pill tone="muted">{q.points} pt{q.points !== 1 ? 's' : ''}</Pill>
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed">{q.prompt}</p>

                    {q.type === 'multiple_choice' && (
                      <ul className="mt-3 space-y-1 list-none p-0 m-0">
                        {q.choices.map((c, ci) => (
                          <li key={c.id || ci} className="flex items-center gap-2 text-sm">
                            <div
                              className="w-4 h-4 rounded-full border shrink-0 grid place-items-center"
                              style={{
                                borderColor: c.is_correct ? 'var(--ok)' : 'var(--rule)',
                                background: c.is_correct ? 'var(--ok)' : '#fff',
                              }}
                            >
                              {c.is_correct && <CheckCircle2 size={10} color="#fff" />}
                            </div>
                            <span style={{ color: c.is_correct ? 'var(--ok)' : 'inherit' }}>
                              {c.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {q.type === 'true_false' && (
                      <div className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
                        Correct answer:{' '}
                        <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                          {q.correct_bool === 1 ? 'True' : 'False'}
                        </span>
                      </div>
                    )}

                    {q.type === 'short_answer' && (
                      <div className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
                        Expected answer:{' '}
                        <span style={{ color: 'var(--ok)', fontWeight: 600, fontStyle: 'italic' }}>
                          "{q.correct_text}"
                        </span>
                      </div>
                    )}

                    {q.type === 'essay' && (
                      <div className="mt-3 text-xs flex items-center gap-1.5" style={{ color: 'var(--warn)' }}>
                        <AlertCircle size={12} /> You'll grade these manually after submission.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => setEditingQ({ ...q, position: i + 1 })}
                      className="px-2 py-1 text-xs underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteQ(q.id)}
                      className="px-2 py-1 text-xs"
                      style={{ color: 'var(--bad)' }}
                      aria-label="Delete question"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editingQ && (
        <QuestionEditor
          itemId={itemId}
          question={editingQ}
          position={editingQ.position || (data.questions.length + 1)}
          onClose={() => setEditingQ(null)}
          onSaved={() => { setEditingQ(null); load(); setInfo('Question saved.'); }}
        />
      )}
    </div>
  );
}

function QuestionEditor({ itemId, question, position, onClose, onSaved }) {
  const [type, setType] = useState(question.type);
  const [prompt, setPrompt] = useState(question.prompt || '');
  const [points, setPoints] = useState(question.points || 1);
  const [correctText, setCorrectText] = useState(question.correct_text || '');
  const [correctBool, setCorrectBool] = useState(
    question.correct_bool == null ? null : Number(question.correct_bool)
  );
  const [choices, setChoices] = useState(
    question.choices && question.choices.length > 0
      ? question.choices.map(c => ({ text: c.text || '', is_correct: !!c.is_correct }))
      : [
          { text: '', is_correct: false },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
        ]
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.upsertQuizQuestion(itemId, {
        id: question.id,
        type, prompt, points: Number(points), position,
        correctText: type === 'short_answer' ? correctText : null,
        correctBool: type === 'true_false' ? correctBool : null,
        choices: type === 'multiple_choice' ? choices.filter(c => c.text.trim()) : null,
      });
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const setChoice = (idx, key, val) => {
    setChoices(prev => prev.map((c, i) => i === idx ? { ...c, [key]: val } : c));
  };
  const setCorrectChoice = (idx) => {
    setChoices(prev => prev.map((c, i) => ({ ...c, is_correct: i === idx })));
  };
  const addChoice = () => {
    setChoices(prev => [...prev, { text: '', is_correct: false }]);
  };
  const removeChoice = (idx) => {
    if (choices.length <= 2) return;
    setChoices(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={save}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 animate-fadeIn"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-2xl">
            {question.id ? 'Edit question' : 'Add question'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {err && <div className="mb-4"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}

        <div className="space-y-4">
          <div>
            <span
              className="text-[11px] uppercase tracking-[0.14em] block mb-2"
              style={{ color: 'var(--muted)' }}
            >
              Question type
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(TYPE_META).map(([k, m]) => {
                const Icon = m.icon;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setType(k)}
                    className="p-3 rounded-xl border text-left transition"
                    style={{
                      borderColor: type === k ? 'var(--accent)' : 'var(--rule)',
                      background: type === k ? '#FBEFE9' : '#fff',
                    }}
                  >
                    <Icon size={16} style={{ color: type === k ? 'var(--accent)' : 'var(--muted)' }} />
                    <div className="text-xs font-medium mt-1.5">{m.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Question prompt">
            <Textarea
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="What's the question?"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Points">
              <Input
                type="number"
                min={0.1}
                step="0.1"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                required
              />
            </Field>
          </div>

          {/* Type-specific editor */}
          {type === 'multiple_choice' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[11px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--muted)' }}
                >
                  Choices (mark the correct one)
                </span>
                <button
                  type="button"
                  onClick={addChoice}
                  className="text-xs underline"
                  style={{ color: 'var(--accent)' }}
                >
                  + Add choice
                </button>
              </div>
              <div className="space-y-2">
                {choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectChoice(i)}
                      className="w-5 h-5 rounded-full border shrink-0 grid place-items-center"
                      style={{
                        borderColor: c.is_correct ? 'var(--ok)' : 'var(--rule)',
                        background: c.is_correct ? 'var(--ok)' : '#fff',
                      }}
                      aria-label={`Mark choice ${i + 1} as correct`}
                    >
                      {c.is_correct && <CheckCircle2 size={12} color="#fff" />}
                    </button>
                    <Input
                      value={c.text}
                      onChange={(e) => setChoice(i, 'text', e.target.value)}
                      placeholder={`Choice ${i + 1}`}
                      className="flex-1"
                    />
                    {choices.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeChoice(i)}
                        aria-label="Remove choice"
                        style={{ color: 'var(--bad)' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === 'true_false' && (
            <div>
              <span
                className="text-[11px] uppercase tracking-[0.14em] block mb-2"
                style={{ color: 'var(--muted)' }}
              >
                Correct answer
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 1, label: 'True' },
                  { v: 0, label: 'False' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setCorrectBool(opt.v)}
                    className="p-3 rounded-xl border text-center transition font-medium"
                    style={{
                      borderColor: correctBool === opt.v ? 'var(--ok)' : 'var(--rule)',
                      background: correctBool === opt.v ? '#E8F1EB' : '#fff',
                      color: correctBool === opt.v ? 'var(--ok)' : 'inherit',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'short_answer' && (
            <Field label="Correct answer (case-insensitive exact match)">
              <Input
                value={correctText}
                onChange={(e) => setCorrectText(e.target.value)}
                placeholder="e.g. Manila"
              />
            </Field>
          )}

          {type === 'essay' && (
            <div
              className="p-3 rounded-xl text-sm flex items-start gap-2"
              style={{ background: 'var(--cream)', color: 'var(--muted)' }}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                Essay answers are not auto-graded. You'll review each student's response and award
                points manually from the Quiz Review page.
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="accent" loading={busy}>
            {question.id ? 'Update' : 'Add question'}
          </Button>
        </div>
      </form>
    </div>
  );
}
