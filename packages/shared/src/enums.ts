// Platform-wide enums, shared verbatim between the NestJS backend (Prisma
// schema + validation) and the React frontend so the two never drift apart.
// Convention: every Prisma enum in backend/prisma/schema.prisma gets a
// hand-written mirror here — no codegen, keep both in sync manually.

export const StaffRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SALES: 'SALES',
  ACCOUNT_MANAGER: 'ACCOUNT_MANAGER',
  OPERATIONS: 'OPERATIONS',
  TRAINING: 'TRAINING',
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

// The 10 SOP phases every school moves through, in order. See
// backend/src/schools/schools.service.ts's advancePhase() for the
// sequential-only guard ("no step skipped or reordered" per the SOP).
export const SchoolLifecyclePhase = {
  SALES_HANDOVER: 'SALES_HANDOVER',
  WELCOME: 'WELCOME',
  ORIENTATION: 'ORIENTATION',
  ONBOARDING_SETUP: 'ONBOARDING_SETUP',
  DATA_COLLECTION_LMS: 'DATA_COLLECTION_LMS',
  INFRA_DIAGNOSTIC: 'INFRA_DIAGNOSTIC',
  TEACHER_TRAINING: 'TEACHER_TRAINING',
  ONGOING_ENGAGEMENT: 'ONGOING_ENGAGEMENT',
  COMPETITIONS: 'COMPETITIONS',
  ANNUAL_RENEWAL: 'ANNUAL_RENEWAL',
} as const;
export type SchoolLifecyclePhase =
  (typeof SchoolLifecyclePhase)[keyof typeof SchoolLifecyclePhase];

// Ordered list backing the sequential-advance guard — index order IS the
// SOP order, do not resort alphabetically.
export const SCHOOL_LIFECYCLE_PHASE_ORDER: SchoolLifecyclePhase[] = [
  SchoolLifecyclePhase.SALES_HANDOVER,
  SchoolLifecyclePhase.WELCOME,
  SchoolLifecyclePhase.ORIENTATION,
  SchoolLifecyclePhase.ONBOARDING_SETUP,
  SchoolLifecyclePhase.DATA_COLLECTION_LMS,
  SchoolLifecyclePhase.INFRA_DIAGNOSTIC,
  SchoolLifecyclePhase.TEACHER_TRAINING,
  SchoolLifecyclePhase.ONGOING_ENGAGEMENT,
  SchoolLifecyclePhase.COMPETITIONS,
  SchoolLifecyclePhase.ANNUAL_RENEWAL,
];

export const TrainingMode = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
} as const;
export type TrainingMode = (typeof TrainingMode)[keyof typeof TrainingMode];

export const SchoolStatus = {
  ACTIVE: 'ACTIVE',
  RENEWED: 'RENEWED',
  CHURNED: 'CHURNED',
} as const;
export type SchoolStatus = (typeof SchoolStatus)[keyof typeof SchoolStatus];

export const PhaseTaskStatus = {
  PENDING: 'PENDING',
  DONE: 'DONE',
  NA: 'NA',
} as const;
export type PhaseTaskStatus = (typeof PhaseTaskStatus)[keyof typeof PhaseTaskStatus];

export const WorkshopStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
} as const;
export type WorkshopStatus = (typeof WorkshopStatus)[keyof typeof WorkshopStatus];

export const EngagementType = {
  MONTHLY_VISIT: 'MONTHLY_VISIT',
  WEEKLY_CALL: 'WEEKLY_CALL',
} as const;
export type EngagementType = (typeof EngagementType)[keyof typeof EngagementType];

export const CompetitionType = {
  INTERNAL: 'INTERNAL',
  EXTERNAL: 'EXTERNAL',
} as const;
export type CompetitionType = (typeof CompetitionType)[keyof typeof CompetitionType];

export const RenewalStatus = {
  PENDING: 'PENDING',
  APPROACHED: 'APPROACHED',
  AGREED: 'AGREED',
  DECLINED: 'DECLINED',
  SIGNED: 'SIGNED',
} as const;
export type RenewalStatus = (typeof RenewalStatus)[keyof typeof RenewalStatus];

export const EmailStatus = {
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;
export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];

// Which scanner produced an AgentSuggestion — see backend/src/ai/agents/.
// Adding a new agent later is just a new value here plus a new scanner
// writing into the same AgentSuggestion table.
export const AgentKey = {
  ENGAGEMENT: 'ENGAGEMENT',
  RENEWAL: 'RENEWAL',
  // Fully autonomous agents (see backend/src/ai/agents/) — no human
  // approval step, since these are mechanical/administrative, not
  // relationship-tone content. Every action they take still gets logged as
  // an AgentSuggestion with status AUTO_SENT for visibility.
  WORKSHOP_REMINDER: 'WORKSHOP_REMINDER',
  RENEWAL_CYCLE_OPENER: 'RENEWAL_CYCLE_OPENER',
} as const;
export type AgentKey = (typeof AgentKey)[keyof typeof AgentKey];

export const SuggestionType = {
  FOLLOWUP_EMAIL: 'FOLLOWUP_EMAIL',
  RENEWAL_PITCH: 'RENEWAL_PITCH',
  WORKSHOP_REMINDER_SENT: 'WORKSHOP_REMINDER_SENT',
  RENEWAL_CYCLE_OPENED: 'RENEWAL_CYCLE_OPENED',
} as const;
export type SuggestionType = (typeof SuggestionType)[keyof typeof SuggestionType];

export const SuggestionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SENT: 'SENT',
  // A fully autonomous agent already took this action — nothing for a
  // human to approve, this row exists purely as an audit trail.
  AUTO_SENT: 'AUTO_SENT',
} as const;
export type SuggestionStatus = (typeof SuggestionStatus)[keyof typeof SuggestionStatus];
