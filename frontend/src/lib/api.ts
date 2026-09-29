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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const STAFF_USER_KEY = 'b2bops_staff_user';
// Pre-cookie builds kept the JWT itself here — clear it so it doesn't linger.
const LEGACY_TOKEN_KEY = 'b2bops_staff_token';

export type StaffUser = { id: string; email: string; name: string; role: StaffRole };

// The session itself is an httpOnly cookie the browser sends automatically —
// page JavaScript can never read it (that's the point: an XSS bug can't
// steal it). What's kept here is only the signed-in user's public profile,
// so the UI knows who's signed in and can re-render on login/logout; it
// grants no access by itself. useSyncExternalStore is what makes
// RequireAuth notice it appearing/disappearing.
function createSessionStore() {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  let cachedRaw: string | null | undefined;
  let cachedUser: StaffUser | null = null;
  const read = (): string | null => {
    try {
      return localStorage.getItem(STAFF_USER_KEY);
    } catch {
      return null;
    }
  };
  return {
    // Returns the same object while the stored JSON is unchanged, as
    // useSyncExternalStore requires.
    get: (): StaffUser | null => {
      const raw = read();
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        try {
          cachedUser = raw ? (JSON.parse(raw) as StaffUser) : null;
        } catch {
          cachedUser = null;
        }
      }
      return cachedUser;
    },
    set: (u: StaffUser) => {
      localStorage.setItem(STAFF_USER_KEY, JSON.stringify(u));
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      notify();
    },
    clear: () => {
      localStorage.removeItem(STAFF_USER_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      notify();
    },
    subscribe: (onChange: () => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}

export const staffSession = createSessionStore();
export function useStaffUser() {
  return useSyncExternalStore(staffSession.subscribe, staffSession.get);
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const { headers, ...rest } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    // Sends the httpOnly session cookie. 'include' rather than 'same-origin'
    // so a VITE_API_BASE_URL pointing at another origin still works.
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && staffSession.get() && !path.startsWith('/auth/')) {
      // Stale/expired/invalidated session — drop it so RequireAuth redirects
      // to /login instead of leaving every page stuck showing "Unauthorized".
      staffSession.clear();
      throw new Error('Your session has expired. Please sign in again.');
    }
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  // Nest sends a zero-byte body (not JSON "null") when a handler returns
  // null/undefined — e.g. GET infra-diagnostic for a school that hasn't
  // submitted one yet. res.json() throws on that empty body, so read as
  // text first and only parse when there's something there.
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

// ── Domain types (mirror backend Prisma shapes closely enough for display) ─

export type School = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
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
  orientationPreferredDate: string | null;
  orientationNote: string | null;
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

export type Student = {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
  lmsCredentialGenerated: boolean;
};

export type StudentFormRow = { name: string; grade: string; section: string };

export type SchoolDetailsInfo = {
  schoolName: string;
  teachersOnFile: number;
  studentsOnFile: number;
  hasLogo: boolean;
  infra: { labCapacity: string | null; internetConnectivity: string | null; systemsPerStudent: string | null } | null;
  orientation: { date: string; note: string | null } | null;
  partsDone: number;
  partsTotal: number;
};

export type InfraDiagnostic = {
  labCapacity: string | null;
  internetConnectivity: string | null;
  systemsPerStudent: string | null;
  recommendedSessionMix: string | null;
} | null;

export type SchoolAssetKind = 'LOGO' | 'COBRANDED_LOGO';

/** Image URL for <img src> — the session cookie authenticates it; `version`
 * (the upload time) busts the browser cache after a new upload. */
export const schoolAssetUrl = (schoolId: string, kind: SchoolAssetKind, version: string) =>
  `${API_BASE}/schools/${schoolId}/onboarding/assets/${kind}?v=${encodeURIComponent(version)}`;

export type OnboardingOverview = {
  schoolName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  accountManagerName: string | null;
  whatsappGroupLink: string | null;
  ownerInvite: { sentAt: string; recipient: string } | null;
  teachers: Array<{ id: string; name: string; phone: string | null; designation: string | null; whatsappInvitedAt: string | null }>;
  logoUpdatedAt: string | null;
  cobrandedLogoUpdatedAt: string | null;
  welcomeMessage: string;
  tasks: Record<string, { status: PhaseTaskStatus; completedAt: string | null }>;
};

export type TeacherFormRow = { name: string; phone: string; designation: string; gradeAssigned: string };

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
  feedbackFormSentAt: string | null;
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
  school: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    ownerName: string | null;
    ownerDesignation: string | null;
    ownerEmail: string | null;
    productProgram: string | null;
    currentPhase: SchoolLifecyclePhase;
    assignedAccountManager: { name: string } | null;
  };
  agentKey: AgentKey;
  suggestionType: SuggestionType;
  draftSubject: string;
  draftBody: string;
  reasoning: string;
  status: SuggestionStatus;
  reviewedAt: string | null;
  createdAt: string;
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  approvedAt: string | null;
  createdAt: string;
};

export type ActivityEntry = {
  id: string;
  at: string;
  kind: 'ACTION' | 'EMAIL' | 'AGENT' | 'ENGAGEMENT';
  title: string;
  detail: string | null;
  actor: string | null;
};

export type RenewalReportRow = RenewalCycle & {
  createdAt: string;
  school: { id: string; name: string; city: string | null; state: string | null; assignedAccountManager: { name: string } | null };
};

export type AgentName =
  | 'checklist'
  | 'engagement'
  | 'renewal'
  | 'workshopReminder'
  | 'renewalCycleOpener'
  | 'workshopFeedbackNag'
  | 'stalePhase'
  | 'renewalStalled'
  | 'competitionFollowup'
  | 'dataCompleteness'
  | 'schoolDetailsReminder';
export type AgentRunResult = Record<AgentName, number> & { errors: Partial<Record<AgentName, string>> };

export const api = {
  staffLogin: (email: string, password: string) =>
    request<{ staff: StaffUser }>('/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  staffSignup: (dto: { name: string; email: string; password: string; role: StaffRole }) =>
    request<{ pending: true; staff: StaffUser }>('/auth/staff/signup', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  staffLogout: () => request<{ success: boolean }>('/auth/staff/logout', { method: 'POST' }),

  listStaff: () => request<StaffMember[]>('/staff'),
  updateStaff: (id: string, dto: { role?: StaffRole; isActive?: boolean }) =>
    request<StaffMember>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  rejectPendingStaff: (id: string) => request<{ success: boolean }>(`/staff/${id}`, { method: 'DELETE' }),
  listAccountManagers: () => request<{ id: string; name: string }[]>('/staff/account-managers'),

  listSchoolActivity: (schoolId: string) => request<ActivityEntry[]>(`/schools/${schoolId}/activity`),
  getRenewalsReport: () => request<RenewalReportRow[]>('/reports/renewals'),

  listSchools: () => request<School[]>('/schools'),
  getSchool: (id: string) => request<School>(`/schools/${id}`),
  createSchool: (dto: Partial<School>) =>
    request<School>('/schools', { method: 'POST', body: JSON.stringify(dto) }),
  updateSchool: (id: string, dto: Partial<School>) =>
    request<School>(`/schools/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  advanceSchoolPhase: (id: string) =>
    request<{ school: School; warning: string | null }>(`/schools/${id}/advance-phase`, { method: 'POST' }),

  listPhaseTasks: (schoolId: string) =>
    request<SchoolPhaseTask[]>(`/schools/${schoolId}/phase-tasks`),
  updatePhaseTask: (schoolId: string, taskId: string, dto: { status: PhaseTaskStatus; notes?: string }) =>
    // emailSent is only present for tasks that send an email (the welcome email).
    request<SchoolPhaseTask & { emailSent?: boolean }>(`/schools/${schoolId}/phase-tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  listStates: (countryCode: string) =>
    request<Array<{ isoCode: string; name: string }>>(`/geo/states/${encodeURIComponent(countryCode)}`),
  listCities: (countryCode: string, stateCode: string) =>
    request<string[]>(`/geo/cities/${encodeURIComponent(countryCode)}/${encodeURIComponent(stateCode)}`),

  // Onboarding Setup (WhatsApp group + logos).
  getOnboarding: (schoolId: string) => request<OnboardingOverview>(`/schools/${schoolId}/onboarding`),
  setWhatsappLink: (schoolId: string, link: string) =>
    request<{ saved: boolean; inviteSent: boolean | null }>(`/schools/${schoolId}/onboarding/whatsapp-link`, { method: 'PUT', body: JSON.stringify({ link }) }),
  emailWhatsappInvite: (schoolId: string) =>
    request<{ sent: boolean }>(`/schools/${schoolId}/onboarding/whatsapp-invite/owner`, { method: 'POST' }),
  markTeacherWhatsappInvited: (schoolId: string, teacherId: string) =>
    request<{ success: boolean }>(`/schools/${schoolId}/onboarding/whatsapp-invite/teachers/${teacherId}`, { method: 'POST' }),
  uploadSchoolAsset: (schoolId: string, kind: SchoolAssetKind, dataUrl: string) =>
    request<{ success: boolean }>(`/schools/${schoolId}/onboarding/assets/${kind}`, { method: 'PUT', body: JSON.stringify({ dataUrl }) }),
  markWelcomeShared: (schoolId: string) =>
    request<{ success: boolean }>(`/schools/${schoolId}/onboarding/welcome-shared`, { method: 'POST' }),

  listStudents: (schoolId: string) => request<Student[]>(`/schools/${schoolId}/students`),
  setStudentLms: (schoolId: string, studentId: string, lmsCredentialGenerated: boolean) =>
    request<{ success: boolean }>(`/schools/${schoolId}/students/${studentId}`, { method: 'PATCH', body: JSON.stringify({ lmsCredentialGenerated }) }),
  markAllStudentsLms: (schoolId: string) =>
    request<{ updated: number }>(`/schools/${schoolId}/students/lms-credentials-generated`, { method: 'POST' }),
  deleteStudent: (schoolId: string, studentId: string) =>
    request<{ success: boolean }>(`/schools/${schoolId}/students/${studentId}`, { method: 'DELETE' }),

  listTeachers: (schoolId: string) => request<Teacher[]>(`/schools/${schoolId}/teachers`),
  getSchoolFormLink: (schoolId: string) => request<{ url: string }>(`/schools/${schoolId}/teachers/form-link`),
  requestTeacherDetails: (schoolId: string) =>
    request<{ sent: boolean }>(`/schools/${schoolId}/teachers/request-details`, { method: 'POST' }),

  // Public teacher-details form (no login — the school opens it from the emailed link).
  getTeacherForm: (schoolId: string, token: string) =>
    request<SchoolDetailsInfo>(`/public/teacher-form/${schoolId}/${token}`),
  submitStudentsForm: (schoolId: string, token: string, students: StudentFormRow[]) =>
    request<{ added: number }>(`/public/teacher-form/${schoolId}/${token}/students`, { method: 'POST', body: JSON.stringify({ students }) }),
  saveSchoolFormInfra: (schoolId: string, token: string, dto: { labCapacity: string; internetConnectivity: string; systemsPerStudent: string }) =>
    request<{ success: boolean }>(`/public/teacher-form/${schoolId}/${token}/infra`, { method: 'PUT', body: JSON.stringify(dto) }),
  saveSchoolFormOrientation: (schoolId: string, token: string, dto: { date: string; note: string }) =>
    request<{ success: boolean }>(`/public/teacher-form/${schoolId}/${token}/orientation`, { method: 'PUT', body: JSON.stringify(dto) }),
  uploadTeacherFormLogo: (schoolId: string, token: string, logo: string, cobranded?: string) =>
    request<{ success: boolean }>(`/public/teacher-form/${schoolId}/${token}/logo`, { method: 'POST', body: JSON.stringify({ logo, cobranded }) }),
  submitTeacherForm: (schoolId: string, token: string, teachers: TeacherFormRow[]) =>
    request<{ added: number }>(`/public/teacher-form/${schoolId}/${token}`, { method: 'POST', body: JSON.stringify({ teachers }) }),
  createTeacher: (schoolId: string, dto: Partial<Teacher>) =>
    request<Teacher>(`/schools/${schoolId}/teachers`, { method: 'POST', body: JSON.stringify(dto) }),
  updateTeacher: (schoolId: string, teacherId: string, dto: Partial<Teacher>) =>
    request<Teacher>(`/schools/${schoolId}/teachers/${teacherId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  deleteTeacher: (schoolId: string, teacherId: string) =>
    request<{ success: boolean }>(`/schools/${schoolId}/teachers/${teacherId}`, { method: 'DELETE' }),

  getInfraDiagnostic: (schoolId: string) =>
    request<InfraDiagnostic>(`/schools/${schoolId}/infra-diagnostic`),
  upsertInfraDiagnostic: (schoolId: string, dto: NonNullable<InfraDiagnostic>) =>
    request<InfraDiagnostic>(`/schools/${schoolId}/infra-diagnostic`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),

  listWorkshops: (schoolId: string) => request<Workshop[]>(`/schools/${schoolId}/workshops`),
  createWorkshop: (schoolId: string, dto: { topic: string; targetGrades?: string; scheduledAt: string }) =>
    request<Workshop>(`/schools/${schoolId}/workshops`, { method: 'POST', body: JSON.stringify(dto) }),
  confirmWorkshop: (schoolId: string, workshopId: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/confirm`, { method: 'POST' }),
  remindWorkshop: (schoolId: string, workshopId: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/remind`, { method: 'POST' }),
  completeWorkshop: (schoolId: string, workshopId: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/complete`, { method: 'POST' }),
  cancelWorkshop: (schoolId: string, workshopId: string, cancelReason: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelReason }),
    }),
  recordWorkshopFeedback: (schoolId: string, workshopId: string, feedbackSummary: string) =>
    request<Workshop>(`/schools/${schoolId}/workshops/${workshopId}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ feedbackSummary }),
    }),

  listEngagementLogs: (schoolId: string) =>
    request<EngagementLog[]>(`/schools/${schoolId}/engagement-logs`),
  createEngagementLog: (
    schoolId: string,
    dto: { type: EngagementType; date: string; summary?: string; issuesRaised?: string },
  ) => request<EngagementLog>(`/schools/${schoolId}/engagement-logs`, { method: 'POST', body: JSON.stringify(dto) }),

  listCompetitions: (schoolId: string) =>
    request<CompetitionParticipation[]>(`/schools/${schoolId}/competitions`),
  createCompetition: (schoolId: string, dto: Partial<CompetitionParticipation>) =>
    request<CompetitionParticipation>(`/schools/${schoolId}/competitions`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  listRenewals: (schoolId: string) => request<RenewalCycle[]>(`/schools/${schoolId}/renewals`),
  createRenewal: (schoolId: string, cycleLabel: string) =>
    request<RenewalCycle>(`/schools/${schoolId}/renewals`, { method: 'POST', body: JSON.stringify({ cycleLabel }) }),
  updateRenewal: (schoolId: string, cycleId: string, dto: Partial<RenewalCycle>) =>
    request<RenewalCycle>(`/schools/${schoolId}/renewals/${cycleId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  getRenewalYearSummary: (schoolId: string) =>
    request<YearSummary>(`/schools/${schoolId}/renewals/year-summary`),

  getDashboard: () => request<Dashboard>('/dashboard'),

  listAgentSuggestions: () => request<AgentSuggestion[]>('/agent-suggestions'),
  updateAgentSuggestion: (id: string, dto: { draftSubject?: string; draftBody?: string }) =>
    request<AgentSuggestion>(`/agent-suggestions/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  approveAgentSuggestion: (id: string) =>
    request<AgentSuggestion>(`/agent-suggestions/${id}/approve`, { method: 'POST' }),
  rejectAgentSuggestion: (id: string) =>
    request<AgentSuggestion>(`/agent-suggestions/${id}/reject`, { method: 'POST' }),
  runAgentsNow: () =>
    request<AgentRunResult>('/agent-suggestions/run', { method: 'POST' }),
};
