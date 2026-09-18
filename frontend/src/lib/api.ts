import { useSyncExternalStore } from 'react';
import {
  AgentKey,
  CompetitionType,
  EngagementType,
  PhaseTaskStatus,
  RenewalStatus,
  SchoolLifecyclePhase,
  SchoolStatus,
  StaffRole,
  SuggestionStatus,
  SuggestionType,
  TrainingMode,
  WorkshopStatus,
} from '@b2b-ops/shared';

// Tiny pub-sub so React re-renders on login/logout without a full page
// reload — a plain localStorage.getItem read in JSX only runs once at
// mount, useSyncExternalStore is what makes RequireAuth notice a token
// appearing/disappearing.
function createTokenStore(storageKey: string) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  return {
    get: () => localStorage.getItem(storageKey),
    set: (t: string) => {
      localStorage.setItem(storageKey, t);
      notify();
    },
    clear: () => {
      localStorage.removeItem(storageKey);
      notify();
    },
    subscribe: (onChange: () => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const STAFF_TOKEN_KEY = 'b2bops_staff_token';
const STAFF_USER_KEY = 'b2bops_staff_user';

export const staffToken = createTokenStore(STAFF_TOKEN_KEY);
export function useStaffToken() {
  return useSyncExternalStore(staffToken.subscribe, staffToken.get);
}

export type StaffUser = { id: string; email: string; name: string; role: StaffRole };
export const staffUser = {
  get: (): StaffUser | null => {
    const raw = localStorage.getItem(STAFF_USER_KEY);
    return raw ? (JSON.parse(raw) as StaffUser) : null;
  },
  set: (u: StaffUser) => localStorage.setItem(STAFF_USER_KEY, JSON.stringify(u)),
  clear: () => localStorage.removeItem(STAFF_USER_KEY),
};

async function request<T>(path: string, opts: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Domain types (mirror backend Prisma shapes closely enough for display) ─

export type School = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  ownerName: string | null;
  ownerDesignation: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  productProgram: string | null;
  gradeFrom: string | null;
  gradeTo: string | null;
  workshopsCommitted: number | null;
  trainingMode: TrainingMode | null;
  specialCommitments: string | null;
  totalStudents: number | null;
  currentPhase: SchoolLifecyclePhase;
  status: SchoolStatus;
  assignedAccountManagerId: string | null;
  assignedAccountManager: { id: string; name: string } | null;
  assignedSalesRepId: string | null;
  assignedSalesRep: { id: string; name: string } | null;
  createdAt: string;
};

export type SchoolPhaseTask = {
  id: string;
  status: PhaseTaskStatus;
  notes: string | null;
  completedAt: string | null;
  completedByStaff: { id: string; name: string } | null;
  template: { key: string; label: string; phase: SchoolLifecyclePhase; ownerRole: StaffRole | null; sortOrder: number };
};

export type Teacher = {
  id: string;
  name: string;
  phone: string | null;
  designation: string | null;
  gradeAssigned: string | null;
  lmsCredentialGenerated: boolean;
};

export type InfraDiagnostic = {
  labCapacity: string | null;
  internetConnectivity: string | null;
  systemsPerStudent: string | null;
  recommendedSessionMix: string | null;
} | null;

export type Workshop = {
  id: string;
  schoolId: string;
  topic: string;
  targetGrades: string | null;
  scheduledAt: string;
  status: WorkshopStatus;
  confirmationSentAt: string | null;
  reminderSentAt: string | null;
  completedAt: string | null;
  feedbackReceivedAt: string | null;
  feedbackSummary: string | null;
  cancelReason: string | null;
};

export type EngagementLog = {
  id: string;
  type: EngagementType;
  date: string;
  summary: string | null;
  issuesRaised: string | null;
  conductedByStaff: { id: string; name: string } | null;
};

export type CompetitionParticipation = {
  id: string;
  name: string;
  type: CompetitionType;
  date: string;
  studentsParticipated: number | null;
  certificatesIssued: boolean;
  prizesAwarded: string | null;
  teacherCertified: boolean;
};

export type RenewalCycle = {
  id: string;
  schoolId: string;
  cycleLabel: string;
  feedbackCallDate: string | null;
  feedbackSummary: string | null;
  renewalStatus: RenewalStatus;
  agreementSignedAt: string | null;
};

export type YearSummary = {
  workshopsCompleted: number;
  workshopsTotal: number;
  competitionsCount: number;
  certificatesIssuedCount: number;
  monthlyVisitsCount: number;
  weeklyCallsCount: number;
};

export type Dashboard = {
  totalSchools: number;
  schoolsByPhase: Record<string, number>;
  overdueVisits: { schoolId: string; name: string; lastVisitDate: string | null }[];
  overdueCalls: { schoolId: string; name: string; lastCallDate: string | null }[];
  upcomingWorkshops: (Workshop & { school: { name: string } })[];
  pendingRenewals: (RenewalCycle & { school: { name: string } })[];
  pendingAgentSuggestions: number;
};

export type AgentSuggestion = {
  id: string;
  schoolId: string;
  school: { id: string; name: string };
  agentKey: AgentKey;
  suggestionType: SuggestionType;
  draftSubject: string;
  draftBody: string;
  reasoning: string;
  status: SuggestionStatus;
  reviewedAt: string | null;
  createdAt: string;
};

export const api = {
  staffLogin: (email: string, password: string) =>
    request<{ accessToken: string; staff: StaffUser }>('/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  listSchools: (token: string) => request<School[]>('/schools', { token }),
  getSchool: (id: string, token: string) => request<School>(`/schools/${id}`, { token }),
  createSchool: (dto: Partial<School>, token: string) =>
    request<School>('/schools', { method: 'POST', body: JSON.stringify(dto), token }),
  updateSchool: (id: string, dto: Partial<School>, token: string) =>
    request<School>(`/schools/${id}`, { method: 'PATCH', body: JSON.stringify(dto), token }),
  advanceSchoolPhase: (id: string, token: string) =>
    request<{ school: School; warning: string | null }>(`/schools/${id}/advance-phase`, { method: 'POST', token }),

  listPhaseTasks: (schoolId: string, token: string) =>
    request<SchoolPhaseTask[]>(`/schools/${schoolId}/phase-tasks`, { token }),
  updatePhaseTask: (schoolId: string, taskId: string, dto: { status: PhaseTaskStatus; notes?: string }, token: string) =>
    request<SchoolPhaseTask>(`/schools/${schoolId}/phase-tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      token,
    }),

  listTeachers: (schoolId: string, token: string) => request<Teacher[]>(`/schools/${schoolId}/teachers`, { token }),
  createTeacher: (schoolId: string, dto: Partial<Teacher>, token: string) =>
    request<Teacher>(`/schools/${schoolId}/teachers`, { method: 'POST', body: JSON.stringify(dto), token }),
  updateTeacher: (schoolId: string, teacherId: string, dto: Partial<Teacher>, token: string) =>
    request<Teacher>(`/schools/${schoolId}/teachers/${teacherId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      token,
    }),
  deleteTeacher: (schoolId: string, teacherId: string, token: string) =>
    request<{ success: boolean }>(`/schools/${schoolId}/teachers/${teacherId}`, { method: 'DELETE', token }),

  getInfraDiagnostic: (schoolId: string, token: string) =>
    request<InfraDiagnostic>(`/schools/${schoolId}/infra-diagnostic`, { token }),
  upsertInfraDiagnostic: (schoolId: string, dto: NonNullable<InfraDiagnostic>, token: string) =>
    request<InfraDiagnostic>(`/schools/${schoolId}/infra-diagnostic`, {
      method: 'PUT',
      body: JSON.stringify(dto),
      token,
    }),

  listWorkshops: (schoolId: string, token: string) => request<Workshop[]>(`/schools/${schoolId}/workshops`, { token }),
  createWorkshop: (schoolId: string, dto: { topic: string; targetGrades?: string; scheduledAt: string }, token: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops`, { method: 'POST', body: JSON.stringify(dto), token }),
  confirmWorkshop: (schoolId: string, workshopId: string, token: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/confirm`, { method: 'POST', token }),
  remindWorkshop: (schoolId: string, workshopId: string, token: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/remind`, { method: 'POST', token }),
  completeWorkshop: (schoolId: string, workshopId: string, token: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/complete`, { method: 'POST', token }),
  cancelWorkshop: (schoolId: string, workshopId: string, cancelReason: string, token: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelReason }),
      token,
    }),
  recordWorkshopFeedback: (schoolId: string, workshopId: string, feedbackSummary: string, token: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ feedbackSummary }),
      token,
    }),

  listEngagementLogs: (schoolId: string, token: string) =>
    request<EngagementLog[]>(`/schools/${schoolId}/engagement-logs`, { token }),
  createEngagementLog: (
    schoolId: string,
    dto: { type: EngagementType; date: string; summary?: string; issuesRaised?: string },
    token: string,
  ) => request<EngagementLog>(`/schools/${schoolId}/engagement-logs`, { method: 'POST', body: JSON.stringify(dto), token }),

  listCompetitions: (schoolId: string, token: string) =>
    request<CompetitionParticipation[]>(`/schools/${schoolId}/competitions`, { token }),
  createCompetition: (schoolId: string, dto: Partial<CompetitionParticipation>, token: string) =>
    request<CompetitionParticipation>(`/schools/${schoolId}/competitions`, {
      method: 'POST',
      body: JSON.stringify(dto),
      token,
    }),

  listRenewals: (schoolId: string, token: string) => request<RenewalCycle[]>(`/schools/${schoolId}/renewals`, { token }),
  createRenewal: (schoolId: string, cycleLabel: string, token: string) =>
    request<RenewalCycle>(`/schools/${schoolId}/renewals`, { method: 'POST', body: JSON.stringify({ cycleLabel }), token }),
  updateRenewal: (schoolId: string, cycleId: string, dto: Partial<RenewalCycle>, token: string) =>
    request<RenewalCycle>(`/schools/${schoolId}/renewals/${cycleId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      token,
    }),
  getRenewalYearSummary: (schoolId: string, token: string) =>
    request<YearSummary>(`/schools/${schoolId}/renewals/year-summary`, { token }),

  getDashboard: (token: string) => request<Dashboard>('/dashboard', { token }),

  listAgentSuggestions: (token: string) => request<AgentSuggestion[]>('/agent-suggestions', { token }),
  updateAgentSuggestion: (id: string, dto: { draftSubject?: string; draftBody?: string }, token: string) =>
    request<AgentSuggestion>(`/agent-suggestions/${id}`, { method: 'PATCH', body: JSON.stringify(dto), token }),
  approveAgentSuggestion: (id: string, token: string) =>
    request<AgentSuggestion>(`/agent-suggestions/${id}/approve`, { method: 'POST', token }),
  rejectAgentSuggestion: (id: string, token: string) =>
    request<AgentSuggestion>(`/agent-suggestions/${id}/reject`, { method: 'POST', token }),
  runAgentsNow: (token: string) =>
    request<{ engagement: number; renewal: number; workshopReminder: number; renewalCycleOpener: number }>(
      '/agent-suggestions/run',
      { method: 'POST', token },
    ),
};
