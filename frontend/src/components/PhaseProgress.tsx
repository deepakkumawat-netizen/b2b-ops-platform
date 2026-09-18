import { SchoolLifecyclePhase } from '@b2b-ops/shared';
import { PHASE_LABELS, PHASE_ORDER, phaseIndex, phaseProgressPercent } from '../lib/phases';

// Shared everywhere a school's SOP progress is shown (schools list, school
// detail header, dashboard) so "how far along is this school" always reads
// the same way instead of a bare enum badge.
export function PhaseProgress({ phase, compact = false }: { phase: SchoolLifecyclePhase; compact?: boolean }) {
  const index = phaseIndex(phase);
  const percent = phaseProgressPercent(phase);
  return (
    <div className={`phase-progress${compact ? ' compact' : ''}`}>
      <div className="phase-progress-track">
        <div className="phase-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="phase-progress-label">
        {!compact && `Phase ${index + 1} of ${PHASE_ORDER.length} · `}
        {PHASE_LABELS[phase]}
      </span>
    </div>
  );
}
