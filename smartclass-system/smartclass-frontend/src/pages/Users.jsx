import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
  Field, Input, Select,
} from '../components/UI';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState({ role: '', status: '', q: '' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { users } = await api.listUsers(
        Object.fromEntries(Object.entries(filter).filter(([, v]) => v))
      );
      setUsers(users);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id, status) => {
    try {
      await api.setUserStatus(id, status);
      setInfo(`User ${status}.`);
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Teachers & students"
        sub="Add and manage user accounts."
        action={
          <Button variant="accent" onClick={() => setShowForm(true)}>
            <Plus size={14} /> New user
          </Button>
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner>{info}</SuccessBanner>}

      <Card className="p-4 flex gap-2 flex-wrap">
        <Input
          placeholder="Search name or email…"
          value={filter.q}
          onChange={e => setFilter(f => ({ ...f, q: e.target.value }))}
          className="!w-64"
        />
        <Select
          value={filter.role}
          onChange={e => setFilter(f => ({ ...f, role: e.target.value }))}
          className="!w-40"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </Select>
        <Select
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="!w-40"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="suspended">Suspended</option>
        </Select>
      </Card>

      {loading ? (
        <div className="grid place-items-center h-48"><Spinner /></div>
      ) : (
        <Card className="p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-[11px] uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Reference</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t" style={{ borderColor: 'var(--rule)' }}>
                  <td className="py-3 font-medium">{u.first_name} {u.last_name}</td>
                  <td className="py-3" style={{ color: 'var(--muted)' }}>{u.email}</td>
                  <td className="py-3"><Pill tone="muted">{u.role}</Pill></td>
                  <td className="py-3 font-mono text-xs">
                    {u.student_number || u.employee_number || '—'}
                  </td>
                  <td className="py-3">
                    <Pill tone={u.status === 'active' ? 'ok' : u.status === 'archived' ? 'muted' : 'bad'}>
                      {u.status}
                    </Pill>
                  </td>
                  <td className="py-3 text-right">
                    {u.status === 'active' ? (
                      <button
                        className="text-xs underline"
                        style={{ color: 'var(--bad)' }}
                        onClick={() => setStatus(u.id, 'archived')}
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        className="text-xs underline"
                        style={{ color: 'var(--ok)' }}
                        onClick={() => setStatus(u.id, 'active')}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center" style={{ color: 'var(--muted)' }}>
                  No users match your filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && <NewUserModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); setInfo('User created.'); }} />}
    </div>
  );
}

function NewUserModal({ onClose, onSaved }) {
  const [role, setRole] = useState('student');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      await api.createUser(data);
      onSaved();
    } catch (error) {
      setErr(error.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 animate-fadeIn"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-2xl">New user</h3>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {err && <div className="mb-4"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Role">
            <Select name="role" value={role} onChange={e => setRole(e.target.value)} required>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Email">
            <Input type="email" name="email" required />
          </Field>
          <Field label="First name"><Input name="firstName" required /></Field>
          <Field label="Last name"><Input name="lastName" required /></Field>
          <Field label="Initial password" full>
            <Input type="password" name="password" required minLength={8} />
          </Field>
          {role === 'student' && (
            <>
              <Field label="Student number"><Input name="studentNumber" required /></Field>
              <Field label="Program"><Input name="program" /></Field>
              <Field label="Year level"><Input type="number" min={1} max={6} name="yearLevel" /></Field>
              <Field label="Enrolled at"><Input type="date" name="enrolledAt" /></Field>
            </>
          )}
          {role === 'teacher' && (
            <>
              <Field label="Employee number"><Input name="employeeNumber" required /></Field>
              <Field label="Department"><Input name="department" /></Field>
              <Field label="Title"><Input name="title" placeholder="Prof. / Dr." /></Field>
            </>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="accent" loading={busy}>Create user</Button>
        </div>
      </form>
    </div>
  );
}
