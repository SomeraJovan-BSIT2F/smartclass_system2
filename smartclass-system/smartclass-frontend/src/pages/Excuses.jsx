import { useEffect, useState } from 'react';
import { CheckCircle2, Upload, FileText, Clock, X } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
  Field, Input, Select, Textarea,
} from '../components/UI';
import { useAuth } from '../context/AppContext';

export default function Excuses() {
  const { user } = useAuth();
  if (user?.role === 'student') return <StudentExcuses />;
  return <TeacherExcuses />;
}

function StudentExcuses() {
  const [sections, setSections] = useState([]);
  const [letters, setLetters] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [s, l] = await Promise.all([api.listSections(), api.listExcuses()]);
      setSections(s.sections);
      setLetters(l.letters);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const fd = new FormData(e.target);
      await api.submitExcuse(fd);
      setInfo('Excuse letter submitted for review.');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Excuse letters"
        sub="Submit excuse letters and see their status."
        action={<Button variant="accent" onClick={() => setShowForm(true)}>+ New letter</Button>}
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner>{info}</SuccessBanner>}

      <Card className="p-6">
        <h3 className="font-serif text-xl mb-4">Your submissions</h3>
        {letters.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
            No excuse letters yet.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
            {letters.map(l => (
              <div key={l.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4" style={{ borderColor: 'var(--rule)' }}>
                <FileText size={18} style={{ color: 'var(--accent)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {new Date(l.absence_date).toLocaleDateString()} — {l.subject}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {l.reason_type} · submitted {new Date(l.submitted_at).toLocaleDateString()}
                  </div>
                </div>
                <Pill tone={l.status === 'approved' ? 'ok' : l.status === 'rejected' ? 'bad' : 'warn'}>
                  {l.status}
                </Pill>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Submit excuse letter">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Date of absence">
                <Input type="date" name="absenceDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field label="Section">
                <Select name="sectionId" required>
                  <option value="">Select…</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.code} — {s.subject}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason" full>
                <Select name="reasonType" required>
                  <option value="medical">Medical</option>
                  <option value="family">Family emergency</option>
                  <option value="official">Official school activity</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Detailed explanation" full>
                <Textarea
                  name="explanation"
                  rows={5}
                  required
                  minLength={10}
                  placeholder="Provide context that will help your instructor review your request…"
                />
              </Field>
              <Field label="Supporting document (optional)" full>
                <input
                  type="file"
                  name="attachment"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="text-sm"
                />
                <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                  PDF, JPG, or PNG · max 10 MB
                </div>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="accent" loading={busy}>Submit letter</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TeacherExcuses() {
  const [letters, setLetters] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { letters } = await api.listExcuses(filter ? { status: filter } : {});
      setLetters(letters);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const review = async (id, status) => {
    try {
      await api.reviewExcuse(id, status);
      setInfo(`Letter ${status}.`);
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Review submissions"
        sub="Review excuse letters from students."
        action={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner>{info}</SuccessBanner>}

      {loading ? (
        <div className="grid place-items-center h-48"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {letters.length === 0 ? (
            <Card className="p-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
              No excuse letters to review.
            </Card>
          ) : letters.map(l => (
            <Card key={l.id} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{l.student_name}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {l.student_number}
                    </span>
                    <Pill tone={l.status === 'pending' ? 'warn' : l.status === 'approved' ? 'ok' : 'bad'}>
                      {l.status}
                    </Pill>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    {l.section_code} · absent {new Date(l.absence_date).toLocaleDateString()} · {l.reason_type}
                  </div>
                  <p className="text-sm mt-3">{l.explanation}</p>
                </div>
                {l.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={() => review(l.id, 'rejected')}>Reject</Button>
                    <Button variant="accent" onClick={() => review(l.id, 'approved')}>Approve</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 animate-fadeIn"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-2xl">{title}</h3>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
