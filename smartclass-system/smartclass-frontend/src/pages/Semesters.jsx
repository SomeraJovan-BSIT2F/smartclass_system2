import { useEffect, useState } from 'react';
import {
  Plus, X, Archive, ArchiveRestore, Calendar, AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
  Field, Input,
} from '../components/UI';

export default function Semesters() {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirming, setConfirming] = useState(null); // { semester, action }

  const load = async () => {
    setLoading(true);
    try {
      const { semesters } = await api.listSemesters();
      setSemesters(semesters);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const archive = async (semester) => {
    try {
      const r = await api.archiveSemester(semester.id);
      setInfo(
        `Archived "${semester.label}". ${r.archived?.sections || 0} sections archived, ` +
        `${r.archived?.qrCodes || 0} QR codes revoked.`
      );
      load();
    } catch (e) { setError(e.message); }
  };

  const unarchive = async (semester) => {
    try {
      await api.unarchiveSemester(semester.id);
      setInfo(`Unarchived "${semester.label}". Sections set back to active.`);
      load();
    } catch (e) { setError(e.message); }
  };

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Semesters"
        sub="Add new semesters and archive old ones."
        action={
          <Button variant="accent" onClick={() => setShowForm(true)}>
            <Plus size={14} aria-hidden="true" /> New semester
          </Button>
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner onClose={() => setInfo(null)}>{info}</SuccessBanner>}

      {semesters.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} aria-hidden="true" />
          <div className="font-serif text-xl">No semesters yet</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Create your first semester to start scheduling sections.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {semesters.map(s => {
            const archived = !!s.archived_at;
            const active = !!s.is_active;
            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {s.code}
                    </div>
                    <div className="font-serif text-xl mt-1">{s.label}</div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {active && <Pill tone="ok">Active</Pill>}
                    {archived && <Pill tone="muted">Archived</Pill>}
                  </div>
                </div>
                <div className="text-xs mt-3 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                  <Calendar size={12} aria-hidden="true" />
                  {new Date(s.start_date).toLocaleDateString()} — {new Date(s.end_date).toLocaleDateString()}
                </div>
                {archived && (
                  <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                    Archived {new Date(s.archived_at).toLocaleDateString()}
                  </div>
                )}
                <div className="mt-4">
                  {archived ? (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => setConfirming({ semester: s, action: 'unarchive' })}
                    >
                      <ArchiveRestore size={14} aria-hidden="true" /> Unarchive
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => setConfirming({ semester: s, action: 'archive' })}
                    >
                      <Archive size={14} aria-hidden="true" /> Archive
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <NewSemesterModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); setInfo('Semester created.'); }}
        />
      )}

      {confirming && (
        <ConfirmModal
          title={confirming.action === 'archive' ? 'Archive semester?' : 'Unarchive semester?'}
          body={
            confirming.action === 'archive'
              ? (
                <>
                  Archiving <strong>{confirming.semester.label}</strong> will:
                  <ul className="mt-3 space-y-1 list-disc pl-5 text-sm">
                    <li>Mark all sections in this semester as archived</li>
                    <li>Revoke all unrevoked QR codes for this semester</li>
                    <li>Lock attendance and grade editing for these sections</li>
                  </ul>
                  <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                    Records remain in the database. You can unarchive at any time.
                  </p>
                </>
              )
              : (
                <>
                  Unarchive <strong>{confirming.semester.label}</strong>? Sections will become editable again.
                </>
              )
          }
          confirmLabel={confirming.action === 'archive' ? 'Archive semester' : 'Unarchive'}
          variant={confirming.action === 'archive' ? 'danger' : 'primary'}
          onConfirm={() => {
            const { semester, action } = confirming;
            setConfirming(null);
            if (action === 'archive') archive(semester);
            else unarchive(semester);
          }}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

function NewSemesterModal({ onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const today = new Date();
  const sixMonthsLater = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
  const fmt = d => d.toISOString().slice(0, 10);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(e.target);
      await api.createSemester({
        code: fd.get('code'),
        label: fd.get('label'),
        startDate: fd.get('startDate'),
        endDate: fd.get('endDate'),
        isActive: fd.get('isActive') === 'on',
      });
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="New semester" onClose={onClose}>
      {err && <div className="mb-4"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Code">
            <Input
              name="code"
              required
              placeholder="2025-2026-1"
              defaultValue={`${today.getFullYear()}-${today.getFullYear() + 1}-1`}
            />
          </Field>
          <Field label="Label">
            <Input
              name="label"
              required
              placeholder="1st Semester 2025–2026"
              defaultValue={`1st Semester ${today.getFullYear()}–${today.getFullYear() + 1}`}
            />
          </Field>
          <Field label="Start date">
            <Input type="date" name="startDate" required defaultValue={fmt(today)} />
          </Field>
          <Field label="End date">
            <Input type="date" name="endDate" required defaultValue={fmt(sixMonthsLater)} />
          </Field>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="isActive" defaultChecked />
            <span>Set as active semester</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="accent" loading={busy}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmModal({ title, body, confirmLabel, variant = 'primary', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm leading-relaxed">{body}</div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="modal-heading" className="font-serif text-2xl">{title}</h3>
          <button onClick={onClose} aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
