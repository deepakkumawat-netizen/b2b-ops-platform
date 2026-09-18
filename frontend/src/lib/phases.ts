import { SCHOOL_LIFECYCLE_PHASE_ORDER, SchoolLifecyclePhase } from '@b2b-ops/shared';

// Single source of truth for how phases are labeled/ordered/colored across
// the dashboard, schools list, and school detail header — so "phase 4 of
// 10" and its color always mean the same thing everywhere.
export const PHASE_LABELS: Record<SchoolLifecyclePhase, string> = {
  SALES_HANDOVER: 'Sales Handover',
  WELCOME: 'Welcome',
  ORIENTATION: 'Orientation',
  ONBOARDING_SETUP: 'Onboarding Setup',
  DATA_COLLECTION_LMS: 'Data Collection & LMS',
  INFRA_DIAGNOSTIC: 'Infra Diagnostic',
  TEACHER_TRAINING: 'Teacher Training',
  ONGOING_ENGAGEMENT: 'Ongoing Engagement',
  COMPETITIONS: 'Competitions',
  ANNUAL_RENEWAL: 'Annual Renewal',
};

export const PHASE_ORDER: SchoolLifecyclePhase[] = SCHOOL_LIFECYCLE_PHASE_ORDER;

export function phaseIndex(phase: SchoolLifecyclePhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function phaseProgressPercent(phase: SchoolLifecyclePhase): number {
  return Math.round(((phaseIndex(phase) + 1) / PHASE_ORDER.length) * 100);
}
