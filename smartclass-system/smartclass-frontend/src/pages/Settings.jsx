import { useState } from 'react';
import { api } from '../lib/api';
import {
  Card, SectionHeader, Button, Field, Input, ErrorBanner, SuccessBanner,
} from '../components/UI';
import { useAuth } from '../context/AppContext';

export default function Settings() {
  const { user } = useAuth();
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const submitPwd = async (e) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (pwd.newPassword !== pwd.confirm) {
      return setError('New passwords do not match.');
    }
    if (pwd.newPassword.length < 8) {
      return setError('New password must be at least 8 characters.');
    }
    setBusy(true);
    try {
      await api.changePassword(pwd.currentPassword, pwd.newPassword);
      setInfo('Password updated.');
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Settings"
        sub="Account and password settings."
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner>{info}</SuccessBanner>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-serif text-xl mb-4">Profile</h3>
          <div className="space-y-3">
            <Field label="Name"><Input value={user?.name || ''} disabled /></Field>
            <Field label="Email"><Input value={user?.email || ''} disabled /></Field>
            <Field label="Role"><Input value={user?.role || ''} disabled /></Field>
          </div>
          <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
            Profile changes must be made by an administrator.
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="font-serif text-xl mb-4">Security</h3>
          <form onSubmit={submitPwd} className="space-y-3">
            <Field label="Current password">
              <Input
                type="password"
                value={pwd.currentPassword}
                onChange={e => setPwd({ ...pwd, currentPassword: e.target.value })}
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                value={pwd.newPassword}
                onChange={e => setPwd({ ...pwd, newPassword: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                type="password"
                value={pwd.confirm}
                onChange={e => setPwd({ ...pwd, confirm: e.target.value })}
                required
                autoComplete="new-password"
              />
            </Field>
            <Button type="submit" variant="primary" loading={busy}>
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
