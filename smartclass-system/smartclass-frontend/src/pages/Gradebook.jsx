import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Trash2, Inbox, Upload, FileText } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
  Field, Input, Select, Textarea,
} from '../components/UI';

export default function Gradebook() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);

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

  const loadGrid = async () => {
    if (!activeSection) return;
    try {
      setGrid(await api.gradeGrid(activeSection.id));
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { loadGrid(); }, [activeSection]);

  const onCellChange = async (studentId, itemId, score) => {
    if (score === '' || score === null || isNaN(Number(score))) return;
    try {
      await api.recordGrade({ gradeItemId: itemId, studentId, score: Number(score) });
      setGrid(prev => ({
        ...prev,
        grid: { ...prev.grid, [`${studentId}-${itemId}`]: { score: Number(score) } },
      }));
    } catch (e) {
      setError(e.message);
      loadGrid();
    }
  };

  const onDeleteItem = async (itemId, title) => {
    if (!confirm(`Delete "${title}" and all its grades? This cannot be undone.`)) return;
    try {
      await api.deleteGradeItem(itemId);
      setInfo('Grade item deleted.');
      loadGrid();
    } catch (e) { setError(e.message); }
  };

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  if (sections.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Gradebook" title="No sections" sub="You don't have any sections assigned." />
        <Card className="p-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Once you're assigned to a section, your gradebook will appear here.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Gradebook · ${activeSection?.code}`}
        title="Activity scores & grades"
        sub="Enter or update scores in the cells."
        action={
          <div className="flex gap-2">
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
            <Button variant="accent" onClick={() => setShowItemForm(true)}>
              <Plus size={14} /> Add grade item
            </Button>
          </div>
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner onClose={() => setInfo(null)}>{info}</SuccessBanner>}

      {!grid ? (
        <div className="grid place-items-center h-48"><Spinner /></div>
      ) : grid.students.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="font-serif text-xl">No students enrolled</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Ask an admin to enroll students in this section first.
          </p>
        </Card>
      ) : grid.items.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="font-serif text-xl">No grade items yet</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Add a quiz, exam, or participation item to start grading.
          </p>
          <Button variant="accent" className="mt-4" onClick={() => setShowItemForm(true)}>
            <Plus size={14} /> Add your first grade item
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--cream)' }}>
                  <th
                    className="sticky left-0 text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium border-b"
                    style={{ borderColor: 'var(--rule)', background: 'var(--cream)', color: 'var(--muted)', minWidth: 200 }}
                  >
                    Student
                  </th>
                  {grid.items.map(item => (
                    <th
                      key={item.id}
                      className="text-left py-3 px-3 border-b border-l"
                      style={{ borderColor: 'var(--rule)', minWidth: 140 }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span
                              className="text-[10px] uppercase tracking-wider font-medium"
                              style={{ color: 'var(--muted)' }}
                            >
                              {item.category}
                            </span>
                            {item.submission_type === 'file' && (
                              <Upload size={10} style={{ color: 'var(--accent)' }} aria-label="File submission" />
                            )}
                            {item.submission_type === 'quiz' && (
                              <FileText size={10} style={{ color: 'var(--accent)' }} aria-label="Quiz" />
                            )}
                          </div>
                          <div className="font-medium text-sm truncate">{item.title}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                            /{item.max_score} · w{item.weight}
                          </div>
                          {item.submission_type === 'file' && (
                            <button
                              onClick={() => navigate(`/gradebook/${item.id}/submissions`)}
                              className="mt-1 text-[10px] flex items-center gap-1 underline"
                              style={{ color: 'var(--accent)' }}
                            >
                              <Inbox size={10} /> {item.submission_count || 0} submission{item.submission_count !== 1 ? 's' : ''}
                            </button>
                          )}
                          {item.submission_type === 'quiz' && (
                            <div className="mt-1 flex flex-col gap-0.5">
                              <button
                                onClick={() => navigate(`/gradebook/${item.id}/quiz-editor`)}
                                className="text-[10px] flex items-center gap-1 underline"
                                style={{ color: 'var(--accent)' }}
                              >
                                <FileText size={10} /> Edit questions
                              </button>
                              <button
                                onClick={() => navigate(`/gradebook/${item.id}/quiz-review`)}
                                className="text-[10px] flex items-center gap-1 underline"
                                style={{ color: 'var(--accent)' }}
                              >
                                <Inbox size={10} /> Review submissions
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => onDeleteItem(item.id, item.title)}
                          className="p-1 hover:bg-stone-200 rounded shrink-0"
                          title="Delete this item"
                          aria-label={`Delete ${item.title}`}
                        >
                          <Trash2 size={12} style={{ color: 'var(--bad)' }} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th
                    className="text-left py-3 px-3 border-b border-l text-[11px] uppercase tracking-wider font-medium"
                    style={{ borderColor: 'var(--rule)', color: 'var(--muted)' }}
                  >
                    Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {grid.students.map(student => {
                  let weightedSum = 0, weightTotal = 0;
                  grid.items.forEach(item => {
                    const cell = grid.grid[`${student.id}-${item.id}`];
                    if (cell?.score != null) {
                      weightedSum += (cell.score / item.max_score) * 100 * Number(item.weight);
                      weightTotal += Number(item.weight);
                    }
                  });
                  const avg = weightTotal ? Math.round(weightedSum / weightTotal) : null;

                  return (
                    <tr key={student.id} className="border-b hover:bg-stone-50/50" style={{ borderColor: 'var(--rule)' }}>
                      <td className="sticky left-0 py-2 px-4 bg-white" style={{ minWidth: 200 }}>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                          {student.student_number}
                        </div>
                      </td>
                      {grid.items.map(item => {
                        const cell = grid.grid[`${student.id}-${item.id}`];
                        return (
                          <td key={item.id} className="py-1 px-2 border-l" style={{ borderColor: 'var(--rule)' }}>
                            <ScoreInput
                              initial={cell?.score ?? ''}
                              max={item.max_score}
                              onCommit={(v) => onCellChange(student.id, item.id, v)}
                            />
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 border-l" style={{ borderColor: 'var(--rule)' }}>
                        {avg != null ? (
                          <span
                            className="font-serif text-base tabular-nums"
                            style={{
                              color: avg >= 85 ? 'var(--ok)'
                                : avg >= 75 ? 'var(--warn)'
                                : 'var(--bad)',
                            }}
                          >
                            {avg}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showItemForm && activeSection && (
        <AddGradeItemModal
          sectionId={activeSection.id}
          onClose={() => setShowItemForm(false)}
          onSaved={() => { setShowItemForm(false); loadGrid(); setInfo('Grade item added. Enrolled students will be notified.'); }}
        />
      )}
    </div>
  );
}

function ScoreInput({ initial, max, onCommit }) {
  const [value, setValue] = useState(initial === null || initial === undefined ? '' : String(initial));

  useEffect(() => {
    setValue(initial === null || initial === undefined ? '' : String(initial));
  }, [initial]);

  const commit = () => {
    if (String(value) === String(initial)) return;
    if (value === '') return;
    const n = Number(value);
    if (isNaN(n) || n < 0 || n > Number(max)) {
      setValue(initial === null || initial === undefined ? '' : String(initial));
      return;
    }
    onCommit(n);
  };

  return (
    <input
      type="number"
      step="0.01"
      min={0}
      max={max}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') { setValue(String(initial || '')); e.target.blur(); }
      }}
      placeholder="—"
      className="w-full px-2 py-1.5 text-sm rounded border-0 bg-transparent hover:bg-white focus:bg-white focus:ring-1 tabular-nums"
      style={{ outlineColor: 'var(--accent)' }}
    />
  );
}

function AddGradeItemModal({ sectionId, onClose, onSaved }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [submissionMode, setSubmissionMode] = useState('none'); // 'none' | 'file' | 'quiz'

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(e.target);
      const result = await api.createGradeItem({
        sectionId,
        title: fd.get('title'),
        category: fd.get('category'),
        maxScore: Number(fd.get('maxScore')),
        weight: Number(fd.get('weight')),
        dueDate: fd.get('dueDate') || null,
        submissionType: submissionMode,
        instructions: fd.get('instructions') || null,
      });
      // If quiz, jump straight to the quiz editor
      if (submissionMode === 'quiz' && result?.id) {
        navigate(`/gradebook/${result.id}/quiz-editor`);
      } else {
        onSaved();
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={submit}
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 animate-fadeIn"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-2xl">Add grade item</h3>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {err && <div className="mb-4"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Title" full>
            <Input name="title" required placeholder="Quiz 1, Midterm Exam, Class Participation" />
          </Field>
          <Field label="Category">
            <Select name="category" required defaultValue="quiz">
              <option value="quiz">Quiz</option>
              <option value="activity">Activity</option>
              <option value="participation">Participation</option>
              <option value="exam">Exam</option>
              <option value="recitation">Recitation</option>
            </Select>
          </Field>
          <Field label="Max score">
            <Input type="number" name="maxScore" required min={1} step="0.01" defaultValue={100} />
          </Field>
          <Field label="Weight">
            <Input type="number" name="weight" required min={0.1} step="0.1" defaultValue={1.0} />
          </Field>
          <Field label="Due date (optional)">
            <Input type="date" name="dueDate" />
          </Field>
          <Field label="Instructions (optional)" full>
            <Textarea
              name="instructions"
              rows={3}
              placeholder="What students need to know or do for this task..."
            />
          </Field>
        </div>

        {/* Submission type chooser */}
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--muted)' }}>
            Student submission type
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { id: 'none', label: 'No submission',   desc: 'Score entered manually.' },
              { id: 'file', label: 'File upload',     desc: 'Student uploads a file.' },
              { id: 'quiz', label: 'Online quiz',     desc: 'Multiple choice, T/F, short answer, or essay.' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSubmissionMode(opt.id)}
                className="p-3 rounded-xl border text-left transition"
                style={{
                  borderColor: submissionMode === opt.id ? 'var(--accent)' : 'var(--rule)',
                  background: submissionMode === opt.id ? '#FBEFE9' : '#fff',
                }}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          {submissionMode === 'quiz' && (
            <div className="mt-3 text-xs p-3 rounded-lg" style={{ background: 'var(--cream)', color: 'var(--muted)' }}>
              After saving, you'll be taken to the quiz editor to add questions.
            </div>
          )}
        </div>

        <div className="text-xs mt-3 p-3 rounded-lg" style={{ background: 'var(--cream)', color: 'var(--muted)' }}>
          <strong>Heads up:</strong> all enrolled students will get a notification about this task.
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="accent" loading={busy}>
            {submissionMode === 'quiz' ? 'Save & build quiz' : 'Add item'}
          </Button>
        </div>
      </form>
    </div>
  );
}
