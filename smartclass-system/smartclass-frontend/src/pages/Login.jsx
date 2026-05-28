import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AppContext';
import { Button, Field, Input, ErrorBanner } from '../components/UI';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: 'var(--paper)' }}>
      <div
        className="hidden lg:block relative overflow-hidden"
        style={{ background: 'var(--ink)' }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(at 30% 20%, rgba(182,69,44,0.25), transparent 50%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(var(--paper) 1px, transparent 1px), linear-gradient(90deg, var(--paper) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden
        />
        <div
          className="relative h-full flex flex-col justify-between p-10"
          style={{ color: 'var(--paper)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-md grid place-items-center"
              style={{ background: 'var(--paper)', color: 'var(--ink)' }}
            >
              <QrCode size={18} />
            </div>
            <div className="font-serif text-xl">
              SmartClass <span style={{ color: 'var(--accent)' }}>QR</span>
            </div>
          </div>

          <div>
            <h1 className="font-serif text-5xl xl:text-6xl leading-[1.05]">
              QR-based<br />
              classroom attendance.
            </h1>
            <p className="text-base opacity-70 mt-5 max-w-md leading-relaxed">
              A capstone project for managing class attendance, grades, and excuse letters.
            </p>
          </div>

          <div className="text-[11px] opacity-50 uppercase tracking-[0.14em]">
            Academic Year 2025–2026
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2 className="font-serif text-3xl">Sign in</h2>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Use the account given to you by the admin.
          </p>

          <div className="mt-7 space-y-4">
            {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                placeholder="name@school.edu"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>

            <Button type="submit" variant="primary" loading={loading} className="w-full !py-3">
              Continue <ChevronRight size={14} />
            </Button>

            <div
              className="mt-6 p-3 rounded-xl border text-xs"
              style={{ background: 'var(--cream)', borderColor: 'var(--rule)' }}
            >
              <div className="font-semibold mb-1.5">Test accounts (password: Password123!)</div>
              <ul className="space-y-1" style={{ color: 'var(--muted)' }}>
                <li><strong>Admin:</strong> admin@smartclass.edu</li>
                <li><strong>Teacher:</strong> almonte@smartclass.edu</li>
                <li><strong>Student:</strong> adelia@smartclass.edu</li>
              </ul>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
