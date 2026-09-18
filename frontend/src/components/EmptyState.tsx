import { ReactNode } from 'react';

// Used wherever a list can legitimately be empty (no schools, no workshops
// yet, nothing to review) — a friendly icon + one-line explanation + a
// clear next action reads much better to non-technical staff than a bare
// "No X yet." line.
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      <p className="empty-state-text">{text}</p>
      {action}
    </div>
  );
}
