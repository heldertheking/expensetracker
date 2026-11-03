import type { ReactNode } from 'react';
import { errorMessage } from '../api/client';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ErrorState({
  error,
  title = 'Could not load data',
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">
        <span aria-hidden="true">⚠ </span>
        {title}
      </p>
      <p className="muted">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state state-empty">
      <p className="state-title">{title}</p>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
