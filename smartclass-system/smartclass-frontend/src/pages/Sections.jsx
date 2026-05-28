import { useEffect, useState } from 'react';
import { Users, QrCode, X, Plus, UserPlus, Check } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
  Field, Input, Select,
} from '../components/UI';
import { useAuth } from '../context/AppContext';

export default function Sections() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [enrolling, setEnrolling] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { sections } = await api.listSections();
      setSections(sections);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const issueBatch = async (section) => {
    if (!confirm(`Generate QR codes for all students in ${section.code}? Existing codes will be rotated.`)) return;
    try {
      const r = await api.issueQrBatch(section.id, section.semester_id);
      setInfo(`Issued ${r.count} QR codes for ${section.code}.`);
    } catch (e) { setError(e.message); }
  };

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <SectionHeader
                title={user?.role === 'admin' ? 'All sections' : 'My sections'}
        sub="Create sections and manage students."
        action={
          user?.role === 'admin' && (
            <Button variant="accent" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New section
            </Button>
          )
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner>{info}</SuccessBanner>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.length === 0 && (
          <Card className="p-12 text-center md:col-span-2 lg:col-span-3">
            <div className="font-serif text-xl">No sections yet</div>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
              {user?.role === 'admin'
                ? 'Click "New section" above to create your first section.'
                : 'No sections have been assigned to you yet.'}
            </p>
          </Card>
        )}
        {sections.map(s => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {s.code}
                </div>
                <div className="font-serif text-xl mt-1">{s.subject}</div>
              </div>
              <Pill tone={s.status === 'active' ? 'ok' : 'muted'}>{s.status}</Pill>
            </div>
            <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              {s.schedule || 'Schedule TBA'} · {s.teacher_name}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Users size={14} style={{ color: 'var(--muted)' }} />
              <span className="text-sm">{s.student_count} students</span>
            </div>
            <div className="mt-4 space-y-2">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSelected(s)}
              >
                View roster
              </Button>
              {user?.role === 'admin' && (
                <>
                  <Button
                    variant="subtle"
                    className="w-full"
                    onClick={() => setEnrolling(s)}
                  >
                    <UserPlus size={14} /> Enroll students
                  </Button>
                  <Button
                    variant="subtle"
                    className="w-full"
                    onClick={() => issueBatch(s)}
                  >
                    <QrCode size={14} /> Issue QR batch
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {selected && <SectionRoster section={selected} onClose={() => setSelected(null)} />}
      {enrolling && (
        <EnrollStudentsModal
          section={enrolling}
          onClose={() => setEnrolling(null)}
          onSaved={() => { setEnrolling(null); load(); setInfo('Students enrolled.'); }}
        />
      )}
      {showCreate && (
        <CreateSectionModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); setInfo('Section created.'); }}
        />
      )}
    </div>
  );
}

function SectionRoster({ section, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.getSection(section.id).then(setData); }, [section]);

  return (
    <Modal title={section.subject} subtitle={section.code} onClose={onClose} max="3xl">
      {!data ? (
        <Spinner />
      ) : data.students.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
          No students enrolled yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-[11px] uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                <th className="py-2 font-medium">Student #</th>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map(st => (
                <tr key={st.id} className="border-t" style={{ borderColor: 'var(--rule)' }}>
                  <td className="py-2 font-mono text-xs">{st.student_number}</td>
                  <td className="py-2">{st.name}</td>
                  <td className="py-2" style={{ color: 'var(--muted)' }}>{st.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function EnrollStudentsModal({ section, onClose, onSaved }) {
  const [students, setStudents] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [{ students }, sec] = await Promise.all([
          api.listStudents(),
          api.getSection(section.id),
        ]);
        setStudents(students);
        setEnrolledIds(new Set(sec.students.map(s => s.id)));
      } catch (e) { setErr(e.message); }
    })();
  }, [section]);

  const toggle = (id) => {
    if (enrolledIds.has(id)) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const submit = async () => {
    if (selectedIds.size === 0) return;
    setBusy(true); setErr(null);
    try {
      for (const id of selectedIds) {
        await api.enrollStudent(section.id, id);
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const filtered = students.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      title="Enroll students"
      subtitle={`${section.code} — ${section.subject}`}
      onClose={onClose}
      max="3xl"
    >
      {err && <div className="mb-4"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}

      <Input
        placeholder="Search by name, number, or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3"
      />

      <div
        className="border rounded-xl max-h-[50vh] overflow-y-auto"
        style={{ borderColor: 'var(--rule)' }}
      >
        {students.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
            No active students in the system. Create student accounts in the Users page first.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
            No students match your search.
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {filtered.map(s => {
                const isEnrolled = enrolledIds.has(s.id);
                const isSelected = selectedIds.has(s.id);
                return (
                  <tr
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`border-b transition ${isEnrolled ? 'opacity-50' : 'cursor-pointer hover:bg-stone-50'}`}
                    style={{ borderColor: 'var(--rule)' }}
                  >
                    <td className="py-2.5 px-3 w-10">
                      <div
                        className="w-5 h-5 rounded border grid place-items-center"
                        style={{
                          borderColor: isSelected || isEnrolled ? 'var(--ink)' : 'var(--rule)',
                          background: isSelected || isEnrolled ? 'var(--ink)' : 'transparent',
                        }}
                      >
                        {(isSelected || isEnrolled) && <Check size={12} style={{ color: 'var(--paper)' }} />}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-xs">{s.student_number}</td>
                    <td className="py-2.5 px-2 font-medium">{s.name}</td>
                    <td className="py-2.5 px-2 text-xs" style={{ color: 'var(--muted)' }}>
                      {s.program || '—'}
                    </td>
                    <td className="py-2.5 px-2">
                      {isEnrolled && <Pill tone="ok">Enrolled</Pill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          {selectedIds.size} selected · {enrolledIds.size} already enrolled
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            loading={busy}
            disabled={selectedIds.size === 0}
            onClick={submit}
          >
            Enroll {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateSectionModal({ onClose, onSaved }) {
  const [teachers, setTeachers] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [showSemesterForm, setShowSemesterForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const loadOptions = async () => {
    try {
      const [t, s] = await Promise.all([
        api.listTeachers(),
        api.listSemesters(),
      ]);
      setTeachers(t.teachers);
      setSemesters(s.semesters);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { loadOptions(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(e.target);
      await api.createSection({
        semesterId: Number(fd.get('semesterId')),
        teacherId: Number(fd.get('teacherId')),
        code: fd.get('code'),
        subject: fd.get('subject'),
        schedule: fd.get('schedule'),
        room: fd.get('room'),
      });
      onSaved();
    } catch (error) {
      setErr(error.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal title="New section" onClose={onClose} max="2xl">
      {err && <div className="mb-4"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}

      {teachers.length === 0 && (
        <div
          className="p-3 rounded-xl border text-sm mb-4"
          style={{ background: '#FBF0DC', borderColor: '#EBD5A6' }}
        >
          You don't have any teachers yet. Go to <strong>Users</strong> and create
          a teacher account first.
        </div>
      )}

      {semesters.length === 0 && !showSemesterForm && (
        <div
          className="p-3 rounded-xl border text-sm mb-4 flex items-center justify-between"
          style={{ background: '#FBF0DC', borderColor: '#EBD5A6' }}
        >
          <span>No semesters set up yet.</span>
          <Button variant="ghost" onClick={() => setShowSemesterForm(true)}>
            <Plus size={14} /> Add semester
          </Button>
        </div>
      )}

      {showSemesterForm && (
        <SemesterQuickAdd
          onClose={() => setShowSemesterForm(false)}
          onSaved={() => { setShowSemesterForm(false); loadOptions(); }}
        />
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Semester" full>
            <div className="flex gap-2">
              <Select name="semesterId" required disabled={semesters.length === 0} className="flex-1">
                <option value="">Select semester…</option>
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.label} {s.is_active ? '(active)' : ''}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="ghost" onClick={() => setShowSemesterForm(true)}>
                <Plus size={14} />
              </Button>
            </div>
          </Field>
          <Field label="Teacher" full>
            <Select name="teacherId" required disabled={teachers.length === 0}>
              <option value="">Select teacher…</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.department ? `— ${t.department}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section code">
            <Input name="code" required placeholder="BSCS-3A" />
          </Field>
          <Field label="Subject">
            <Input name="subject" required placeholder="Software Engineering" />
          </Field>
          <Field label="Schedule">
            <Input name="schedule" placeholder="MWF 10:00–11:00 AM" />
          </Field>
          <Field label="Room">
            <Input name="room" placeholder="ITC 401" />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="accent"
            loading={busy}
            disabled={teachers.length === 0 || semesters.length === 0}
          >
            Create section
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SemesterQuickAdd({ onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const today = new Date();
  const sixMonthsLater = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
  const fmt = d => d.toISOString().slice(0, 10);

  const submit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
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
    <div
      className="p-4 rounded-xl border mb-4"
      style={{ borderColor: 'var(--rule)', background: 'var(--cream)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-lg">Quick semester setup</h4>
        <button onClick={onClose} type="button"><X size={16} /></button>
      </div>
      {err && <div className="mb-3"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <div className="md:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>Save semester</Button>
        </div>
      </form>
    </div>
  );
}

function Modal({ children, onClose, title, subtitle, max = '2xl' }) {
  const widthClass = {
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }[max] || 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative w-full ${widthClass} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 animate-fadeIn`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            {subtitle && (
              <div
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--accent)' }}
              >
                {subtitle}
              </div>
            )}
            <h3 className="font-serif text-2xl">{title}</h3>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
