import { SCHOOL_LIFECYCLE_PHASE_LABELS, SCHOOL_LIFECYCLE_PHASE_ORDER, SchoolLifecyclePhase } from '@b2b-ops/shared';

// Single source of truth for how phases are labeled/ordered/colored across
// the dashboard, schools list, and school detail header — so "phase 4 of
// 10" and its color always mean the same thing everywhere.
export const PHASE_LABELS: Record<SchoolLifecyclePhase, string> = SCHOOL_LIFECYCLE_PHASE_LABELS;

export const PHASE_ORDER: SchoolLifecyclePhase[] = SCHOOL_LIFECYCLE_PHASE_ORDER;

export function phaseIndex(phase: SchoolLifecyclePhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function phaseProgressPercent(phase: SchoolLifecyclePhase): number {
  return Math.round(((phaseIndex(phase) + 1) / PHASE_ORDER.length) * 100);
}
