import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CompetitionType,
  EmailStatus,
  PhaseTaskStatus,
  RenewalStatus,
  SCHOOL_LIFECYCLE_PHASE_LABELS,
  SCHOOL_LIFECYCLE_PHASE_ORDER,
  StaffRole,
  WorkshopStatus,
} from '@b2b-ops/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { teacherFormUrl } from '../teacher-form/teacher-form-token';
import { SCHOOL_DETAILS_PARTS } from '../teacher-form/school-details';
import { formatDateInZone } from '../common/time';

// Same value as onboarding.service's WHATSAPP_INVITE_TEMPLATE_KEY — the
// owner's WhatsApp group invite email, proof the stakeholders were invited.
const WHATSAPP_INVITE_TEMPLATE_KEY = 'whatsapp_group_invite';

export const WELCOME_EMAIL_TASK_KEY = 'welcome_email';
const TEACHER_FORM_TASK_KEY = 'teacher_data_form_shared';
// Kept as 'teacher_details_request' (the page grew from the teacher form) so
// the reminder agent also counts emails sent before it did.
export const SCHOOL_DETAILS_REQUEST_TEMPLATE_KEY = 'teacher_details_request';
export const SCHOOL_DETAILS_REMINDER_TEMPLATE_KEY = 'school_details_reminder';

const SCHOOL_FOR_SYNC = {
  teachers: { select: { lmsCredentialGenerated: true, trainedAt: true, whatsappInvitedAt: true } },
  students: { select: { lmsCredentialGenerated: true } },
  assets: { select: { kind: true } },
  emailLogs: { where: { templateKey: WHATSAPP_INVITE_TEMPLATE_KEY, status: EmailStatus.SENT }, select: { id: true }, take: 1 },
  infraDiagnostic: { select: { recommendedSessionMix: true } },
  workshops: { select: { status: true } },
  competitions: { select: { type: true, certificatesIssued: true, prizesAwarded: true } },
  renewalCycles: { select: { renewalStatus: true, feedbackCallDate: true } },
  phaseTasks: { include: { template: { select: { key: true, phase: true, label: true } } } },
} satisfies Prisma.SchoolInclude;

type SchoolForSync = Prisma.SchoolGetPayload<{ include: typeof SCHOOL_FOR_SYNC }>;

const filled = (...values: unknown[]) => values.every((v) => v !== null && v !== undefined && String(v).trim() !== '');

// Checklist tasks the app can PROVE are done from data already recorded —
// each returns the evidence (shown as the task's note) or null. Everything
// not listed here (calls, sessions…) happens outside the app, so it's left
// for a person to tick: auto-ticking those would make the checklist and
// dashboard claim work that never happened. WhatsApp setup and logos are
// proven by what the Onboarding tab records (group link, invites, images).
const EVIDENCE: Record<string, (s: SchoolForSync) => string | null> = {
  handover_owner_details: (s) =>
    filled(s.ownerName, s.ownerDesignation, s.ownerEmail, s.ownerPhone) ? 'Owner name, designation, email and phone on file' : null,
  handover_product_program: (s) => (filled(s.productProgram, s.gradeFrom, s.gradeTo) ? 'Program and grade range on file' : null),
  handover_location: (s) => (filled(s.city, s.state) ? 'City and state on file' : null),
  handover_commitments: (s) =>
    filled(s.workshopsCommitted, s.trainingMode) ? 'Workshops committed and training mode on file' : null,
  whatsapp_group_created: (s) => (filled(s.whatsappGroupLink) ? 'WhatsApp group link saved' : null),
  whatsapp_stakeholders_added: (s) => {
    const invited = s.teachers.filter((t) => t.whatsappInvitedAt).length;
    return s.emailLogs.length > 0 && invited > 0 ? `Group invite emailed to the owner and sent to ${invited} teacher(s) on WhatsApp` : null;
  },
  school_logo_collected: (s) => (s.assets.some((a) => a.kind === 'LOGO') ? 'School logo uploaded' : null),
  cobranded_logo_designed: (s) => (s.assets.some((a) => a.kind === 'COBRANDED_LOGO') ? 'Co-branded logo created' : null),
  teacher_details_collected: (s) => (s.teachers.length > 0 ? `${s.teachers.length} teacher(s) recorded` : null),
  teacher_lms_credentials_generated: (s) =>
    s.teachers.length > 0 && s.teachers.every((t) => t.lmsCredentialGenerated) ? 'LMS credentials generated for every teacher' : null,
  student_data_collected: (s) => (s.students.length > 0 ? `${s.students.length} student(s) recorded` : null),
  student_lms_credentials_generated: (s) =>
    s.students.length > 0 && s.students.every((st) => st.lmsCredentialGenerated) ? 'LMS credentials generated for every student' : null,
  diagnostic_form_sent: (s) => (s.infraDiagnostic ? 'Infra diagnostic recorded' : null),
  session_mix_recommended: (s) => (filled(s.infraDiagnostic?.recommendedSessionMix) ? 'Session mix recorded on the diagnostic' : null),
  teacher_training_conducted: (s) =>
    s.teachers.length > 0 && s.teachers.every((t) => t.trainedAt) ? 'Every teacher marked trained' : null,
  workshops_scheduled: (s) => {
    const scheduled = s.workshops.filter((w) => w.status !== WorkshopStatus.CANCELLED).length;
    return s.workshopsCommitted && scheduled >= s.workshopsCommitted ? `${scheduled} of ${s.workshopsCommitted} committed workshops scheduled` : null;
  },
  internal_competitions_offered: (s) =>
    s.competitions.some((c) => c.type === CompetitionType.INTERNAL) ? 'Internal competition participation recorded' : null,
  external_competitions_informed: (s) =>
    s.competitions.some((c) => c.type === CompetitionType.EXTERNAL) ? 'External competition participation recorded' : null,
  certificates_prizes_distributed: (s) =>
    s.competitions.some((c) => c.certificatesIssued || filled(c.prizesAwarded)) ? 'Certificates/prizes recorded on a competition' : null,
  annual_feedback_call: (s) => (s.renewalCycles.some((r) => r.feedbackCallDate) ? 'Feedback call date recorded on a renewal cycle' : null),
  renewal_approached: (s) =>
    s.renewalCycles.some((r) => r.renewalStatus !== RenewalStatus.PENDING) ? 'Renewal cycle moved past Pending' : null,
  renewal_agreement_signed: (s) =>
    s.renewalCycles.some((r) => r.renewalStatus === RenewalStatus.SIGNED) ? 'Renewal cycle marked Signed' : null,
};

// The "checklist agent": sends the new-school emails on creation, ticks
// every task the data proves, and moves the school to the next phase once
// the current one is fully done — so nobody clicks through what the app
// already knows. Best-effort by design: every public method swallows its
// own errors, since it runs after the caller's real work (creating a
// school, adding a teacher…) has already succeeded and must never fail it.
@Injectable()
export class SchoolAutomationService {
  private readonly logger = new Logger(SchoolAutomationService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activity: ActivityService,
    private config: ConfigService,
  ) {}

  /** Resolves once the checklist is synced (DB only, so the new school's
   * page opens already ticked); the emails go out in the background —
   * waiting on the email provider would make "Create school" feel stuck.
   * The welcome task gets ticked when its email lands. */
  async onSchoolCreated(schoolId: string, actor: StaffJwtPayload) {
    await this.sync(schoolId);
    void this.sendCreationEmails(schoolId, actor);
  }

  /** Welcome email to the school (ticking its task, which may complete the
   * Welcome phase) + enrollment alert to admins. */
  async sendCreationEmails(schoolId: string, actor: StaffJwtPayload) {
    await this.safely('sendCreationEmails', schoolId, async () => {
      await Promise.all([
        this.sendWelcomeEmailAndTick(schoolId),
        this.sendTeacherDetailsRequest(schoolId),
        this.notifyAdminsOfEnrollment(schoolId, actor),
      ]);
      await this.syncChecklist(schoolId);
    });
  }

  /** An owner email added after creation (it was blank on the handover
   * form) — send the welcome email the school missed. Deliberately NOT part
   * of syncChecklist/the daily run, so existing schools are never emailed
   * just because this feature shipped. */
  async onOwnerEmailAdded(schoolId: string) {
    await this.safely('onOwnerEmailAdded', schoolId, async () => {
      const formPending = await this.prisma.schoolPhaseTask.count({
        where: { schoolId, status: PhaseTaskStatus.PENDING, template: { key: TEACHER_FORM_TASK_KEY } },
      });
      await Promise.all([this.sendWelcomeEmailAndTick(schoolId), formPending ? this.sendTeacherDetailsRequest(schoolId) : null]);
    });
  }

  /** Call after any change that could complete a task (school details,
   * teachers, infra, workshops, competitions, renewals, a manual tick). */
  async sync(schoolId: string) {
    await this.safely('sync', schoolId, () => this.syncChecklist(schoolId));
  }

  /** Daily safety net (AgentRunnerService) for anything that changed
   * without going through a hooked service. Returns tasks ticked + phases
   * advanced. Never sends email. */
  async scan(): Promise<number> {
    const schools = await this.prisma.school.findMany({ select: { id: true } });
    let changes = 0;
    for (const { id } of schools) {
      changes += (await this.safely('scan', id, () => this.syncChecklist(id))) ?? 0;
    }
    return changes;
  }

  /** The welcome email itself — also used when someone ticks the task by hand. */
  sendWelcomeEmail(school: { id: string; name: string; ownerName: string | null; ownerEmail: string | null; productProgram: string | null }) {
    return this.notifications.sendTemplateEmail({
      schoolId: school.id,
      recipient: school.ownerEmail,
      templateKey: 'welcome_email',
      subject: `Welcome to codevidhya, ${school.name}!`,
      body:
        `Dear ${school.ownerName ?? 'Team'},\n\n` +
        `Welcome aboard! This confirms our partnership for ${school.productProgram ?? 'your program'}. ` +
        `Your account manager will be your point of contact for everything ahead.\n\n` +
        `Looking forward to a great year together.\n\nTeam codevidhya`,
    });
  }

  /** Emails the school the link to its school details page — teachers,
   * students, logo, lab & internet, orientation date — and ticks "Teacher
   * details form shared" (SOP Phase 5) once sent. What the school fills in
   * lands in the tool and ticks its own tasks. Also behind the Teachers
   * tab's resend button. */
  async sendTeacherDetailsRequest(schoolId: string): Promise<boolean> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school?.ownerEmail) return false;
    const link = this.schoolDetailsLink(schoolId);
    const sent = await this.notifications.sendTemplateEmail({
      schoolId,
      recipient: school.ownerEmail,
      templateKey: SCHOOL_DETAILS_REQUEST_TEMPLATE_KEY,
      button: { label: 'Fill in school details', url: link },
      subject: `School details for ${school.name} — codevidhya onboarding`,
      body:
        `Dear ${school.ownerName ?? 'Team'},\n\n` +
        `To set up LMS access, training and workshops for ${school.name}, please fill in a few details ` +
        `on this one page — no login needed. Click the button below, or open this link:\n\n` +
        `${link}\n\n` +
        `The page has:\n` +
        SCHOOL_DETAILS_PARTS.map((p) => `• ${p.label}`).join('\n') +
        `\n\nYou can fill in any part now and the rest later — the same link keeps working. ` +
        `Teacher and student lists can be pasted straight from Excel or Google Sheets.\n\n` +
        `Team codevidhya`,
    });
    if (!sent) return false;
    const task = await this.prisma.schoolPhaseTask.findFirst({
      where: { schoolId, status: PhaseTaskStatus.PENDING, template: { key: TEACHER_FORM_TASK_KEY } },
    });
    if (task) {
      await this.prisma.schoolPhaseTask.update({
        where: { id: task.id },
        data: { status: PhaseTaskStatus.DONE, completedAt: new Date(), completedByStaffId: null, notes: `Form link emailed to ${school.ownerEmail}` },
      });
    }
    await this.activity.record(schoolId, null, 'Agent emailed the school details page link', `To ${school.ownerEmail}`);
    return true;
  }

  /** Reminder listing only the parts still empty (SchoolDetailsReminderAgent decides who). */
  async sendSchoolDetailsReminder(schoolId: string, missing: string[]): Promise<boolean> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, ownerName: true, ownerEmail: true } });
    if (!school?.ownerEmail || missing.length === 0) return false;
    const link = this.schoolDetailsLink(schoolId);
    const sent = await this.notifications.sendTemplateEmail({
      schoolId,
      recipient: school.ownerEmail,
      templateKey: SCHOOL_DETAILS_REMINDER_TEMPLATE_KEY,
      button: { label: 'Fill in school details', url: link },
      subject: `Reminder: a few details still needed for ${school.name}`,
      body:
        `Dear ${school.ownerName ?? 'Team'},\n\n` +
        `Thank you for everything shared so far! To finish setting up ${school.name}, we still need:\n` +
        missing.map((m) => `• ${m}`).join('\n') +
        `\n\nIt only takes a few minutes, on the same page as before:\n\n` +
        `${link}\n\n` +
        `Team codevidhya`,
    });
    if (sent) await this.activity.record(schoolId, null, 'Agent sent a school details reminder', `Still needed: ${missing.join(', ')}`);
    return sent;
  }

  /** Lets the account manager (or admins, if none) know to confirm the date. */
  async notifyOrientationDatePicked(schoolId: string) {
    await this.safely('notifyOrientationDatePicked', schoolId, async () => {
      const school = await this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, orientationPreferredDate: true, orientationNote: true, assignedAccountManager: { select: { email: true, name: true, isActive: true } } },
      });
      if (!school?.orientationPreferredDate) return;
      const manager = school.assignedAccountManager?.isActive ? school.assignedAccountManager : null;
      const recipients = manager ? [manager.email] : await this.adminAlertRecipients();
      const when = formatDateInZone(school.orientationPreferredDate);
      await Promise.all(
        recipients.map((recipient) =>
          this.notifications.sendTemplateEmail({
            schoolId,
            recipient,
            templateKey: 'orientation_date_picked',
            fromAccountManager: false,
            subject: `${school.name} picked ${when} for orientation`,
            body:
              `Hi ${manager?.name ?? 'team'},\n\n` +
              `${school.name} picked ${when} as its preferred date for the leadership orientation / teacher induction.` +
              (school.orientationNote ? `\nTheir note: "${school.orientationNote}"` : '') +
              `\n\nPlease confirm the session with the school, then tick it on the checklist once it's done.`,
          }),
        ),
      );
    });
  }

  /** The school's own details-page link (also shown to staff to open or share on WhatsApp). */
  schoolDetailsLink(schoolId: string) {
    return teacherFormUrl(this.config.get<string>('APP_URL') || 'http://localhost:5173', schoolId, this.config.getOrThrow<string>('JWT_ACCESS_SECRET'));
  }

  private async sendWelcomeEmailAndTick(schoolId: string) {
    const task = await this.prisma.schoolPhaseTask.findFirst({
      where: { schoolId, template: { key: WELCOME_EMAIL_TASK_KEY } },
      include: { school: true },
    });
    if (!task || task.status !== PhaseTaskStatus.PENDING || !task.school.ownerEmail) return;
    if (!(await this.sendWelcomeEmail(task.school))) return; // left pending; the EmailLog row says why
    await this.prisma.schoolPhaseTask.update({
      where: { id: task.id },
      data: { status: PhaseTaskStatus.DONE, completedAt: new Date(), completedByStaffId: null, notes: `Auto-sent to ${task.school.ownerEmail}` },
    });
    await this.activity.record(schoolId, null, 'Agent sent the welcome email', `To ${task.school.ownerEmail}`);
  }

  private async notifyAdminsOfEnrollment(schoolId: string, actor: StaffJwtPayload) {
    const [school, recipients, creator] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId }, include: { assignedAccountManager: { select: { name: true } } } }),
      this.adminAlertRecipients(),
      this.prisma.staff.findUnique({ where: { id: actor.sub }, select: { name: true } }),
    ]);
    if (!school) return;
    const line = (label: string, value: string | number | null | undefined) => `${label}: ${value ?? '—'}`;
    const body = [
      `A new school has been enrolled on the B2B Ops Platform.`,
      '',
      line('School', school.name),
      line('Location', [school.city, school.state].filter(Boolean).join(', ') || null),
      line('Program', school.productProgram),
      line('Grades', school.gradeFrom || school.gradeTo ? `${school.gradeFrom ?? '?'}–${school.gradeTo ?? '?'}` : null),
      line('Owner', [school.ownerName, school.ownerDesignation].filter(Boolean).join(', ') || null),
      line('Owner email', school.ownerEmail),
      line('Owner phone', school.ownerPhone),
      line('Workshops committed', school.workshopsCommitted),
      line('Account manager', school.assignedAccountManager?.name ?? 'Unassigned'),
      line('Created by', creator?.name),
      '',
      school.ownerEmail ? 'The welcome email is being sent to the school automatically.' : 'No owner email yet — the welcome email will go out as soon as one is added.',
    ].join('\n');
    await Promise.all(
      recipients.map((recipient) =>
        this.notifications.sendTemplateEmail({
          schoolId,
          recipient,
          templateKey: 'admin_new_school',
          subject: `New school enrolled — ${school.name}`,
          body,
          fromAccountManager: false,
        }),
      ),
    );
  }

  // ADMIN_ALERT_EMAILS (comma-separated) wins when set — e.g. a shared ops
  // inbox, or while the only Super Admins are seeded demo accounts whose
  // addresses nobody reads. Otherwise every active Super Admin.
  private async adminAlertRecipients(): Promise<string[]> {
    const configured = (this.config.get<string>('ADMIN_ALERT_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (configured.length > 0) return configured;
    const admins = await this.prisma.staff.findMany({ where: { role: StaffRole.SUPER_ADMIN, isActive: true }, select: { email: true } });
    return admins.map((a) => a.email);
  }

  // One read, then every write in parallel — the DB can be a long round
  // trip away, and this runs inside the user's request.
  private async syncChecklist(schoolId: string): Promise<number> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, include: SCHOOL_FOR_SYNC });
    if (!school) return 0;
    const writes: Promise<unknown>[] = [];
    const now = new Date();

    // Evidence doesn't depend on the current phase, so tick every proven
    // task at once — including ones in later phases.
    for (const task of school.phaseTasks) {
      if (task.status !== PhaseTaskStatus.PENDING) continue; // never override a person's DONE/N/A
      const evidence = EVIDENCE[task.template.key]?.(school);
      if (!evidence) continue;
      task.status = PhaseTaskStatus.DONE;
      writes.push(
        this.prisma.schoolPhaseTask.update({
          where: { id: task.id },
          data: { status: PhaseTaskStatus.DONE, completedAt: now, completedByStaffId: null, notes: `Auto-completed: ${evidence}` },
        }),
        this.activity.record(schoolId, null, `Agent completed: ${task.template.label}`, evidence),
      );
    }
    const ticked = writes.length / 2;

    // Then walk forward through every phase that's now fully done.
    let index = SCHOOL_LIFECYCLE_PHASE_ORDER.indexOf(school.currentPhase);
    const advancedFrom: number[] = [];
    while (index < SCHOOL_LIFECYCLE_PHASE_ORDER.length - 1) {
      const phase = SCHOOL_LIFECYCLE_PHASE_ORDER[index];
      const phaseTasks = school.phaseTasks.filter((t) => t.template.phase === phase);
      if (phaseTasks.length === 0 || phaseTasks.some((t) => t.status === PhaseTaskStatus.PENDING)) break;
      advancedFrom.push(index);
      index++;
    }
    if (advancedFrom.length > 0) {
      writes.push(this.prisma.school.update({ where: { id: schoolId }, data: { currentPhase: SCHOOL_LIFECYCLE_PHASE_ORDER[index] } }));
      for (const from of advancedFrom) {
        writes.push(
          this.activity.record(
            schoolId,
            null,
            `Agent advanced to ${SCHOOL_LIFECYCLE_PHASE_LABELS[SCHOOL_LIFECYCLE_PHASE_ORDER[from + 1]]}`,
            `Every ${SCHOOL_LIFECYCLE_PHASE_LABELS[SCHOOL_LIFECYCLE_PHASE_ORDER[from]]} task is complete`,
          ),
        );
      }
    }
    await Promise.all(writes);
    return ticked + advancedFrom.length;
  }

  private async safely<T>(what: string, schoolId: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(`Automation ${what} failed for school ${schoolId}: ${err instanceof Error ? err.message : err}`);
      return undefined;
    }
  }
}
