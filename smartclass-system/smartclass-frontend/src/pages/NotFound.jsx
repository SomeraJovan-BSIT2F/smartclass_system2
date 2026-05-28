import { Link } from 'react-router-dom';
import { Button } from '../components/UI';

export default function NotFound() {
  return (
    <div className="grid place-items-center h-[60vh] text-center">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
          Error 404
        </div>
        <h1 className="font-serif text-6xl mt-3">Page not found</h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/dashboard" className="inline-block mt-6">
          <Button variant="primary">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
