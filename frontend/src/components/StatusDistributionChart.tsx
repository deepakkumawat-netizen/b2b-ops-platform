import { SchoolStatus } from '@b2b-ops/shared';

// Reuses the app's existing status semantics (same colors as the badges on
// the Schools list) rather than a generated categorical palette — Active,
// Renewed and Churned already have one fixed meaning everywhere else.
const STATUS_ORDER = [SchoolStatus.ACTIVE, SchoolStatus.RENEWED, SchoolStatus.CHURNED];

const STATUS_META: Record<SchoolStatus, { label: string; color: string }> = {
  [SchoolStatus.ACTIVE]: { label: 'Active', color: 'var(--success)' },
  [SchoolStatus.RENEWED]: { label: 'Renewed', color: 'var(--primary)' },
  [SchoolStatus.CHURNED]: { label: 'Churned', color: 'var(--danger)' },
};

export function StatusDistributionChart({ counts }: { counts: Record<string, number> }) {
  const total = STATUS_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  if (total === 0) return null;

  return (
    <div className="status-chart">
      <div className="status-chart-bar">
        {STATUS_ORDER.map((status) => {
          const count = counts[status] ?? 0;
          if (count === 0) return null;
          const percent = (count / total) * 100;
          return (
            <div
              key={status}
              className="status-chart-segment"
              style={{ width: `${percent}%`, background: STATUS_META[status].color }}
              title={`${STATUS_META[status].label}: ${count} (${Math.round(percent)}%)`}
            />
          );
        })}
      </div>
      <div className="status-chart-legend">
        {STATUS_ORDER.map((status) => {
          const count = counts[status] ?? 0;
          const percent = Math.round((count / total) * 100);
          return (
            <div key={status} className="status-chart-legend-item">
              <span className="status-chart-dot" style={{ background: STATUS_META[status].color }} />
              {STATUS_META[status].label} <strong>{count}</strong>
              <span className="muted small">({percent}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
