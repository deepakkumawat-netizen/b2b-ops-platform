import { useState } from 'react';
import { SchoolLifecyclePhase } from '@b2b-ops/shared';
import { PHASE_LABELS, PHASE_ORDER } from '../lib/phases';

// Ordered by SOP sequence (not sorted by count) — this is a funnel, and the
// row order carries as much meaning as the bar length.
export function PhaseDistributionChart({ counts }: { counts: Record<string, number> }) {
  const [hovered, setHovered] = useState<SchoolLifecyclePhase | null>(null);
  const max = Math.max(1, ...PHASE_ORDER.map((p) => counts[p] ?? 0));

  return (
    <ul className="phase-chart">
      {PHASE_ORDER.map((phase) => {
        const count = counts[phase] ?? 0;
        const percent = (count / max) * 100;
        const isHovered = hovered === phase;
        return (
          <li
            key={phase}
            className="phase-chart-row"
            onMouseEnter={() => setHovered(phase)}
            onMouseLeave={() => setHovered((h) => (h === phase ? null : h))}
            onFocus={() => setHovered(phase)}
            onBlur={() => setHovered((h) => (h === phase ? null : h))}
            tabIndex={0}
          >
            <span className="phase-chart-label">{PHASE_LABELS[phase]}</span>
            <span className="phase-chart-track">
              <span className={`phase-chart-fill${isHovered ? ' is-hovered' : ''}`} style={{ width: `${percent}%` }} />
            </span>
            <span className="phase-chart-value">{count}</span>
            {isHovered && (
              <div className="chart-tooltip" role="tooltip">
                <strong>{count}</strong> school{count === 1 ? '' : 's'} · {PHASE_LABELS[phase]}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
