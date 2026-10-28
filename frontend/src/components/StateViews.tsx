import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : 'Something went wrong while loading this.';
  return (
    <div role="alert" className="card mx-auto max-w-md p-8 text-center">
      <h2 className="text-xl font-bold">We couldn’t load this</h2>
      <p className="mt-2 text-sm text-muted">{msg}</p>
      {onRetry && <button className="btn-primary mt-5" onClick={onRetry}>Try again</button>}
    </div>
  );
}
export function EmptyState({ title, body, cta }: { title: string; body?: string; cta?: { to: string; label: string } }) {
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      {body && <p className="mt-2 text-sm text-muted">{body}</p>}
      {cta && <Link to={cta.to} className="btn-primary mt-5">{cta.label}</Link>}
    </div>
  );
}
